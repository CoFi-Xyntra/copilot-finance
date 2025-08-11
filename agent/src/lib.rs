use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::{query, update};
use ic_llm::{ChatMessage, Model};
use serde::{Deserialize as De, Serialize as Se};
use sha2::{Digest, Sha256};
use data_encoding::BASE32_NOPAD;
use std::cell::RefCell;
use std::collections::BTreeMap;

// ================== PENDING INTENT STATE ==================

const TTL_NS: u64 = 5 * 60 * 1_000_000_000; // 5 menit
const CODE_LEN: usize = 4;

#[derive(Se, De, Clone, Debug)]
struct DraftIntent {
    tool_name: String,
    args: serde_json::Value,   // {"to_owner": "...", "amount": "...", "memo": "..."}
    natural_summary: String,
}

#[derive(Se, De, Clone, Debug)]
struct Pending {
    owner: Principal,
    tool_name: String,
    args: serde_json::Value,
    created_ns: u64,
    executed: bool,
    block_index: Option<Nat>,
    code: String,
}

thread_local! {
    static PENDING: RefCell<BTreeMap<String, Pending>> = RefCell::new(BTreeMap::new());
    static SECRET: RefCell<String> = RefCell::new(String::new());
}

#[ic_cdk::init]
fn init() {
    SECRET.with(|s| *s.borrow_mut() = format!("{}-{}", ic_cdk::caller().to_text(), ic_cdk::api::time()));
}

fn now_ns() -> u64 { ic_cdk::api::time() }
fn gen_intent_id() -> String { format!("i-{}", now_ns()) }
fn confirm_code(intent_id: &str) -> String {
    let sec = SECRET.with(|s| s.borrow().clone());
    let mut h = Sha256::new();
    h.update(sec.as_bytes());
    h.update(intent_id.as_bytes());
    let b = h.finalize();
    let b32 = BASE32_NOPAD.encode(&b);
    format!("#{}", &b32[..CODE_LEN])
}
fn msg_contains_code(msg: &str, code: &str) -> bool {
    msg.to_ascii_uppercase().contains(&code.to_ascii_uppercase())
}

// ================== REGISTRY API ==================

#[derive(Se, De, Clone, Debug)]
struct ToolSpec {
    name: String,
    description: String,
    canister_id: String,
    method: String,
    args_schema: serde_json::Value,
    safety: serde_json::Value,
    ui_hints: serde_json::Value,
    return_shape: Option<String>,
}

async fn fetch_manifest(registry: Principal) -> Result<Vec<serde_json::Value>, String> {
    use ic_cdk::api::call::call;
    let (json_str,): (String,) = call(registry, "get_manifest", ()).await
        .map_err(|e| format!("registry error: {:?}", e))?;
    serde_json::from_str(&json_str).map_err(|e| e.to_string())
}
async fn fetch_tool(registry: Principal, name: &str) -> Result<ToolSpec, String> {
    use ic_cdk::api::call::call;
    let (opt,): (Option<String>,) = call(registry, "get_tool", (name.to_string(),)).await
        .map_err(|e| format!("registry error: {:?}", e))?;
    let s = opt.ok_or("tool not found")?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

// ================== PLANNER (LLM) ==================

async fn plan_with_llm(prompt_str: String, manifest: Vec<serde_json::Value>) -> Result<DraftIntent, String> {
    let sys = r#"
You are a planner. Given a user request and a list of tools (name, description, args),
pick ONE tool that best accomplishes the task and output EXACT JSON:

{
  "tool_name": "<tool name>",
  "args": { ... fill fields as strings ... },
  "natural_summary": "<short human confirmation sentence>"
}

Rules:
- Output only one JSON object inside ```json ... ``` and nothing else.
- If the request is not solvable with provided tools, explain briefly in 'natural_summary' and set tool_name to "".
"#;

    let manifest_str = serde_json::to_string(&manifest).unwrap();
    let msgs = vec![
        ChatMessage::System { content: sys.into() },
        ChatMessage::System { content: format!("TOOLS_MANIFEST={manifest_str}") },
        ChatMessage::User   { content: prompt_str },
    ];

    let resp = ic_llm::chat(Model::Llama3_1_8B).with_messages(msgs).send().await;
    let text = resp.message.content.unwrap_or_default();

    // cari blok ```json ... ```
    let start = text.find("```json").ok_or("no json block")?;
    let rest = &text[start + 7..];
    let end = rest.find("```").ok_or("no json closing")?;
    let json = &rest[..end];

    serde_json::from_str::<DraftIntent>(json).map_err(|_| "invalid planner json".into())
}

// ================== EXECUTOR (ICRC-1 mock default) ==================

#[derive(CandidType, Deserialize)]
struct Account { owner: Principal, subaccount: Option<Vec<u8>> }
#[derive(CandidType, Deserialize)]
struct CallArgs {
    from_subaccount: Option<Vec<u8>>,
    to: Account,
    amount: Nat,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

async fn execute(spec: &ToolSpec, args: &serde_json::Value) -> Result<Nat, String> {
    use ic_cdk::api::call::call;
    use std::str::FromStr;

    let can = Principal::from_text(&spec.canister_id).map_err(|e| e.to_string())?;

    // map args → candid
    let to_owner = Principal::from_text(args["to_owner"].as_str().ok_or("to_owner")?)
        .map_err(|e| e.to_string())?;
    let amount: Nat = args["amount"].as_str().ok_or("amount")?
        .parse().map_err(|_| "amount not nat".to_string())?;
    let memo = args.get("memo").and_then(|v| v.as_str()).map(|s| s.as_bytes().to_vec());

    let call_args = (CallArgs {
        from_subaccount: None,
        to: Account { owner: to_owner, subaccount: None },
        amount, fee: None, memo, created_at_time: None
    },);

    match spec.return_shape.as_deref() {
        // Untuk ledger ICRC-1 asli (variant { Ok; Err })
        Some("variant_ok_err") => {
            // Contoh decode: sesuaikan dengan DID ledger aslimu
            // let (res,): (YourVariant,) = call(can, &spec.method, call_args).await
            //     .map_err(|e| format!("call error: {:?}", e))?;
            // match res { YourVariant::Ok(n) => Ok(n), YourVariant::Err(e) => Err(format!("{:?}", e)) }
            Err("variant_ok_err mapping not implemented in sample".into())
        }
        _ => {
            // default: mock -> Result<Nat,String>
            let (res,): (Result<Nat,String>,) = call(can, &spec.method, call_args).await
                .map_err(|e| format!("call error: {:?}", e))?;
            res
        }
    }
}

// ================== PUBLIC ENDPOINT ==================

#[update]
async fn handle_prompt(registry_id: String, user_prompt: String) -> String {
    let registry = match Principal::from_text(registry_id) {
        Ok(p) => p, Err(_) => return "❌ registry id invalid".into(),
    };
    let caller = ic_cdk::caller();
    let utter = user_prompt.trim();

    // 1) Cek konfirmasi via kode mini
    if let Some((intent_id, p)) = PENDING.with(|m| {
        let map = m.borrow();
        map.iter()
            .rev()
            .find(|(_, pend)| pend.owner == caller && !pend.executed && now_ns() - pend.created_ns <= TTL_NS)
            .map(|(k, v)| (k.clone(), v.clone()))
    }) {
        if msg_contains_code(utter, &p.code) {
            // eksekusi
            let spec = match fetch_tool(registry, &p.tool_name).await {
                Ok(s) => s, Err(e) => return format!("❌ tool fetch error: {e}"),
            };
            match execute(&spec, &p.args).await {
                Ok(block) => {
                    PENDING.with(|m| if let Some(pp) = m.borrow_mut().get_mut(&intent_id) {
                        pp.executed = true; pp.block_index = Some(block.clone());
                    });
                    return format!("✅ Terkirim. Block index: {block}");
                }
                Err(e) => return format!("❌ Gagal: {e}"),
            }
        }
    }

    // 2) Plan pakai manifest dari registry
    let manifest = match fetch_manifest(registry).await {
        Ok(m) => m, Err(e) => return format!("❌ registry error: {e}"),
    };
    let draft = match plan_with_llm(utter.to_string(), manifest).await {
        Ok(d) => d, Err(e) => return format!("❌ planner error: {e}"),
    };

    if draft.tool_name.is_empty() {
        return draft.natural_summary;
    }

    // 3) Simpan pending + kode mini
    let intent_id = gen_intent_id();
    let code = confirm_code(&intent_id);
    PENDING.with(|m| {
        m.borrow_mut().insert(intent_id.clone(), Pending {
            owner: caller,
            tool_name: draft.tool_name.clone(),
            args: draft.args.clone(),
            created_ns: now_ns(),
            executed: false,
            block_index: None,
            code: code.clone(),
        });
    });

    format!(
        "{summary}\n\nBalas apa pun yang mengandung kode ini untuk konfirmasi: **{code}** (5 menit)",
        summary = draft.natural_summary,
        code = code
    )
}

// (opsional) untuk debugging ringan
#[query]
fn pending_count() -> usize {
    PENDING.with(|m| m.borrow().len())
}

ic_cdk::export_candid!();
