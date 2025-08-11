use candid::{CandidType, Nat, Principal};
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update};
use serde::{Deserialize as De, Serialize as Se};
use std::cell::RefCell;
use std::collections::BTreeMap;

// =======================================
// Types
// =======================================

#[derive(CandidType, Se, De, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<Vec<u8>>, // 32 bytes if Some
}

#[derive(CandidType, De, Clone)]
pub struct TransferArgs {
    pub from_subaccount: Option<Vec<u8>>,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(Se, De, Clone)]
struct State {
    balances: BTreeMap<Account, Nat>,
    next_block: u128,
    admin: Principal,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State {
        balances: BTreeMap::new(),
        next_block: 0,
        admin: Principal::anonymous(),
    });
}

// #[derive(CandidType, De)]
// pub struct InitArg {
//     pub mint_to: Account,
//     pub amount: Nat,
// }

// // =======================================
// // Lifecycle
// // =======================================

// #[init]
// fn init(arg: InitArg) {
//     STATE.with(|s| {
//         let mut st = s.borrow_mut();
//         st.admin = ic_cdk::caller();
//         st.balances.insert(arg.mint_to, arg.amount);
//     });
// }

#[derive(CandidType, De)]
pub struct InitArg {
    pub mint_to: Account,
    pub amount: Nat,
}

#[init]
fn init(arg: Option<InitArg>) {
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        st.admin = ic_cdk::caller();
        if let Some(a) = arg {
            st.balances.insert(a.mint_to, a.amount);
        }
    });
}


#[pre_upgrade]
fn pre_upgrade_hook() {
    let st = STATE.with(|s| s.borrow().clone());
    let bytes = bincode::serialize(&st).expect("serialize state");
    ic_cdk::storage::stable_save((bytes,)).expect("stable save");
}

#[post_upgrade]
fn post_upgrade_hook() {
    if let Ok((bytes,)) = ic_cdk::storage::stable_restore::<(Vec<u8>,)>() {
        let st: State = bincode::deserialize(&bytes).expect("deserialize state");
        STATE.with(|s| *s.borrow_mut() = st);
    }
}

// =======================================
// Queries & Updates
// =======================================

#[query]
fn icrc1_balance_of(account: Account) -> Nat {
    STATE.with(|s| s.borrow().balances.get(&account).cloned().unwrap_or_else(|| Nat::from(0u32)))
}

#[update]
fn mint_to(account: Account, amount: Nat) -> Result<Nat, String> {
    STATE.with(|s| {
        if ic_cdk::caller() != s.borrow().admin {
            return Err("only admin can mint".into());
        }
        let mut st = s.borrow_mut();
        let bal = st.balances.entry(account).or_insert_with(|| Nat::from(0u32));
        *bal += amount.clone();
        Ok(bal.clone())
    })
}

#[update]
async fn icrc1_transfer(args: TransferArgs) -> Result<Nat, String> {
    STATE.with(|s| {
        let mut st = s.borrow_mut();

        let from = Account {
            owner: ic_cdk::caller(),
            subaccount: args.from_subaccount.clone(),
        };

        let amount = args.amount.clone();
        if amount == Nat::from(0u32) {
            return Err("amount must be > 0".into());
        }

        let from_bal = st.balances.get(&from).cloned().unwrap_or_else(|| Nat::from(0u32));
        if from_bal < amount {
            return Err("insufficient funds".into());
        }

        // debit
        st.balances.insert(from.clone(), from_bal - amount.clone());

        // credit
        let to_bal = st.balances.get(&args.to).cloned().unwrap_or_else(|| Nat::from(0u32));
        st.balances.insert(args.to, to_bal + amount);

        // block index mock
        let blk = st.next_block;
        st.next_block += 1;
        Ok(Nat::from(blk))
    })
}

// =======================================
// Candid
// =======================================

ic_cdk::export_candid!();
