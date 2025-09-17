use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::transfer::Memo;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Allowlisted token configuration.
#[derive(Clone, Debug)]
pub struct TokenEntry {
    /// Human readable token symbol (e.g. "ICP").
    pub symbol: &'static str,
    /// Principal text of the token's ledger canister.
    pub ledger: &'static str,
    /// Number of decimal places used by the token.
    pub decimals: u8,
    pub standard: &'static str
}
const OLLAMA_URL: &str = "http://127.0.0.1:11434"; // untuk non-wasm/dev
const OLLAMA_HTTPS_PROXY: &str = "https://your-proxy.example.com/api/chat"; // <-- pakai ini di wasm
const OLLAMA_MODEL: &str = "deepseek-r1:8b";

pub const ICPSWAP_FACTORY: &str = "vpyes-67777-77774-qaaeq-cai";
// "4mmnk-kiaaa-aaaag-qbllq-cai"; // SwapFactory mainnet (docs)
pub const DEFAULT_POOL_FEE_BPS: u32 = 3000; // 0.3%
/// Tokens permitted for transfers.
pub const TOKENS: &[TokenEntry] = &[
    TokenEntry { symbol: "ICP",  ledger: "<LEDGER_ICP_ID>",      decimals: 8, standard: "ICP" },
    TokenEntry { symbol: "CFX", ledger: "umunu-kh777-77774-qaaca-cai",     decimals: 0, standard: "ICRC2" },
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
    message: OllamaMessageResp,
}

// ========================== SWAP 
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
struct IcsToken { address: String, standard: String }

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
struct IcsGetPoolArgs { fee: Nat, token0: IcsToken, token1: IcsToken }

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
struct IcsPoolData {
    fee: Nat,
    key: String,
    tickSpacing: i128,
    token0: IcsToken,
    token1: IcsToken,
    canisterId: Principal, // SwapPool canister
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
struct IcsSwapArgs {
    amountIn: String,          // text nat
    zeroForOne: bool,
    amountOutMinimum: String,  // text nat
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
enum IcsError { CommonError, InsufficientFunds, InternalError(String), UnsupportedToken(String) }

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
enum IcsResultNat { ok(Nat), err(IcsError) }
