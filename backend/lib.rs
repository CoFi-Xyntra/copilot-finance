use candid::{CandidType, Nat, Principal};
use ic_cdk::{query, update};
use ic_llm::ChatMessage;

use icrc_ledger_types::icrc1::{account::Account as IcrcAccount, transfer::Memo};
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

// =================== AI API CONFIG ===================
const OLLAMA_URL: &str = "http://127.0.0.1:11434";                     // non-wasm/dev (fallback)
const DEEPSEEK_API_URL: &str = "https://api.deepseek.com/v1/chat/completions"; 
const OPENROUTER_API_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

// API Provider Selection (change this to switch providers)
const USE_PROVIDER: &str = "openrouter"; // Options: "deepseek", "openrouter", "ollama"

const DEEPSEEK_MODEL: &str = "deepseek-reasoner";
const OPENROUTER_MODEL: &str = "deepseek/deepseek-r1"; // or any model from OpenRouter

const MODEL_SUPPORTS_TOOLS: bool = true;                               // Both APIs support tools
const DEEPSEEK_API_KEY: &str = env!("DEEPSEEK_API_KEY");               // Leída desde variable de entorno
const OPENROUTER_API_KEY: &str = env!("OPENROUTER_API_KEY");           // Leída desde variable de entorno

const TOOL_TAG_OPEN: &str = "<tool>";
const TOOL_TAG_CLOSE: &str = "</tool>";

// ============ AI PROVIDER CONFIGURATION ============
struct ApiConfig {
    url: &'static str,
    model: &'static str,
    api_key: &'static str,
    provider_name: &'static str,
}

fn get_api_config() -> ApiConfig {
    match USE_PROVIDER {
        "deepseek" => ApiConfig {
            url: DEEPSEEK_API_URL,
            model: DEEPSEEK_MODEL,
            api_key: DEEPSEEK_API_KEY,
            provider_name: "DeepSeek",
        },
        "openrouter" => ApiConfig {
            url: OPENROUTER_API_URL,
            model: OPENROUTER_MODEL,
            api_key: OPENROUTER_API_KEY,
            provider_name: "OpenRouter",
        },
        _ => ApiConfig {
            url: DEEPSEEK_API_URL,
            model: DEEPSEEK_MODEL,
            api_key: DEEPSEEK_API_KEY,
            provider_name: "DeepSeek",
        },
    }
}
// ===================== ALLOWLIST TOKEN =====================
#[derive(Clone, Debug)]
struct TokenEntry { symbol: &'static str, ledger: &'static str, decimals: u8 }

const TOKENS: &[TokenEntry] = &[
    TokenEntry { symbol: "ICP",  ledger: "<LEDGER_ICP_ID>",              decimals: 8 },
    TokenEntry { symbol: "CFXN", ledger: "mxzaz-hqaaa-aaaar-qaada-cai",  decimals: 0 },
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
- Reply ONLY in English

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

THINKING
- Do NOT output chain-of-thought or <think> blocks. Provide only the final answer or a tool call.

OUTPUT RULES
- Do NOT output JSON or code fences (```).
- User-facing replies must be brief plain sentences only (no lists unless asked).
- The ONLY time you output a special tag is to call a tool: <tool>{"name":"...","arguments":{...}}</tool>
- After a tool result (role=tool), summarize in ONE short sentence; never show raw JSON.

"#;
fn tool_proxy_instructions() -> &'static str {
    r#"
TOOL CALLING (NO NATIVE TOOLS)
- When you need to call a tool, output EXACTLY ONE LINE:
  <tool>{"name":"<tool_name>","arguments":{...}}</tool>
- No extra text before or after the tag. Arguments must be valid JSON.
- After receiving a tool result (role=tool), reply with ONE short plain sentence (no JSON, no code fences).
- Tools available: plan_transfer, confirm_transfer, save_account, list_accounts.
    "#
}

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

fn decode_plan_value(v: &Value) -> Result<TransferPlan, String> {
    match v {
        Value::Object(_) => serde_json::from_value::<TransferPlan>(v.clone()).map_err(|e| e.to_string()),
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
            let p = Principal::from_text(t.ledger).map_err(|_| "ledger id invalid")?;
            return Ok((p, t.decimals, t.symbol.to_string()));
        } else { return Err("ledger tidak di-allowlist".into()); }
    }
    // 2) symbol eksplisit → cocokkan allowlist
    if let Some(sym) = symbol_opt {
        let s = sym.to_ascii_uppercase();
        if let Some(t) = TOKENS.iter().find(|t| t.symbol.eq_ignore_ascii_case(&s)) {
            let p = Principal::from_text(t.ledger).map_err(|_| "ledger id invalid")?;
            return Ok((p, t.decimals, t.symbol.to_string()));
        }
        return Err("token tidak di-allowlist".into());
    }
    // 3) fallback → entry pertama
    let t = &TOKENS[0];
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
fn tool_args_json(call_name: &str, args_obj: &Value) -> Value {
    // Ollama tool.args biasanya JSON object/string; normalize ke Value::Object
    let mut m: Map<String, Value> = Map::new();
    let parsed = match args_obj {
        Value::String(s) => serde_json::from_str::<Value>(s).unwrap_or(Value::String(s.clone())),
        other => other.clone(),
    };
    let obj = parsed.as_object().cloned().unwrap_or_default();
    for (k, v) in obj.into_iter() {
        let coerced = match k.as_str() {
            "to" | "symbol" | "ledger" | "memo" | "amount_dec" => to_string("", &v),
            "decimals" => to_number(&v).unwrap_or(Value::Number(Number::from(0u64))),
            _ => v,
        };
        m.insert(k, coerced);
    }
    log!("[tool_args_json] tool={} args={}", call_name, serde_json::to_string(&m).unwrap_or_default());
    Value::Object(m)
}

// ===================== TOOL DISPATCHER =====================
async fn handle_tool_call_ollama(name: &str, args: Value) -> (String, String) {
    match name {
        "plan_transfer" => {
            let parsed = tool_args_json(name, &args);
            let args: Result<PlanArgs, _> = serde_json::from_value(parsed);
            if let Err(e) = args {
                return ("plan_transfer".into(), json!({"status":"err","code":"BadArgs","error":e.to_string()}).to_string());
            }
            let a = args.unwrap();

            if is_placeholder(&a.to) {
                return ("plan_transfer".into(), json!({"status":"err","code":"NeedRecipient","field":"to"}).to_string());
            }
            if is_placeholder(&a.amount_dec) {
                return ("plan_transfer".into(), json!({"status":"err","code":"NeedAmount","field":"amount_dec","example":"10"}).to_string());
            }

            // resolve token from allowlist (symbol/ledger optional)
            let (ledger_p, decimals, symbol) = match resolve_token(a.symbol.as_deref(), a.ledger.as_deref()) {
                Ok(t) => t,
                Err(_) => return ("plan_transfer".into(), json!({"status":"err","code":"BadToken","field":"symbol","options": token_symbols()}).to_string()),
            };

            // scale amount
            let amount = match scale_amount(&a.amount_dec, decimals) {
                Ok(n) => n,
                Err(err) => return ("plan_transfer".into(), json!({"status":"err","code":"BadAmount","field":"amount_dec","error": err,"example": example_for_decimals(decimals)}).to_string()),
            };

            // resolve recipient
            let (to_p, to_sub) = match resolve_to(&a.to) {
                Ok(v) => v,
                Err(err) => return ("plan_transfer".into(), json!({"status":"err","code":"BadRecipient","field":"to","error":err}).to_string()),
            };

            // memo
            let memo = a.memo.map(|m| {
                let caller = ic_cdk::api::caller();
                let payload = format!("{}|caller:{}", m, caller);
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

            // save last plan
            let caller = ic_cdk::api::caller();
            LAST_PLAN_BY_CALLER.with(|m| { m.borrow_mut().insert(caller, plan.clone()); });
            PLAN_BY_CHECKSUM.with(|m| { m.borrow_mut().insert(plan.checksum.clone(), plan.clone()); });

            ("plan_transfer".into(), serde_json::to_string(&plan).unwrap())
        }

        "confirm_transfer" => {
            // args boleh kosong; kalau kosong => ambil LAST_PLAN_BY_CALLER
            let parsed = tool_args_json(name, &args);

            let plan_from_params: Option<TransferPlan> = match parsed.get("plan") {
                Some(v) => match decode_plan_value(v) {
                    Ok(pp) => Some(pp),
                    Err(_) => None,
                },
                None => None,
            };

            let plan = if let Some(p) = plan_from_params {
                p
            } else {
                let caller = ic_cdk::api::caller();
                match LAST_PLAN_BY_CALLER.with(|m| m.borrow().get(&caller).cloned()) {
                    Some(p) => p,
                    None => return ("confirm_transfer".into(), json!({"status":"err","code":"MissingPlan","error":"no last plan"}).to_string()),
                }
            };

            // anti-replay
            let cs = plan.checksum.clone();
            let dup = EXECUTED_CHECKSUMS.with(|s| s.borrow().contains(&cs));
            if dup {
                return ("confirm_transfer".into(), json!({"status":"err","code":"Duplicate"}).to_string());
            }

            // execute ICRC-2 (non-custodial)
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
                    json!({ "status":"ok", "block_index": block_idx.to_string() })
                }
                Err(e) => json!({ "status":"err", "code":"ExecError", "error": e }),
            };
            ("confirm_transfer".into(), res.to_string())
        }

        "save_account" => {
            #[derive(Deserialize)] struct SaveArgs { alias: String, owner: String, sub: Option<Vec<u8>> }
            let parsed = tool_args_json(name, &args);
            let a: Result<SaveArgs, _> = serde_json::from_value(parsed);
            if let Err(e) = a {
                return ("save_account".into(), json!({"status":"err","code":"BadArgs","error":e.to_string()}).to_string());
            }
            let a = a.unwrap();
            let p = match Principal::from_text(&a.owner) {
                Ok(p) => p,
                Err(_) => return ("save_account".into(), json!({"status":"err","code":"BadPrincipal"}).to_string()),
            };
            let sub32 = if let Some(v) = a.sub {
                if v.len()!=32 { return ("save_account".into(), json!({"status":"err","code":"BadSub"}).to_string()); }
                let mut x=[0u8;32]; x.copy_from_slice(&v); Some(x)
            } else { None };
            let rec = SavedAccount { alias: a.alias.clone(), owner: p, subaccount: sub32 };
            ACCOUNTS.with(|m| { m.borrow_mut().insert(a.alias, rec); });
            ("save_account".into(), json!({"status":"ok"}).to_string())
        }

        "list_accounts" => {
            let v = ACCOUNTS.with(|m| serde_json::to_string(&m.borrow().values().cloned().collect::<Vec<_>>()).unwrap());
            ("list_accounts".into(), v)
        }

        _ => (name.to_string(), json!({"status":"err","error":"unknown tool"}).to_string()),
    }
}

// ===================== LANGUAGE GUARD =====================
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
fn lang_guard_system(lang: &str) -> OllamaMsg {
    let s = match lang {
        "id" => "BAHASA: Jawab dalam BAHASA INDONESIA saja. Jangan campur Inggris.",
        _    => "LANGUAGE: Answer in ENGLISH only. Do not mix Indonesian.",
    };
    OllamaMsg { role: "system".into(), content: s.to_string(), name: None }
}

// ================== OLLAMA SCHEMA (minimal) ==================
#[derive(Serialize, Clone)]
struct OllamaMsg {
    role: String,                 // system|user|assistant|tool
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,         // untuk role=tool
}

#[derive(Serialize)]
struct OllamaChatReq {
    model: String,
    messages: Vec<OllamaMsg>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<Value>,
    stream: bool,
    think: bool
}

#[derive(Deserialize, Clone)]
struct OllamaFunction { name: String, arguments: Value }

#[derive(Deserialize, Clone)]
struct OllamaToolCall {
    #[serde(default)] id: Option<String>,
    #[serde(default, rename="type")] kind: Option<String>,
    function: OllamaFunction,
}

#[derive(Deserialize)]
struct OllamaMessageResp {
    role: String,
    content: String,
    #[serde(default)]
    tool_calls: Vec<OllamaToolCall>,
}

#[derive(Deserialize)]
struct OllamaChatResp {
    #[serde(default)]
    message: Option<OllamaMessageResp>,  // Ollama format
    #[serde(default)]
    choices: Option<Vec<DeepSeekChoice>>, // DeepSeek/OpenAI format
}

impl OllamaChatResp {
    fn get_message(&self) -> Option<&OllamaMessageResp> {
        // Try Ollama format first
        if let Some(ref msg) = self.message {
            return Some(msg);
        }
        // Try DeepSeek/OpenAI format
        if let Some(ref choices) = self.choices {
            if let Some(choice) = choices.first() {
                return Some(&choice.message);
            }
        }
        None
    }
}

#[derive(Deserialize)]
struct DeepSeekChoice {
    message: OllamaMessageResp,
}

// ============ Tools ke format Ollama ============
fn build_ollama_tools() -> Value {
    json!([
      { "type": "function", "function": {
        "name": "plan_transfer",
        "description": "Plan a token transfer (non-custodial). Returns a TransferPlan+checksum.",
        "parameters": {
          "type": "object",
          "properties": {
            "to":         {"type":"string"},
            "amount_dec": {"type":"string"},
            "symbol":     {"type":"string"},
            "ledger":     {"type":"string"},
            "decimals":   {"type":"number"},
            "memo":       {"type":"string"}
          },
          "required": ["to","amount_dec"]
        }
      }},
      { "type": "function", "function": {
        "name": "confirm_transfer",
        "description": "Execute after user confirms (uses ICRC-2 transfer_from).",
        "parameters": {
          "type":"object",
          "properties": {
            "plan": {"type":"string"},
            "checksum": {"type":"string"}
          }
        }
      }},
      { "type": "function", "function": {
        "name": "save_account",
        "parameters": {
          "type":"object",
          "properties": {
            "alias":{"type":"string"},
            "owner":{"type":"string"},
            "sub":{"type":"string"}
          },
          "required":["alias","owner"]
        }
      }},
      { "type": "function", "function": {
        "name": "list_accounts",
        "description": "List saved accounts",
        "parameters": { "type":"object", "properties": {} }
      }}
    ])
}

// ============ Map ChatMessage (input) → OllamaMsg ============
fn initial_ollama_msgs(system_prompt: &str, lang_guard: &OllamaMsg, input: &[ChatMessage]) -> Vec<OllamaMsg> {
    let mut v = Vec::new();
    // gabungkan system_prompt + tool-proxy (jika perlu)
    let sp = if MODEL_SUPPORTS_TOOLS {
        system_prompt.to_string()
    } else {
        format!("{system_prompt}\n\n{}", tool_proxy_instructions())
    };
    v.push(OllamaMsg { role: "system".into(), content: sp, name: None });
    v.push(lang_guard.clone());
    // ... (sisanya tetap)
    for m in input {
        match m {
            ChatMessage::System { content } =>
                v.push(OllamaMsg { role: "system".into(), content: content.clone(), name: None })
                ,
            ChatMessage::User { content }   =>
                v.push(OllamaMsg { role: "user".into(),   content: content.clone(), name: None }),
            ChatMessage::Tool { content, .. } =>
                v.push(OllamaMsg { role: "tool".into(),   content: content.clone(), name: None }),
            ChatMessage::Assistant(_) =>
                v.push(OllamaMsg { role: "assistant".into(), content: String::new(), name: None }),
        }
    }
    v
}


// ============ Cap percakapan Ollama ============
const MAX_OLLAMA_MSGS: usize = 20; // termasuk 2 system awal
fn cap_ollama_msgs_in_place(conv: &mut Vec<OllamaMsg>) {
    if conv.len() <= MAX_OLLAMA_MSGS { return; }
    let first = conv.get(0).cloned();
    let second = conv.get(1).cloned();
    let keep = conv.split_off(conv.len().saturating_sub(MAX_OLLAMA_MSGS - 2));
    conv.clear();
    if let Some(a) = first { conv.push(a); }
    if let Some(b) = second { conv.push(b); }
    conv.extend(keep);
}

// ============ 1x panggilan /api/chat ke Ollama ============
// non-wasm (dev/off-chain): pakai reqwest
// #[cfg(not(target_arch = "wasm32"))]
// async fn ollama_chat_once(messages: Vec<OllamaMsg>, tools: Value) -> Result<OllamaChatResp, String> {
//     let body = OllamaChatReq {
//         model: OLLAMA_MODEL.to_string(),
//         messages,
//         tools: Some(tools),
//         options: Some(json!({ "temperature": 0.1 })),
//     };
//     let client = reqwest::Client::new();
//     let res = client.post(format!("{}/api/chat", OLLAMA_URL))
//         .json(&body)
//         .send().await.map_err(|e| e.to_string())?;
//     if !res.status().is_success() {
//         return Err(format!("ollama http status {}", res.status()));
//     }
//     res.json::<OllamaChatResp>().await.map_err(|e| e.to_string())
// }

#[cfg(target_arch = "wasm32")]
async fn ollama_chat_once(messages: Vec<OllamaMsg>, tools: Option<Value>) -> Result<OllamaChatResp, String> {
    use ic_cdk::api::management_canister::http_request::{
        CanisterHttpRequestArgument, HttpHeader, HttpMethod, TransformContext, http_request,
    };
        if let Ok(pretty) = serde_json::to_string_pretty(&messages) {
        ic_cdk::println!("[ollama] request messages:\n{pretty}");
    }

    // Get API configuration based on selected provider
    let api_config = get_api_config();
    
    // 3) Encode ke bytes dan log info ukuran
    let body = serde_json::to_vec(&messages).map_err(|e| e.to_string())?;
    ic_cdk::println!("[{}] body_len={} bytes", api_config.provider_name, body.len());
    // println!("messages{:?}", messages);
    // Batasi panjang output model supaya respons kecil
    let body = serde_json::to_vec(&OllamaChatReq {
        model: api_config.model.to_string(),
        messages,
        tools,
        options: Some(serde_json::json!({
            "temperature": 0.1,
            "max_tokens": 1000
        })),
         stream: false,
         think: false,
    }).map_err(|e| e.to_string())?;
    //  println!("body{}", serde_json::to_string(&).unwrap());   
// log!("[plan_transfer] raw_args={:?}", messages);
    // KECILKAN limit respons (biaya tergantung angka ini)
    let max_resp: u64 = 200_000; // 200 KB cukup untuk teks + tool_calls kecil

    // Try #1: kirim cycles "aman"
    let mut req = CanisterHttpRequestArgument {
        url: api_config.url.to_string(), // Dynamic API endpoint
        method: HttpMethod::POST,
        body: Some(body),
        max_response_bytes: Some(max_resp),
        transform: Some(TransformContext::from_name("transform_json".into(), vec![])),
        headers: vec![
            HttpHeader { name: "Content-Type".into(), value: "application/json".into() },
            HttpHeader { name: "Accept".into(),       value: "application/json".into() },
            HttpHeader { name: "Authorization".into(), value: format!("Bearer {}", api_config.api_key) },
        ],
    };

    let mut cycles: u128 = 25_000_000_000; // default awal

    match http_request(req.clone(), cycles).await {
        Ok((resp,)) => {
             ic_cdk::println!("[{}] status={} resp_len={}", api_config.provider_name, resp.status, resp.body.len());
            let preview = String::from_utf8_lossy(&resp.body);
            ic_cdk::println!("[{}] resp preview:\n{}", api_config.provider_name, &preview.chars().take(800).collect::<String>());
            let bytes = resp.body; // Vec<u8>


            return serde_json::from_slice::<OllamaChatResp>(&bytes).map_err(|e| e.to_string());
        }
        Err((_, msg)) => {
            // Kalau pesan error mengandung "X cycles are required", parse dan retry sekali
            if let Some(needed) = parse_required_cycles(&msg) {
                // kasih sedikit buffer
                cycles = needed.saturating_add(1_000_000_000);
                match http_request(req, cycles).await {
                    Ok((resp2,)) => {
                        ic_cdk::println!("[{}] status={} resp_len={}", api_config.provider_name, resp2.status, resp2.body.len());
                        let bytes = resp2.body;
                        // let preview = String::from_utf8_lossy(&resp.body);
                        // ic_cdk::println!("[ollama] resp preview:\n{}", &preview.chars().take(800).collect::<String>());
           
                        //  ic_cdk::println!("[ollama] resp preview:\n{}", &bytes.chars().take(800).collect::<String>());
                        return serde_json::from_slice::<OllamaChatResp>(&bytes).map_err(|e| e.to_string());
                    }
                    Err((code2, msg2)) => {
                        return Err(format!("http_request retry failed: {code2:?} {msg2}"));
                    }
                }
            } else {
                return Err(format!("http_request failed: {msg}"));
            }
        }
    }
}

// Parse angka "required cycles" dari pesan error
fn parse_required_cycles(msg: &str) -> Option<u128> {
    // contoh msg:
    // "http_request request sent with 10_000_000_000 cycles, but 20_865_176_800 cycles are required."
    let mut last: Option<u128> = None;
    for w in msg.split_whitespace() {
        // ambil token yang berisi digit/underscore
        let token: String = w.chars().filter(|c| c.is_ascii_digit() || *c == '_').collect();
        if token.is_empty() { continue; }
        // buang underscore lalu parse
        let digits: String = token.chars().filter(|c| c.is_ascii_digit()).collect();
        if let Ok(v) = digits.parse::<u128>() {
            last = Some(v);
        }
    }
    last
}

// Transform untuk HTTP outcall (sanitize headers)
#[query]
fn transform_json(args: ic_cdk::api::management_canister::http_request::TransformArgs)
-> ic_cdk::api::management_canister::http_request::HttpResponse {
    let mut r = args.response;
    r.headers.retain(|h| {
        let n = h.name.to_ascii_lowercase();
        n == "content-type" || n == "date"
    });
    r
}

// ============ CHAT ENTRYPOINT ============
#[update]
pub async fn copilot_chat(messages: Vec<ChatMessage>) -> String {
    // let tools = build_ollama_tools();
    let tools_opt = if MODEL_SUPPORTS_TOOLS { Some(build_ollama_tools()) } else { None };

    // language guard
    let lang = detect_lang_last_user(&messages);
    let lang_guard = lang_guard_system(lang);

    // rakit percakapan awal Ollama
    let mut conv = initial_ollama_msgs(SYSTEM_PROMPT, &lang_guard, &messages);

    let mut rounds = 0usize;
    let mut final_text = String::new();

    loop {
        rounds += 1;
        if rounds > 6 { break; }

        let resp = match ollama_chat_once(conv.clone(), tools_opt.clone()).await {
            Ok(r) => r,
            Err(e) => return format!("Ollama error: {e}"),
        };

        // Extract message from response (works with both Ollama and DeepSeek formats)
        let message = match resp.get_message() {
            Some(msg) => msg,
            None => return "Error: No message in response".to_string(),
        };

        // assistant text
        if !message.content.is_empty() {
            final_text = message.content.clone();
            conv.push(OllamaMsg { role: "assistant".into(), content: final_text.clone(), name: None });
        }

        // tool calls
       // ======== HANDLE TOOL CALLS =========
        if MODEL_SUPPORTS_TOOLS {
            if message.tool_calls.is_empty() { break; }
            for tc in message.tool_calls.iter() {
                let name = tc.function.name.as_str();
                let args_json = tc.function.arguments.clone();
                let (_id, result_json) = handle_tool_call_ollama(name, args_json).await;
                conv.push(OllamaMsg { role: "tool".into(), name: Some(name.to_string()), content: result_json });
            }
        } else {
            if let Some((name, args_json)) = extract_tool_call_from_text(&final_text) {
                ic_cdk::println!("[proxy tools] detected tool call: {}", name);
                let (_id, result_json) = handle_tool_call_ollama(&name, args_json).await;
                conv.push(OllamaMsg { role: "tool".into(), name: Some(name), content: result_json });
            } else {
                // Tidak ada tool-call → selesai
                break;
            }
        }

        cap_ollama_msgs_in_place(&mut conv);
    }

    final_text
}

fn extract_tool_call_from_text(s: &str) -> Option<(String, serde_json::Value)> {
    // 1) Cari tag <tool> ... </tool>
    if let (Some(a), Some(b)) = (s.find(TOOL_TAG_OPEN), s.find(TOOL_TAG_CLOSE)) {
        let start = a + TOOL_TAG_OPEN.len();
        let end = b;
        let inner = &s[start..end].trim();
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(inner) {
            let name = v.get("name")?.as_str()?.to_string();
            let args = v.get("arguments").cloned().unwrap_or(serde_json::json!({}));
            return Some((name, args));
        }
    }
    // 2) fallback: cari objek {"name": "...", "arguments": {...}} pertama di teks
    if let Some(idx) = s.find("{") {
        for end in (idx+1..=s.len()).rev() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s[idx..end]) {
                if let (Some(n), Some(args)) = (v.get("name"), v.get("arguments")) {
                    if let Some(name) = n.as_str() {
                        return Some((name.to_string(), args.clone()));
                    }
                }
            }
        }
    }
    None
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
