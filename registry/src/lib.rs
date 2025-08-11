use ic_cdk::{query, update};
use std::cell::RefCell;
use std::collections::BTreeMap;

thread_local! {
    static REGISTRY: RefCell<BTreeMap<String, String>> = RefCell::new(BTreeMap::new());
}

#[update]
fn add_tool(spec_json: String) -> Result<(), String> {
    // minimal sanity: must contain "name"
    let v: serde_json::Value = serde_json::from_str(&spec_json).map_err(|e| e.to_string())?;
    let name = v.get("name").and_then(|x| x.as_str()).ok_or("spec must contain string field 'name'")?;
    REGISTRY.with(|r| r.borrow_mut().insert(name.to_string(), spec_json));
    Ok(())
}

#[update]
fn update_tool(spec_json: String) -> Result<(), String> {
    add_tool(spec_json)
}

#[query]
fn list_tools() -> Vec<String> {
    REGISTRY.with(|r| r.borrow().keys().cloned().collect())
}

#[query]
fn get_tool(name: String) -> Option<String> {
    REGISTRY.with(|r| r.borrow().get(&name).cloned())
}

#[query]
fn get_manifest() -> String {
    // Kirim array ringkas untuk LLM (name + description + args_schema bila ada)
    let arr: Vec<serde_json::Value> = REGISTRY.with(|r| {
        r.borrow()
            .values()
            .map(|s| {
                let v: serde_json::Value =
                    serde_json::from_str(s).unwrap_or_else(|_| serde_json::json!({}));

                let name = v
                    .get("name")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();

                let desc = v
                    .get("description")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();

                let args = v
                    .get("args_schema")
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));

                serde_json::json!({
                    "name": name,
                    "description": desc,
                    "args": args
                })
            })
            .collect()
    });

    serde_json::to_string(&arr).unwrap()
}


ic_cdk::export_candid!();
