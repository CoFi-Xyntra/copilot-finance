use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::transfer::Memo;
use serde::{Deserialize, Serialize};

/// Allowlisted token configuration.
#[derive(Clone, Debug)]
pub struct TokenEntry {
    /// Human readable token symbol (e.g. "ICP").
    pub symbol: &'static str,
    /// Principal text of the token's ledger canister.
    pub ledger: &'static str,
    /// Number of decimal places used by the token.
    pub decimals: u8,
}

/// Tokens permitted for transfers.
pub const TOKENS: &[TokenEntry] = &[
    TokenEntry { symbol: "ICP",  ledger: "<LEDGER_ICP_ID>",      decimals: 8 },
    TokenEntry { symbol: "CFX", ledger: "umunu-kh777-77774-qaaca-cai",     decimals: 0 },
];

/// Stored reference to a user account alias.
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct SavedAccount {
    /// Alias name chosen by the user.
    pub alias: String,
    /// Account owner principal.
    pub owner: Principal,
    /// Optional ICRC subaccount.
    pub subaccount: Option<[u8; 32]>,
}

/// Arguments required to build a [`TransferPlan`].
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct PlanArgs {
    /// Recipient principal text or saved alias.
    pub to: String,
    /// Amount represented as a decimal string (e.g. "0.5").
    pub amount_dec: String,
    /// Optional token symbol override.
    pub symbol: Option<String>,
    /// Optional ledger canister id override.
    pub ledger: Option<String>,
    /// Optional explicit decimals for the token.
    pub decimals: Option<u8>,
    /// Optional memo string.
    pub memo: Option<String>,
}

/// Planned transfer returned from `plan_transfer`.
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct TransferPlan {
    /// Source owner provided by caller (ICRC-2).
    pub from_owner: Option<Principal>,
    /// Source subaccount if any.
    pub from_sub:   Option<[u8; 32]>,
    /// Destination principal.
    pub to_principal: Principal,
    /// Destination subaccount if any.
    pub to_sub: Option<[u8; 32]>,
    /// Amount in minimal units.
    pub amount: Nat,
    /// Canonical token symbol.
    pub symbol: String,
    /// Ledger canister handling the token.
    pub ledger: Principal,
    /// Optional memo attached to the transfer.
    pub memo: Option<Memo>,
    /// Creation timestamp in nanoseconds.
    pub created_at_time: u64,
    /// Human friendly description of the transfer.
    pub human_readable: String,
    /// Checksum for replay protection.
    pub checksum: String,
}

