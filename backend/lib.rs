use candid::{CandidType, Nat, Principal};
use ic_cdk::{query, update};
use ic_llm::{Model, ChatMessage, ToolCall, ParameterType};

use icrc_ledger_types::icrc1::{
    account::Account as IcrcAccount,
    transfer::Memo,
};
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Number, Value};

use num_bigint::BigUint;
use sha2::{Digest, Sha256};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use ic_cdk::println;

macro_rules! log {
    ($($arg:tt)*) => { println!($($arg)*); }
}

// ===================== ALLOWLIST TOKEN =====================
// GANTI sesuai kebutuhanmu:
#[derive(Clone, Debug)]
struct TokenEntry { symbol: &'static str, ledger: &'static str, decimals: u8 }

const TOKENS: &[TokenEntry] = &[
    TokenEntry { symbol: "ICP",  ledger: "<LEDGER_ICP_ID>",      decimals: 8 },
    TokenEntry { symbol: "CFXN", ledger: "mxzaz-hqaaa-aaaar-qaada-cai",     decimals: 0 }, // <<-- GANTI INI
];

// ===================== STORAGE SEDERHANA =====================
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct SavedAccount {
    pub alias: String,
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

thread_local! {
    static ACCOUNTS: RefCell<BTreeMap<String, SavedAccount>> = RefCell::new(BTreeMap::new());
    static LAST_PLAN_BY_CALLER: RefCell<BTreeMap<Principal, TransferPlan>> = RefCell::new(BTreeMap::new());
    static PLAN_BY_CHECKSUM:    RefCell<BTreeMap<String, TransferPlan>>    = RefCell::new(BTreeMap::new());
    static EXECUTED_CHECKSUMS:  RefCell<BTreeSet<String>>                  = RefCell::new(BTreeSet::new());
}

// ===================== SYSTEM PROMPT =====================
const SYSTEM_PROMPT: &str = r#"
You are a finance copilot for ICRC tokens on the Internet Computer.

LANGUAGE
- Reply ONLY in the user's last language (Indonesian or English). Do not mix languages or add translations.

STYLE
- Be brief (1–2 sentences per step).

SCOPE & DEFAULTS
- Backend decides ledger/decimals/fees from an allowlist. Never ask the user for a ledger ID.
- If token symbol is missing, ask once; otherwise proceed. Memo is optional.

SLOT FILLING
- Required: recipient (principal/alias) and amount (decimal string). Memo optional.
- If a required field is missing, ask EXACTLY ONE short question. Do NOT call tools yet.
- No placeholders: "", "-", "unknown", "tbd", "null", "?".

AMOUNT
- Accept inputs like “10 CFXN” or “0.5 ICP” and extract the number as amount_dec.
- If a tool returns BadAmount with an example, use that example next time.

TOOL CALLING (STRICT)
- Never narrate tool calls or print example JSON. When ready, CALL the tool via tool_calls.
- Call plan_transfer once recipient & amount are known. Params: to, amount_dec, memo (optional). symbol/ledger/decimals optional (backend overrides).
- After plan_transfer: show one-line summary (human_readable) and ask explicit confirmation (“confirm” / “lanjut” / “ya”).
- On confirmation: CALL confirm_transfer. If plan object is missing, you may call with only checksum OR with no parameters; backend uses the last plan.

ERROR HANDLING
- If tool returns {"status":"err",...}:
  1) Ask ONE short question to fix that field in the user's language.
  2) Show "options" briefly if provided.
  3) Show ONE "example" if provided.
  4) Do NOT call tools again until the field is provided.

HYGIENE
- Do not re-ask fields already provided unless a tool says they are invalid/missing.
"#;

// ===================== TYPES & ARGS =====================
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct PlanArgs {
    pub to: String,
    pub amount_dec: String,
    pub symbol: Option<String>,   // optional
    pub ledger: Option<String>,   // optional
    pub decimals: Option<u8>,     // optional
    pub memo: Option<String>,
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct TransferPlan {
    // SUMBER DANA = user (non-custodial / ICRC-2)
    pub from_owner: Option<Principal>,
    pub from_sub:   Option<[u8; 32]>,

    // TUJUAN
    pub to_principal: Principal,
    pub to_sub: Option<[u8; 32]>,

    // AMOUNT & TOKEN
    pub amount: Nat,          // minimal units
    pub symbol: String,
    pub ledger: Principal,
    pub memo: Option<Memo>,
    pub created_at_time: u64, // nanos

    // UX
    pub human_readable: String,
    pub checksum: String,
}

// ===================== UTIL =====================
fn token_symbols() -> Vec<&'static str> { TOKENS.iter().map(|t| t.symbol).collect() }

fn resolve_to(to: &str) -> Result<(Principal, Option<[u8;32]>), String> {
    if let Ok(p) = Principal::from_text(to) { return Ok((p, None)); }
    ACCOUNTS.with(|m| {
        let m = m.borrow();
        if let Some(sa) = m.get(to) { Ok((sa.owner, sa.subaccount)) }
        else { Err(format!("alias/principal '{}' tidak ditemukan", to)) }
    })
}
// use serde_json::Value;

fn decode_plan_value(v: &Value) -> Result<TransferPlan, String> {
    match v {
        Value::Object(_) => {
            serde_json::from_value::<TransferPlan>(v.clone())
                .map_err(|e| e.to_string())
        }
        Value::String(s) => {
            let t = s.trim();
            if t.starts_with('{') {
                serde_json::from_str::<TransferPlan>(t).map_err(|e| e.to_string())
            } else {
                Err("plan must be a JSON object (from plan_transfer)".into())
            }
        }
        _ => Err("plan must be a JSON object or JSON string".into()),
    }
}

fn resolve_token(symbol_opt: Option<&str>, ledger_opt: Option<&str>)
-> Result<(Principal, u8, String), String> {
    // 1) ledger eksplisit → cocokkan allowlist
    if let Some(l) = ledger_opt {
        if let Some(t) = TOKENS.iter().find(|t| t.ledger == l) {
            log!("[resolve token] ledger={}", t.ledger);
            let p = Principal::from_text(t.ledger).map_err(|_| "ledger id invalid")?;
            return Ok((p, t.decimals, t.symbol.to_string()));
        } else { return Err("ledger tidak di-allowlist".into()); }
    }
    // 2) symbol eksplisit → cocokkan allowlist
    if let Some(sym) = symbol_opt {
        let s = sym.to_ascii_uppercase();
        if let Some(t) = TOKENS.iter().find(|t| t.symbol.eq_ignore_ascii_case(&s)) {
            log!("[resolve token] ledger={}", t.ledger);
            let p = Principal::from_text(t.ledger).map_err(|_| "ledger id invalid")?;
            return Ok((p, t.decimals, t.symbol.to_string()));
        }
        return Err("token tidak di-allowlist".into());
    }
    // 3) fallback → entry pertama (mis. ICP)
    let t = &TOKENS[1];
    let p = Principal::from_text(t.ledger).map_err(|_| "ledger id invalid")?;
    Ok((p, t.decimals, t.symbol.to_string()))
}

fn example_for_decimals(decimals: u8) -> &'static str {
    if decimals == 0 { "10" } else { "0.5" }
}

fn scale_amount(amount_dec: &str, decimals: u8) -> Result<Nat, String> {
    // safe big-int scaling: "10.5", decimals=8 -> "1050000000"
    let mut split = amount_dec.trim().split('.');
    let int_part  = split.next().unwrap_or("0").replace('_', "");
    let frac_part = split.next().unwrap_or("").replace('_', "");
    if split.next().is_some() { return Err("format amount tidak valid".into()); }
    if frac_part.len() > decimals as usize {
        return Err(format!("maksimal {} digit desimal", decimals));
    }
    let scaled = format!("{}{:0<width$}", int_part, frac_part, width = decimals as usize);
    let n = BigUint::parse_bytes(scaled.as_bytes(), 10).ok_or("amount tidak valid")?;
    Ok(Nat::from(n))
}

fn plan_checksum(p: &TransferPlan) -> String {
    let mut h = Sha256::new();
    if let Some(fo) = p.from_owner { h.update(fo.as_slice()); }
    if let Some(fs) = p.from_sub   { h.update(fs); }
    h.update(p.to_principal.as_slice());
    if let Some(ts) = p.to_sub     { h.update(ts); }
    h.update(p.amount.to_string().as_bytes());
    h.update(p.symbol.as_bytes());
    h.update(p.ledger.as_slice());
    if let Some(m) = &p.memo { h.update(&m.0); }
    h.update(p.created_at_time.to_le_bytes());
    hex::encode(&h.finalize()[..8])
}

fn is_placeholder(s: &str) -> bool {
    let t = s.trim().to_ascii_lowercase();
    t.is_empty() || matches!(t.as_str(), "unknown" | "tbd" | "-" | "null" | "?" | "n/a")
}

// ===================== ICRC-2 EXECUTION =====================
async fn icrc2_transfer_from(
    ledger: Principal,
    from_owner: Principal,
    from_sub: Option<[u8;32]>,
    to_owner: Principal,
    to_sub: Option<[u8;32]>,
    amount: Nat,
    memo: Option<Memo>,
    created_at_time: u64,
) -> Result<Nat, TransferFromError> {
    let from = IcrcAccount { owner: from_owner, subaccount: from_sub };
    let to   = IcrcAccount { owner: to_owner,   subaccount: to_sub };
    let args = TransferFromArgs {
        from, to, amount,
        fee: None,
        memo,
        created_at_time: Some(created_at_time),
        spender_subaccount: None,
    };
    ic_cdk::call::<(TransferFromArgs,), (Result<Nat, TransferFromError>,)>(
        ledger, "icrc2_transfer_from", (args,)
    )
    .await
    .map_err(|_| TransferFromError::TemporarilyUnavailable)?
    .0
}

// ===================== TOOL ARG PARSER =====================
fn to_number(v: &Value) -> Option<Value> {
    match v {
        Value::Number(_) => Some(v.clone()),
        Value::String(s) => s.parse::<u64>().ok().map(Number::from).map(Value::Number),
        _ => None,
    }
}
fn to_string(_raw: &str, v: &Value) -> Value {
    match v { Value::String(s) => Value::String(s.clone()), other => Value::String(other.to_string()) }
}
fn tool_args_json(call: &ToolCall) -> Value {
    let mut m: Map<String, Value> = Map::new();
    for arg in &call.function.arguments {
        let parsed = match serde_json::from_str::<Value>(&arg.value) {
            Ok(Value::String(inner)) => {
                if inner.trim().starts_with('{') || inner.trim().starts_with('[') {
                    serde_json::from_str::<Value>(&inner).unwrap_or(Value::String(inner))
                } else { Value::String(inner) }
            }
            Ok(v) => v,
            Err(_) => Value::String(arg.value.clone()),
        };
        let coerced = match arg.name.as_str() {
            "to" | "symbol" | "ledger" | "memo" => to_string(&arg.value, &parsed),
            "amount_dec" => to_string(&arg.value, &parsed),
            "decimals" => to_number(&parsed).unwrap_or(Value::Number(Number::from(0u64))),
            _ => parsed,
        };
        m.insert(arg.name.clone(), coerced);
    }
    Value::Object(m)
}

// ===================== TOOL DISPATCHER =====================
async fn handle_tool_call(call: &ToolCall) -> (String, String) {
    match call.function.name.as_str() {
        "plan_transfer" => {
            // parse args
            let parsed = tool_args_json(&call);
            log!("[plan_transfer] raw_args={}", serde_json::to_string(&parsed).unwrap_or_default());

            let args: Result<PlanArgs, _> = serde_json::from_value(parsed);
            if let Err(e) = args {
                log!("[plan_transfer] BadArgs: {}", e);
                return (call.id.clone(), json!({"status":"err","code":"BadArgs","error":e.to_string()}).to_string());
            }
            let a = args.unwrap();

            if is_placeholder(&a.to) {
                log!("[plan_transfer] NeedRecipient");
                return (call.id.clone(), json!({"status":"err","code":"NeedRecipient","field":"to"}).to_string());
            }
            if is_placeholder(&a.amount_dec) {
                log!("[plan_transfer] NeedAmount");
                return (call.id.clone(), json!({"status":"err","code":"NeedAmount","field":"amount_dec","example":"10"}).to_string());
            }

            // resolve token from allowlist (symbol/ledger optional)
            let (ledger_p, decimals, symbol) = match resolve_token(a.symbol.as_deref(), a.ledger.as_deref()) {
                Ok(t) => t,
                Err(e) => {
                            log!("[plan_transfer] BadToken: {}", e);
                            return (call.id.clone(), json!({"status":"err","code":"BadToken","field":"symbol","options": token_symbols()}).to_string());
                        }
            };
            log!("[plan_transfer] resolved token: symbol={} ledger={} decimals={}", symbol, ledger_p.to_text(), decimals);

            // scale amount
            let amount = match scale_amount(&a.amount_dec, decimals) {
                Ok(n) => n,
                Err(err) => {
                    log!("[plan_transfer] BadAmount: {}", err);
                    return (call.id.clone(), json!({"status":"err","code":"BadAmount","field":"amount_dec","error": err,"example": example_for_decimals(decimals)}).to_string());
                }
            };
            log!("[plan_transfer] scaled amount(min_units)={}", amount);
            // resolve recipient
            let (to_p, to_sub) = match resolve_to(&a.to) {
                Ok(v) => v,
                Err(err) => {
                            log!("[plan_transfer] BadRecipient: {}", err);
                            return (call.id.clone(), json!({"status":"err","code":"BadRecipient","field":"to","error":err}).to_string());
                        }
            };
            log!("[plan_transfer] to_principal={} subaccount_present={}", to_p.to_text(), to_sub.is_some());

            // memo
            // let memo = a.memo.map(|m| Memo(format!("{}|caller:{}", m, ic_cdk::api::caller()).into_bytes().into()));
             let memo = a.memo.map(|m| {
                let caller = ic_cdk::api::caller();
                let payload = format!("{}|caller:{}", m, caller);
                log!("[plan_transfer] memo_len={}", payload.len());
                Memo(payload.into_bytes().into())
            });
            // build plan
            let created = ic_cdk::api::time();
            let mut plan = TransferPlan {
                from_owner: Some(ic_cdk::api::caller()),
                from_sub: None,
                to_principal: to_p,
                to_sub,
                amount: amount.clone(),
                symbol: symbol.clone(),
                ledger: ledger_p,
                memo,
                created_at_time: created,
                human_readable: format!("Send {} {} to {} (ledger={}).", amount, symbol, to_p.to_text(), ledger_p.to_text()),
                checksum: String::new(),
            };
            plan.checksum = plan_checksum(&plan);
            log!("[plan_transfer] plan checksum={} human='{}'", plan.checksum, plan.human_readable);

            // save last plan
            let caller = ic_cdk::api::caller();
            LAST_PLAN_BY_CALLER.with(|m| { m.borrow_mut().insert(caller, plan.clone()); });
            PLAN_BY_CHECKSUM.with(|m| { m.borrow_mut().insert(plan.checksum.clone(), plan.clone()); });

            (call.id.clone(), serde_json::to_string(&plan).unwrap())
        }

        "confirm_transfer" => {
            let raw = tool_args_json(&call);
            log!("[confirm_transfer] raw_args={}", serde_json::to_string(&raw).unwrap_or_default());

            // try plan from params
            // let plan_from_params: Option<TransferPlan> = match raw.get("plan") {
            //     Some(v) => {
            //         let p = match v {
            //             Value::Object(_) => serde_json::from_value::<TransferPlan>(v.clone()),
            //             Value::String(s) if s.trim().starts_with('{') => serde_json::from_str::<TransferPlan>(s),
            //             _ => Err(serde_json::Error::custom("plan must be JSON object")),
            //         };
            //         match p {
            //             Ok(pp) => Some(pp),
            //             Err(e) => return (call.id.clone(), json!({"status":"err","code":"BadPlan","error":e.to_string()}).to_string()),
            //         }
            //     }
            //     None => None,
            // };
            let plan_from_params: Option<TransferPlan> = match raw.get("plan") {
                Some(v) => match decode_plan_value(v) {
                Ok(pp) => {
                    log!("[confirm_transfer] plan provided in params; checksum={}", pp.checksum);
                    Some(pp)
                }
                     Err(e) => {
                        log!("[confirm_transfer] BadPlan: {}", e);
                        None
                        // return (call.id.clone(),
                        //     serde_json::json!({"status":"err","code":"BadPlan","error":e}).to_string()
                        // );
                    }
                },
                None => None,
            };


            // else try checksum
            let plan = if let Some(p) = plan_from_params {
                p
            // } else if let Some(cs) = raw.get("checksum").and_then(|v| v.as_str()) {
            //     log!("[confirm_transfer] using checksum param={}", cs);
            //     match PLAN_BY_CHECKSUM.with(|m| m.borrow().get(cs).cloned()) {
            //         Some(p) => p,
            //         None => {
            //                         log!("[confirm_transfer] MissingPlan for checksum");
            //                         return (call.id.clone(), json!({"status":"err","code":"MissingPlan","error":"no plan for checksum"}).to_string())
            //                     }
            //     }
            } else {
                // else last plan by caller
                let caller = ic_cdk::api::caller();
                log!("[confirm_transfer] no plan+checksum param; using LAST_PLAN_BY_CALLER for {}", caller.to_text());

                match LAST_PLAN_BY_CALLER.with(|m| m.borrow().get(&caller).cloned()) {
                    Some(p) => p,
                    None => {
                        log!("[confirm_transfer] MissingPlan for caller");
                        return (call.id.clone(), json!({"status":"err","code":"MissingPlan","error":"no last plan"}).to_string())
                    }
                }
            };

            // verify checksum if provided
            //  if let Some(cs) = raw.get("checksum").and_then(|v| v.as_str()) {
            //     let calc = plan_checksum(&plan);
            //     let ok = calc == cs;
            //     log!("[confirm_transfer] checksum param={} calc={} match={}", cs, calc, ok);
            //     if !ok {
            //         return (call.id.clone(), json!({"status":"err","code":"ChecksumMismatch"}).to_string());
            //         }
            // } else {
            //     log!("[confirm_transfer] no checksum param; relying on stored plan");
            // }

            // anti-replay
            let cs = plan.checksum.clone();
            let dup = EXECUTED_CHECKSUMS.with(|s| s.borrow().contains(&cs));
            log!("[confirm_transfer] anti-replay checksum={} already_executed={}", cs, dup);
            if dup {
                return (call.id.clone(), json!({"status":"err","code":"Duplicate"}).to_string());
            }
            // eksekusi
            log!("[confirm_transfer] exec icrc2_transfer_from amount={} symbol={} to={}",
                plan.amount, plan.symbol, plan.to_principal.to_text());
            // sebelum eksekusi:
            let caller = ic_cdk::api::caller();
            let canister_id = ic_cdk::id();

            log!(
                "[confirm_transfer] caller={} from_owner={:?} spender(canister)={}",
                caller.to_text(),
                plan.from_owner.map(|p| p.to_text()),
                canister_id.to_text()
            );
            // execute (ICRC-2, non-custodial)
            let exec = match plan.from_owner {
                Some(user) => icrc2_transfer_from(
                    plan.ledger,
                    user, plan.from_sub,
                    plan.to_principal, plan.to_sub,
                    plan.amount.clone(),
                    plan.memo.clone(),
                    plan.created_at_time,
                ).await.map_err(|e| format!("ICRC2::{:?}", e)),
                None => Err("missing from_owner".into()),
            };

            let res = match exec {
                Ok(block_idx) => {
                    EXECUTED_CHECKSUMS.with(|s| { s.borrow_mut().insert(cs); });
                    log!("[confirm_transfer] OK block_index={}", block_idx);
                    json!({ "status":"ok", "block_index": block_idx.to_string() })
                }
                Err(e) => {
                            log!("[confirm_transfer] ExecError: {}", e);
                            json!({ "status":"err", "code":"ExecError", "error": e })
                        }
            };
            (call.id.clone(), res.to_string())
        }

        "save_account" => {
            #[derive(Deserialize)] struct SaveArgs { alias: String, owner: String, sub: Option<Vec<u8>> }
            let parsed = tool_args_json(&call);
            let a: Result<SaveArgs, _> = serde_json::from_value(parsed);
            if let Err(e) = a {
                return (call.id.clone(), json!({"status":"err","code":"BadArgs","error":e.to_string()}).to_string());
            }
            let a = a.unwrap();
            let p = match Principal::from_text(&a.owner) {
                Ok(p) => p,
                Err(_) => return (call.id.clone(), json!({"status":"err","code":"BadPrincipal"}).to_string()),
            };
            let sub32 = if let Some(v) = a.sub {
                if v.len()!=32 { return (call.id.clone(), json!({"status":"err","code":"BadSub"}).to_string()); }
                let mut x=[0u8;32]; x.copy_from_slice(&v); Some(x)
            } else { None };
            let rec = SavedAccount { alias: a.alias.clone(), owner: p, subaccount: sub32 };
            ACCOUNTS.with(|m| { m.borrow_mut().insert(a.alias, rec); });
            (call.id.clone(), json!({"status":"ok"}).to_string())
        }

        "list_accounts" => {
            let v = ACCOUNTS.with(|m| serde_json::to_string(&m.borrow().values().cloned().collect::<Vec<_>>()).unwrap());
            (call.id.clone(), v)
        }

        _ => (call.id.clone(), json!({"status":"err","error":"unknown tool"}).to_string()),
    }
}

// ===================== LANGUAGE GUARD & CAP =====================
const MAX_MESSAGES: usize = 10; // termasuk System
fn cap_messages_in_place(convo: &mut Vec<ChatMessage>) {
    if convo.len() <= MAX_MESSAGES { return; }
    let system = convo.first().cloned();
    let keep = convo.split_off(convo.len().saturating_sub(MAX_MESSAGES - 1));
    convo.clear();
    if let Some(sys) = system { convo.push(sys); }
    convo.extend(keep);
}

// Heuristik sederhana
fn detect_lang_last_user(msgs: &[ChatMessage]) -> &'static str {
    for m in msgs.iter().rev() {
        if let ChatMessage::User { content } = m {
            let lc = content.to_ascii_lowercase();
            if lc.contains("english please") || lc.contains("english") { return "en"; }
            if lc.contains("indonesia") || lc.contains("indonesian") { return "id"; }
            if lc.contains("yang") || lc.contains("kamu") || lc.contains("sudah") { return "id"; }
            return "en";
        }
    }
    "en"
}
fn lang_guard(lang: &str) -> ChatMessage {
    let s = match lang {
        "id" => "BAHASA: Jawab dalam BAHASA INDONESIA saja. Jangan campur Inggris.",
        _    => "LANGUAGE: Answer in ENGLISH only. Do not mix Indonesian.",
    };
    ChatMessage::System { content: s.to_string() }
}

// ===================== CHAT ENTRYPOINT =====================
#[update]
pub async fn copilot_chat(messages: Vec<ChatMessage>) -> String {
    let tools = vec![
        ic_llm::tool("plan_transfer")
            .with_description("Plan a token transfer (non-custodial). Returns a TransferPlan+checksum.")
            .with_parameter(ic_llm::parameter("to",          ParameterType::String).is_required())
            .with_parameter(ic_llm::parameter("amount_dec",  ParameterType::String).is_required())
            .with_parameter(ic_llm::parameter("symbol",      ParameterType::String))
            .with_parameter(ic_llm::parameter("ledger",      ParameterType::String))
            .with_parameter(ic_llm::parameter("decimals",    ParameterType::Number))
            .with_parameter(ic_llm::parameter("memo",        ParameterType::String))
            .build(),
        ic_llm::tool("confirm_transfer")
            .with_description("Execute after user confirms (uses ICRC-2 transfer_from).")
            .with_parameter(ic_llm::parameter("plan",        ParameterType::String))   // optional
            .with_parameter(ic_llm::parameter("checksum",    ParameterType::String))   // optional
            .build(),
        ic_llm::tool("save_account")
            .with_parameter(ic_llm::parameter("alias",       ParameterType::String).is_required())
            .with_parameter(ic_llm::parameter("owner",       ParameterType::String).is_required())
            .with_parameter(ic_llm::parameter("sub",         ParameterType::String))
            .build(),
        ic_llm::tool("list_accounts").with_description("List saved accounts").build(),
    ];

    let mut convo = vec![ChatMessage::System { content: SYSTEM_PROMPT.to_string() }];
    convo.extend(messages);

    // kunci bahasa putaran ini
    let lang = detect_lang_last_user(&convo);
    convo.insert(1, lang_guard(lang));
    cap_messages_in_place(&mut convo);

    let mut resp = ic_llm::chat(Model::Llama3_1_8B)
        .with_messages(convo.clone())
        .with_tools(tools.clone())
        .send()
        .await;

    let mut rounds = 0usize;
    loop {
        rounds += 1;
        if rounds > 6 { break; }

        let calls: Vec<ToolCall> = resp.message.tool_calls.clone();
        if calls.is_empty() { break; }

        for call in calls {
            let (id, result_json) = handle_tool_call(&call).await;
            convo.push(ChatMessage::Tool { tool_call_id: id, content: result_json });
        }

        // re-apply language guard & cap
        let lang = detect_lang_last_user(&convo);
        convo.insert(1, lang_guard(lang));
        cap_messages_in_place(&mut convo);

        resp = ic_llm::chat(Model::Llama3_1_8B)
            .with_messages(convo.clone())
            .with_tools(tools.clone())
            .send()
            .await;
    }

    resp.message.content.unwrap_or_default()
}

// ===================== UTIL ENDPOINTS =====================
#[update]
pub fn save_account(alias: String, owner: String, sub: Option<Vec<u8>>) -> Result<(), String> {
    let p = Principal::from_text(owner).map_err(|_| "principal invalid".to_string())?;
    let sub32 = match sub {
        None => None,
        Some(v) => {
            if v.len()!=32 { return Err("sub must be 32 bytes".into()); }
            let mut a=[0u8;32]; a.copy_from_slice(&v); Some(a)
        }
    };
    let rec = SavedAccount { alias: alias.clone(), owner: p, subaccount: sub32 };
    ACCOUNTS.with(|m| m.borrow_mut().insert(alias, rec));
    Ok(())
}

#[query]
pub fn list_accounts() -> Vec<SavedAccount> {
    ACCOUNTS.with(|m| m.borrow().values().cloned().collect())
}

// export candid
ic_cdk::export_candid!();
