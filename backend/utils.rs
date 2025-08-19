use candid::{Nat, Principal};
use ic_llm::{ChatMessage, ToolCall};
use serde_json::{Map, Number, Value};
use num_bigint::BigUint;
use sha2::{Digest, Sha256};

use crate::{ACCOUNTS, log};
use crate::types::{TransferPlan, TOKENS};

/// Returns all allowlisted token symbols.
pub fn token_symbols() -> Vec<&'static str> {
    TOKENS.iter().map(|t| t.symbol).collect()
}

/// Resolve an alias or principal string to a [`Principal`] and optional subaccount.
pub fn resolve_to(to: &str) -> Result<(Principal, Option<[u8;32]>), String> {
    if let Ok(p) = Principal::from_text(to) { return Ok((p, None)); }
    ACCOUNTS.with(|m| {
        let m = m.borrow();
        if let Some(sa) = m.get(to) { Ok((sa.owner, sa.subaccount)) }
        else { Err(format!("alias/principal '{}' tidak ditemukan", to)) }
    })
}

/// Decode a JSON value into a [`TransferPlan`].
pub fn decode_plan_value(v: &Value) -> Result<TransferPlan, String> {
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

/// Resolve token from symbol or ledger based on the allowlist.
pub fn resolve_token(symbol_opt: Option<&str>, ledger_opt: Option<&str>)
    -> Result<(Principal, u8, String), String>
{
    if let Some(l) = ledger_opt {
        if let Some(t) = TOKENS.iter().find(|t| t.ledger == l) {
            log!("[resolve token] ledger={}", t.ledger);
            let p = Principal::from_text(t.ledger).map_err(|_| "ledger id invalid")?;
            return Ok((p, t.decimals, t.symbol.to_string()));
        } else { return Err("ledger tidak di-allowlist".into()); }
    }
    if let Some(sym) = symbol_opt {
        let s = sym.to_ascii_uppercase();
        if let Some(t) = TOKENS.iter().find(|t| t.symbol.eq_ignore_ascii_case(&s)) {
            log!("[resolve token] ledger={}", t.ledger);
            let p = Principal::from_text(t.ledger).map_err(|_| "ledger id invalid")?;
            return Ok((p, t.decimals, t.symbol.to_string()));
        }
        return Err("token tidak di-allowlist".into());
    }
    let t = &TOKENS[1];
    let p = Principal::from_text(t.ledger).map_err(|_| "ledger id invalid")?;
    Ok((p, t.decimals, t.symbol.to_string()))
}

/// Provide an example amount string for a given decimal precision.
pub fn example_for_decimals(decimals: u8) -> &'static str {
    if decimals == 0 { "10" } else { "0.5" }
}

/// Scale a human readable decimal amount into minimal units.
pub fn scale_amount(amount_dec: &str, decimals: u8) -> Result<Nat, String> {
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

/// Compute a checksum for a [`TransferPlan`].
pub fn plan_checksum(p: &TransferPlan) -> String {
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

/// Determine if a string is considered a placeholder value.
pub fn is_placeholder(s: &str) -> bool {
    let t = s.trim().to_ascii_lowercase();
    t.is_empty() || matches!(t.as_str(), "unknown" | "tbd" | "-" | "null" | "?" | "n/a")
}

/// Coerce a JSON value to a number when possible.
pub fn to_number(v: &Value) -> Option<Value> {
    match v {
        Value::Number(_) => Some(v.clone()),
        Value::String(s) => s.parse::<u64>().ok().map(Number::from).map(Value::Number),
        _ => None,
    }
}

/// Convert any JSON value to a string representation.
pub fn to_string(_raw: &str, v: &Value) -> Value {
    match v { Value::String(s) => Value::String(s.clone()), other => Value::String(other.to_string()) }
}

/// Parse tool call arguments into a JSON object for easier handling.
pub fn tool_args_json(call: &ToolCall) -> Value {
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

/// Maximum number of messages kept in conversation (including system message).
pub const MAX_MESSAGES: usize = 10;

/// Trim the conversation to the most recent [`MAX_MESSAGES`] messages in place.
pub fn cap_messages_in_place(convo: &mut Vec<ChatMessage>) {
    if convo.len() <= MAX_MESSAGES { return; }
    let system = convo.first().cloned();
    let keep = convo.split_off(convo.len().saturating_sub(MAX_MESSAGES - 1));
    convo.clear();
    if let Some(sys) = system { convo.push(sys); }
    convo.extend(keep);
}

/// Heuristic to detect the language of the last user message.
pub fn detect_lang_last_user(msgs: &[ChatMessage]) -> &'static str {
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

/// Construct a language guard system message for the given language code.
pub fn lang_guard(lang: &str) -> ChatMessage {
    let s = match lang {
        "id" => "BAHASA: Jawab dalam BAHASA INDONESIA saja. Jangan campur Inggris.",
        _    => "LANGUAGE: Answer in ENGLISH only. Do not mix Indonesian.",
    };
    ChatMessage::System { content: s.to_string() }
}

