use candid::{Nat, Principal};

use crate::{types::ICPSWAP_FACTORY, IcsError, IcsGetPoolArgs, IcsPoolData, IcsToken, TokenEntry, TOKENS};

pub fn resolve_token_entry(sym: &str) -> Result<&'static TokenEntry, String> {
    TOKENS.iter().find(|t| t.symbol.eq_ignore_ascii_case(sym))
        .ok_or_else(|| format!("token '{}' tidak di-allowlist", sym))
}

pub async fn icpswap_get_pool(sell: &TokenEntry, buy: &TokenEntry, fee_bps: u32)
-> Result<IcsPoolData, String> {
    let factory = Principal::from_text(ICPSWAP_FACTORY).map_err(|_| "factory id invalid")?;
    let args = IcsGetPoolArgs {
        fee: Nat::from(fee_bps as u32),
        token0: IcsToken { address: sell.ledger.into(), standard: sell.standard.into() },
        token1: IcsToken { address: buy.ledger.into(),  standard: buy.standard.into() },
    };
    // getPool(token0, token1) – urutan input tidak masalah (docs), tapi kita kirim sell/buy
    let (res,): (Result<IcsPoolData, IcsError>,) =
        ic_cdk::call(factory, "getPool", (args,))
        .await
        .map_err(|e| format!("getPool call fail: {e:?}"))?;
    res.map_err(|_| "pool not found / unsupported".to_string())
}
