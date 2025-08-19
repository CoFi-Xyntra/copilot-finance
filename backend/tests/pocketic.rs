use candid::{Decode, Encode, Principal};
use pocket_ic::PocketIc;
use backend::types::SavedAccount;

fn ensure_wasm() {
    let wasm_path = std::path::Path::new("../target/wasm32-unknown-unknown/release/backend.wasm");
    if !wasm_path.exists() {
        let status = std::process::Command::new("cargo")
            .args(["build", "--target", "wasm32-unknown-unknown", "--release", "-p", "backend"])
            .status()
            .expect("failed to build wasm");
        assert!(status.success());
    }
}

fn setup_pic() -> (PocketIc, Principal) {
    ensure_wasm();
    let wasm = std::fs::read("../target/wasm32-unknown-unknown/release/backend.wasm").expect("wasm not found");
    let pic = PocketIc::new();
    let canister_id = pic.create_canister();
    pic.add_cycles(canister_id, 2_000_000_000_000u128);
    pic.install_canister(canister_id, wasm, vec![], None);
    (pic, canister_id)
}

#[test]
fn pocket_ic_save_and_list_accounts() {
    let (pic, canister_id) = setup_pic();

    let alias = "alice".to_string();
    let owner = Principal::anonymous().to_text();
    let args = Encode!(&alias, &owner, &Option::<Vec<u8>>::None).unwrap();
    let reply = pic
        .update_call(canister_id, Principal::anonymous(), "save_account", args)
        .unwrap();
    let res: Result<(), String> = Decode!(&reply, Result<(), String>).unwrap();
    assert!(res.is_ok());

    let res_bytes = pic
        .query_call(
            canister_id,
            Principal::anonymous(),
            "list_accounts",
            Encode!().unwrap(),
        )
        .unwrap();
    let accounts: Vec<SavedAccount> = Decode!(&res_bytes, Vec<SavedAccount>).unwrap();
    assert_eq!(accounts.len(), 1);
    assert_eq!(accounts[0].alias, "alice");
}

#[test]
fn pocket_ic_save_account_errors() {
    let (pic, canister_id) = setup_pic();

    // invalid principal text
    let alias = "bad".to_string();
    let owner = "not-a-principal".to_string();
    let args = Encode!(&alias, &owner, &Option::<Vec<u8>>::None).unwrap();
    let reply = pic
        .update_call(canister_id, Principal::anonymous(), "save_account", args)
        .unwrap();
    let res: Result<(), String> = Decode!(&reply, Result<(), String>).unwrap();
    assert!(matches!(res, Err(ref e) if e.contains("principal invalid")));

    // no accounts should be saved after the error above
    let res_bytes = pic
        .query_call(
            canister_id,
            Principal::anonymous(),
            "list_accounts",
            Encode!().unwrap(),
        )
        .unwrap();
    let accounts: Vec<SavedAccount> = Decode!(&res_bytes, Vec<SavedAccount>).unwrap();
    assert!(accounts.is_empty());
}
