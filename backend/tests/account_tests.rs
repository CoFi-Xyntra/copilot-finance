#[path = "../account.rs"]
mod account;

#[test]
fn test_create_and_get_accounts() {
    assert_eq!(account::create_account("addr1".into()), "Account created");
    assert_eq!(account::create_account("addr1".into()), "Already exists");
    let accounts = account::get_accounts();
    assert_eq!(accounts, vec!["addr1".to_string()]);
}
