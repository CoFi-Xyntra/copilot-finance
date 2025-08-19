import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Principal } from "@dfinity/principal";
import { HttpAgent, Actor } from "@dfinity/agent";
import { LedgerCanister } from "@dfinity/ledger-icp";

declare global {
  interface Window {
    ic?: {
      plug?: {
        isConnected: () => Promise<boolean> | boolean;
        requestConnect: (opts: {
          whitelist?: string[];
          host?: string;                 // ex: "https://ic0.app" (mainnet) | "http://127.0.0.1:4943" (local)
          timeout?: number;              // ms
          keyType?: "Ed25519" | "secp256k1";
        }) => Promise<boolean>;
        createActor: <T>(opts: {
          canisterId: string;
          interfaceFactory: any;
        }) => Promise<T>;
        getPrincipal: () => Promise<{ toText: () => string }>;

        // Optional (tergantung versi Plug):
        disconnect?: () => Promise<void>;
        agent?: any;
        requestBalance?: (opts?: { host?: string }) => Promise<any>;
        requestImportToken?: (opts: {
          canisterId: string;
          symbol: string;
          standard: "ICRC1" | "ICRC2" | "DIP20" | string;
          logo?: string;
        }) => Promise<void>;
      };
    };
  }
}

// ==== Types publik hook ====
export type PlugState = {
  available: boolean;            // extension terpasang?
  connected: boolean;            // sudah connect ke situs ini?
  principal?: string;            // principal wallet user
  error?: string | null;
};

export type LedgerConfig = {
  canisterId: string;            // canister ledger (ICRC-1)
  label?: string;                // optional label di UI
};

export type AssetBalance = {
  canisterId: string;
  symbol: string;
  decimals: number;
  raw: string;                   // nilai nat asli (stringified)
  display: string;               // human readable (formatUnits)
  label?: string;
};

export type ConnectOptions = {
  whitelist?: string[];          // daftar canister (ledger, backend, dll.)
  host?: string;                 // "https://ic0.app" (mainnet) | "http://127.0.0.1:4943" (local)
  timeout?: number;              // default 60_000
  keyType?: "Ed25519" | "secp256k1";
  ledgers?: LedgerConfig[];      // daftar ledger ICRC-1 utk di-scan
};

const DEFAULT_HOST = "http://127.0.0.1:4943";

// Minimal IDL untuk ICRC-1 (symbol, decimals, balance_of)
const icrc1IdlFactory = ({ IDL }: any) => {
  const Sub = IDL.Vec(IDL.Nat8);
  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(Sub),
  });
    const Icrc1Value = IDL.Variant({
    Nat: IDL.Nat,
    Int: IDL.Int,
    Text: IDL.Text,
    Blob: IDL.Vec(IDL.Nat8),
    Bool: IDL.Bool,
  });
  return IDL.Service({
    icrc1_symbol: IDL.Func([], [IDL.Text], ["update"]),
    icrc1_decimals: IDL.Func([], [IDL.Nat8], ["update"]),
     icrc1_metadata: IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, Icrc1Value))], ["update"]),

    icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ["composite_query"]),
  });
};

// utils
const toDecimalString = (raw: bigint, decimals: number) => {
  const s = raw.toString();
  if (decimals === 0) return s;
  const pad = Math.max(decimals - s.length + 1, 0);
  const whole = s.length > decimals ? s.slice(0, -decimals) : "0";
  const frac = (pad ? "0".repeat(pad) : "") + s.slice(-decimals).padStart(decimals, "0");
  const trimmedFrac = frac.replace(/0+$/, "");
  return trimmedFrac ? `${whole}.${trimmedFrac}` : whole;
};

const resolveBool = async (v: boolean | Promise<boolean>) => Promise.resolve(v);

export function usePlug(defaultOpts?: ConnectOptions) {
  const [state, setState] = useState<PlugState>({
    available: typeof window !== "undefined" && !!window.ic?.plug,
    connected: false,
    principal: undefined,
    error: null,
  });

  // simpan daftar ledger yang akan discan (bisa di-set via connect / defaultOpts)
  const ledgersRef = useRef<LedgerConfig[]>(defaultOpts?.ledgers ?? []);

  // ============= refresh status (dipakai saat mount) =============
  const refresh = useCallback(async () => {
    try {
      const available = !!window.ic?.plug;
      if (!available) {
        setState(s => ({ ...s, available: false, connected: false, principal: undefined }));
        return;
      }
      const connected = await resolveBool(window.ic!.plug!.isConnected());
      let principal: string | undefined;
      if (connected) {
        const p = await window.ic!.plug!.getPrincipal();
        principal = p?.toText?.();
      }
      setState({ available, connected, principal, error: null });
    } catch (e: any) {
      setState(s => ({ ...s, error: e?.message ?? String(e) }));
    }
  }, []);

  // ============= connect =============
  const connect = useCallback(
    async (opts?: ConnectOptions) => {
      try {
        const available = !!window.ic?.plug;
        if (!available) throw new Error("Plug extension not found");

        // gabung whitelist:
        const combinedLedgers = opts?.ledgers ?? defaultOpts?.ledgers ?? ledgersRef.current ?? [];
        if (combinedLedgers.length) ledgersRef.current = combinedLedgers.slice();

        const autoWhitelist = combinedLedgers.map(l => l.canisterId);
        const merged: ConnectOptions = {
          timeout: 60_000,
        //   defaultOpts?.host ?? 
          host: DEFAULT_HOST,
          whitelist: Array.from(new Set([...(defaultOpts?.whitelist ?? []), ...(opts?.whitelist ?? []), ...autoWhitelist])),
          keyType: defaultOpts?.keyType,
          ...opts,
        };
        console.log("merged", merged);
        const ok = await window.ic!.plug!.requestConnect(merged);
        if (!ok) throw new Error("User canceled connection");
        // await window.ic?.plug?.agent?.fetchRootKey?.();
        const connected = await resolveBool(window.ic!.plug!.isConnected());
        let principal: string | undefined;
        if (connected) {
          const p = await window.ic!.plug!.getPrincipal();
          principal = p?.toText?.();
          // debug
          // console.debug("[Plug] principal:", principal, "host:", merged.host, "whitelist:", merged.whitelist);
        }
        setState({ available: true, connected, principal, error: null });
        return connected;
      } catch (e: any) {
        console.log("error", e);
        setState(s => ({ ...s, error: e?.message ?? String(e) }));
        return false;
      }
    },
    [defaultOpts?.host, defaultOpts?.keyType, defaultOpts?.whitelist, defaultOpts?.ledgers]
  );

  // ============= disconnect (kalau tersedia) =============
  const disconnect = useCallback(async () => {
    try {
      if (window.ic?.plug?.disconnect) {
        await window.ic.plug.disconnect();
      }
    } finally {
      setState(s => ({ ...s, connected: false, principal: undefined }));
    }
  }, []);

  // ============= createActor helper (IDL dari dfx generate) =============
  const createActor = useCallback(
    async <T,>(canisterId: string, idlFactory: any): Promise<T> => {
      if (!state.connected) throw new Error("Plug is not connected");
      return window.ic!.plug!.createActor<T>({ canisterId, interfaceFactory: idlFactory });
    },
    [state.connected]
  );

  // ============= principal helper =============
  const getPrincipal = useCallback(async () => {
    if (!state.connected) throw new Error("Plug is not connected");
    const p = await window.ic!.plug!.getPrincipal();
    return p.toText();
  }, [state.connected]);

  // ============= scan aset ICRC-1 dari daftar ledger =============


// ...
const fetchAssets = useCallback(
  async (override?: { ledgers?: LedgerConfig[]; host?: string }): Promise<AssetBalance[]> => {
    if (!state.connected) throw new Error("Plug is not connected");

    const ledgers = override?.ledgers ?? ledgersRef.current ?? [];
    if (!ledgers.length) return [];

    const host = override?.host ?? defaultOpts?.host ?? DEFAULT_HOST;
    const owner = Principal.fromText(state.principal!);
    const agent = new HttpAgent({ host });
    try {
        await (agent as any).fetchRootKey();
    } catch (e) {
      console.warn("[fetchAssets] fetchRootKey warn:", e);
    }

    const results = await Promise.all(
      ledgers.map(async (l) => {
        try {
          const actor: any = Actor.createActor(icrc1IdlFactory, {
            agent,
            canisterId: l.canisterId,
          });
// sym, dec, 
          const [bal] = await Promise.all([
            // actor.icrc1_symbol(),
            // actor.icrc1_decimals(),
            actor.icrc1_balance_of({ owner, subaccount: [] }), // [] = None
          ]);
          
          const raw = BigInt(bal);
          return {
            canisterId: l.canisterId,
            // symbol: String(sym),
            // decimals: Number(dec),
            raw: raw.toString(),
            // display: toDecimalString(raw, Number(dec)),
            label: l.label,
          } as AssetBalance;
        } catch (err) {
          console.error("[fetchAssets] error on", l.canisterId, err);
          return {
            canisterId: l.canisterId,
            symbol: "N/A",
            decimals: 0,
            raw: "0",
            display: "0",
            label: l.label,
          } as AssetBalance;
        }
      })
    );

    return results;
  },
  [state.connected, state.principal, defaultOpts?.host]
);

  // ============= helper: import token ke UI Plug (opsional) =============
  const importTokenToPlug = useCallback(
    async (cfg: { canisterId: string; symbol: string; logo?: string; standard?: "ICRC1" | "ICRC2" | string }) => {
      if (!state.connected) throw new Error("Plug is not connected");
      if (!window.ic?.plug?.requestImportToken) throw new Error("Plug requestImportToken not available");
      await window.ic.plug.requestImportToken({
        canisterId: cfg.canisterId,
        symbol: cfg.symbol,
        standard: cfg.standard ?? "ICRC1", // penting: "ICRC1" (tanpa minus)
        logo: cfg.logo,
      });
    },
    [state.connected]
  );

  // ============= setter/adder ledger list (opsional) =============
  const setLedgers = useCallback((list: LedgerConfig[]) => {
    ledgersRef.current = list.slice();
  }, []);
  const addLedgers = useCallback((list: LedgerConfig[]) => {
    const ids = new Set(ledgersRef.current.map(x => x.canisterId));
    const merged = ledgersRef.current.slice();
    for (const l of list) if (!ids.has(l.canisterId)) merged.push(l);
    ledgersRef.current = merged;
  }, []);

  // auto refresh saat mount
  useEffect(() => { refresh(); }, [refresh]);

  // memoized API
  const api = useMemo(() => ({
    ...state,
    connect,
    disconnect,
    refresh,
    createActor,
    getPrincipal,
    fetchAssets,        // <-- baru: ambil daftar aset ICRC-1 dari ledger yang diset
    importTokenToPlug,  // <-- baru: minta Plug import token biar muncul di UI wallet
    setLedgers,         // <-- baru: ganti daftar ledger
    addLedgers,         // <-- baru: tambah ledger
  }), [state, connect, disconnect, refresh, createActor, getPrincipal, fetchAssets, importTokenToPlug, setLedgers, addLedgers]);

  return api;
}
