use candid::{Nat, Principal};
use ic_cdk::{query, update};
use ic_llm::{Model, ChatMessage, ToolCall, ParameterType};

use icrc_ledger_types::icrc1::{
    account::Account as IcrcAccount,
    transfer::Memo,
};
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};

use serde::Deserialize;
use serde_json::json;
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use ic_cdk::println;

pub mod types;
pub mod utils;

use types::{PlanArgs, TransferPlan, SavedAccount};
use utils::{
    token_symbols, resolve_to, decode_plan_value, resolve_token, example_for_decimals,
    scale_amount, plan_checksum, is_placeholder, tool_args_json,
    cap_messages_in_place, detect_lang_last_user, lang_guard,
};

#[macro_export]
macro_rules! log {
    ($($arg:tt)*) => { println!($($arg)*); }
}

thread_local! {
    pub(crate) static ACCOUNTS: RefCell<BTreeMap<String, SavedAccount>> = RefCell::new(BTreeMap::new());
    pub(crate) static LAST_PLAN_BY_CALLER: RefCell<BTreeMap<Principal, TransferPlan>> = RefCell::new(BTreeMap::new());
    pub(crate) static PLAN_BY_CHECKSUM:    RefCell<BTreeMap<String, TransferPlan>>    = RefCell::new(BTreeMap::new());
    pub(crate) static EXECUTED_CHECKSUMS:  RefCell<BTreeSet<String>>                  = RefCell::new(BTreeSet::new());
}

/// System prompt provided to the language model.
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

/// Execute an ICRC-2 `transfer_from` on the specified ledger.
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

/// Dispatch tool calls coming from the language model.
async fn handle_tool_call(call: &ToolCall) -> (String, String) {
    match call.function.name.as_str() {
        "plan_transfer" => {
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

            let (ledger_p, decimals, symbol) = match resolve_token(a.symbol.as_deref(), a.ledger.as_deref()) {
                Ok(t) => t,
                Err(_) => {
                    log!("[plan_transfer] BadToken");
                    return (call.id.clone(), json!({"status":"err","code":"BadToken","field":"symbol","options": token_symbols()}).to_string());
                }
            };
            log!("[plan_transfer] resolved token: symbol={} ledger={} decimals={}", symbol, ledger_p.to_text(), decimals);

            let amount = match scale_amount(&a.amount_dec, decimals) {
                Ok(n) => n,
                Err(err) => {
                    log!("[plan_transfer] BadAmount: {}", err);
                    return (call.id.clone(), json!({"status":"err","code":"BadAmount","field":"amount_dec","error": err,"example": example_for_decimals(decimals)}).to_string());
                }
            };
            log!("[plan_transfer] scaled amount(min_units)={}", amount);

            let (to_p, to_sub) = match resolve_to(&a.to) {
                Ok(v) => v,
                Err(err) => {
                    log!("[plan_transfer] BadRecipient: {}", err);
                    return (call.id.clone(), json!({"status":"err","code":"BadRecipient","field":"to","error":err}).to_string());
                }
            };
            log!("[plan_transfer] to_principal={} subaccount_present={}", to_p.to_text(), to_sub.is_some());

            let memo = a.memo.map(|m| {
                let caller = ic_cdk::api::caller();
                let payload = format!("{}|caller:{}", m, caller);
                log!("[plan_transfer] memo_len={}", payload.len());
                Memo(payload.into_bytes().into())
            });
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

            let caller = ic_cdk::api::caller();
            LAST_PLAN_BY_CALLER.with(|m| { m.borrow_mut().insert(caller, plan.clone()); });
            PLAN_BY_CHECKSUM.with(|m| { m.borrow_mut().insert(plan.checksum.clone(), plan.clone()); });

            (call.id.clone(), serde_json::to_string(&plan).unwrap())
        }
        "confirm_transfer" => {
            let raw = tool_args_json(&call);
            log!("[confirm_transfer] raw_args={}", serde_json::to_string(&raw).unwrap_or_default());

            let plan_from_params: Option<TransferPlan> = match raw.get("plan") {
                Some(v) => match decode_plan_value(v) {
                    Ok(pp) => {
                        log!("[confirm_transfer] plan provided in params; checksum={}", pp.checksum);
                        Some(pp)
                    }
                    Err(e) => {
                        log!("[confirm_transfer] BadPlan: {}", e);
                        None
                    }
                },
                None => None,
            };

            let plan = if let Some(p) = plan_from_params {
                p
            } else {
                let caller = ic_cdk::api::caller();
                log!("[confirm_transfer] no plan+checksum param; using LAST_PLAN_BY_CALLER for {}", caller.to_text());
                match LAST_PLAN_BY_CALLER.with(|m| m.borrow().get(&caller).cloned()) {
                    Some(p) => p,
                    None => {
                        log!("[confirm_transfer] MissingPlan for caller");
                        return (call.id.clone(), json!({"status":"err","code":"MissingPlan","error":"no last plan"}).to_string());
                    }
                }
            };

            let cs = plan.checksum.clone();
            let dup = EXECUTED_CHECKSUMS.with(|s| s.borrow().contains(&cs));
            log!("[confirm_transfer] anti-replay checksum={} already_executed={}", cs, dup);
            if dup {
                return (call.id.clone(), json!({"status":"err","code":"Duplicate"}).to_string());
            }

            log!("[confirm_transfer] exec icrc2_transfer_from amount={} symbol={} to={}",
                plan.amount, plan.symbol, plan.to_principal.to_text());
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
            #[derive(Deserialize)]
            struct SaveArgs { alias: String, owner: String, sub: Option<Vec<u8>> }
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

/// Chat entrypoint used by the frontend to converse with the copilot.
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
            .with_parameter(ic_llm::parameter("plan",        ParameterType::String))
            .with_parameter(ic_llm::parameter("checksum",    ParameterType::String))
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

/// Save an account alias for later reuse.
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

/// List all saved account aliases.
#[query]
pub fn list_accounts() -> Vec<SavedAccount> {
    ACCOUNTS.with(|m| m.borrow().values().cloned().collect())
}

ic_cdk::export_candid!();

