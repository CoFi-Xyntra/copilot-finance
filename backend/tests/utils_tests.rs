use candid::{Nat, Principal};
use ic_llm::{ChatMessage, ToolCall};

use backend::utils::*;
use backend::types::TransferPlan;
use backend::save_account;

#[test]
fn test_token_symbols() {
    let syms = token_symbols();
    assert!(syms.contains(&"ICP"));
}

#[test]
fn test_resolve_to_alias_and_principal() {
    let alias = "bob_alias";
    save_account(alias.into(), Principal::anonymous().to_text(), None).unwrap();
    let (p, sub) = resolve_to(alias).unwrap();
    assert_eq!(p, Principal::anonymous());
    assert!(sub.is_none());
    let (p2, _) = resolve_to(&Principal::anonymous().to_text()).unwrap();
    assert_eq!(p2, Principal::anonymous());
}

#[test]
fn test_decode_plan_value() {
    let plan = sample_plan();
    let v = serde_json::to_value(&plan).unwrap();
    let decoded = decode_plan_value(&v).unwrap();
    assert_eq!(decoded.checksum, plan.checksum);
}

fn sample_plan() -> TransferPlan {
    let mut plan = TransferPlan {
        from_owner: Some(Principal::anonymous()),
        from_sub: None,
        to_principal: Principal::anonymous(),
        to_sub: None,
        amount: Nat::from(10u32),
        symbol: "CFXN".to_string(),
        ledger: Principal::management_canister(),
        memo: None,
        created_at_time: 1,
        human_readable: "Send".into(),
        checksum: String::new(),
    };
    plan.checksum = plan_checksum(&plan);
    plan
}

#[test]
fn test_resolve_token() {
    let (p, d, s) = resolve_token(Some("CFXN"), None).unwrap();
    assert_eq!(d, 0);
    assert_eq!(s, "CFXN");
    assert_eq!(p.to_text(), "mxzaz-hqaaa-aaaar-qaada-cai");
}

#[test]
fn test_example_for_decimals() {
    assert_eq!(example_for_decimals(0), "10");
    assert_eq!(example_for_decimals(8), "0.5");
}

#[test]
fn test_scale_amount() {
    assert_eq!(scale_amount("1.5", 1).unwrap(), Nat::from(15u32));
    assert!(scale_amount("1.23", 1).is_err());
}

#[test]
fn test_plan_checksum() {
    let plan = sample_plan();
    let cs = plan_checksum(&plan);
    assert_eq!(cs.len(), 16);
}

#[test]
fn test_is_placeholder() {
    assert!(is_placeholder("?"));
    assert!(!is_placeholder("value"));
}

#[test]
fn test_to_number_and_string() {
    use serde_json::Value;
    assert_eq!(to_number(&Value::String("7".into())), Some(Value::Number(7.into())));
    assert_eq!(to_string("raw", &Value::Bool(true)), Value::String("true".into()));
}

#[test]
fn test_tool_args_json() {
    let json = r#"{
        "id":"1",
        "function":{
            "name":"plan_transfer",
            "arguments":[
                {"name":"to","value":"\"alice\""},
                {"name":"amount_dec","value":"\"10\""},
                {"name":"decimals","value":"8"}
            ]
        }
    }"#;
    let call: ToolCall = serde_json::from_str(json).unwrap();
    let v = tool_args_json(&call);
    assert_eq!(v["to"], "alice");
    assert_eq!(v["decimals"], 8);
}

#[test]
fn test_cap_messages_in_place_and_lang() {
    let mut msgs: Vec<ChatMessage> = vec![ChatMessage::System { content: "sys".into() }];
    for _ in 0..12 {
        msgs.push(ChatMessage::User { content: "hi".into() });
    }
    cap_messages_in_place(&mut msgs);
    assert!(msgs.len() <= MAX_MESSAGES);

    let lang = detect_lang_last_user(&msgs);
    assert_eq!(lang, "en");
    let guard = lang_guard(lang);
    if let ChatMessage::System { content } = guard { assert!(content.contains("ENGLISH")); } else { panic!(); }
}
