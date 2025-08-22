import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Principal } from "@dfinity/principal";
import { HttpAgent, Actor, IDL } from "@dfinity/agent";
import { SignerAgent } from "@slide-computer/signer-agent";

// import { Actor, IDL } from '@dfinity/agent';
import { Signer } from '@slide-computer/signer';
// import { SignerAgent } from '@slide-computer/signer-agent';
import { BrowserExtensionTransport } from '@slide-computer/signer-extension';

import { DelegationChain, DelegationIdentity, Ed25519KeyIdentity } from '@dfinity/identity';
import { canisterId, idlFactory } from "../../../src/declarations/backend";
// declare global {
//   interface Window {
//     ic?: {
//       plug?: {
//         isConnected: () => Promise<boolean> | boolean;
//         requestConnect: (opts: {
//           whitelist?: string[];
//           host?: string;                 // ex: "https://ic0.app" (mainnet) | "http://127.0.0.1:4943" (local)
//           timeout?: number;              // ms
//           keyType?: "Ed25519" | "secp256k1";
//         }) => Promise<boolean>;
//         createActor: <T>(opts: {
//           canisterId: string;
//           interfaceFactory: any;
//         }) => Promise<T>;
//         getPrincipal: () => Promise<{ toText: () => string }>;

//         // Optional (tergantung versi Plug):
//         disconnect?: () => Promise<void>;
//         agent?: any;
//         requestBalance?: (opts?: { host?: string }) => Promise<any>;
//         requestImportToken?: (opts: {
//           canisterId: string;
//           symbol: string;
//           standard: "ICRC1" | "ICRC2" | "DIP20" | string;
//           logo?: string;
//         }) => Promise<void>;
//       };
//     };
//   }
// }

declare global {
  interface Window {
    ic: {
      plug: {
        agent: HttpAgent;
        sessionManager: {
          sessionData: {
            accountId: string;
          };
        };
        getPrincipal: () => Promise<Principal>;
        deleteAgent: () => void;
        requestConnect: (options?: {
          whitelist?: string[];
          host?: string;
        }) => Promise<any>;
        createActor: (options: {}) => Promise<typeof DeVinci_backend>;
        isConnected: () => Promise<boolean>;
        disconnect: () => Promise<boolean>;
        createAgent: (args?: {
          whitelist: string[];
          host?: string;
        }) => Promise<undefined>;
        requestBalance: () => Promise<
          Array<{
            amount: number;
            canisterId: string | null;
            image: string;
            name: string;
            symbol: string;
            value: number | null;
          }>
        >;
        requestTransfer: (arg: {
          to: string;
          amount: number;
          opts?: {
            fee?: number;
            memo?: string;
            from_subaccount?: number;
            created_at_time?: {
              timestamp_nanos: number;
            };
          };
        }) => Promise<{ height: number }>;
      };
      infinityWallet: {
        /* agent: HttpAgent;
        sessionManager: {
          sessionData: {
            accountId: string;
          };
        }; */
        getPrincipal: () => Promise<Principal>;
        //deleteAgent: () => void;
        requestConnect: (options?: {
          whitelist?: string[];
          //host?: string;
        }) => Promise<any>;
        createActor: (options: {
          canisterId: string;
          interfaceFactory: any;
          host?: string;
        }) => Promise<typeof DeVinci_backend>;
        isConnected: () => Promise<boolean>;
        /* disconnect: () => Promise<boolean>;
        createAgent: (args?: {
          whitelist: string[];
          host?: string;
        }) => Promise<undefined>;
        requestBalance: () => Promise<
          Array<{
            amount: number;
            canisterId: string | null;
            image: string;
            name: string;
            symbol: string;
            value: number | null;
          }>
        >;
        requestTransfer: (arg: {
          to: string;
          amount: number;
          opts?: {
            fee?: number;
            memo?: string;
            from_subaccount?: number;
            created_at_time?: {
              timestamp_nanos: number;
            };
          };
        }) => Promise<{ height: number }>; */
        getUserAssets: () => Promise<any>;
        batchTransactions: () => Promise<any>;
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
  backendActor: any
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

// const DEFAULT_HOST = "http://127.0.0.1:4943";

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
    backendActor: null
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
          whitelist: Array.from(new Set([...(defaultOpts?.whitelist ?? []), ...(opts?.whitelist ?? []), ...autoWhitelist])),
          keyType: defaultOpts?.keyType,
          ...opts,
        };
        console.log("metged", opts);
        const ok = await window.ic!.plug!.requestConnect(merged);
        if (!ok) throw new Error("User canceled connection");
        // await window.ic?.plug?.agent?.fetchRootKey?.();
        const connected = await resolveBool(window.ic!.plug!.isConnected());
        let principal: string | undefined;
        if (connected) {
          const p = await window.ic!.plug!.getPrincipal();
          principal = p?.toText?.();
        }

        if (!window.ic?.plug?.agent) {
          console.warn("no agent found");
          const result = await window.ic?.plug?.createAgent({
            whitelist: opts?.whitelist,
            host: 'http://127.0.0.1:4943',
          });
          result
            ? console.info("agent created")
            : console.warn("agent creation failed");
        };
        // check if createActor method is available
        if (!window.ic?.plug?.createActor) {
          console.warn("no createActor found");
          return;
        }

        // Fetch root key for certificate validation during development
        // if (process.env.DFX_NETWORK !== "ic") {
          window.ic?.plug.agent.fetchRootKey().catch((err) => {
            console.warn(
              "Unable to fetch root key. Check to ensure that your local replica is running",
            );
            console.error(err);
          });
        // };
      let backendActor = (await window.ic?.plug.createActor({
              canisterId,
              interfaceFactory: idlFactory,
            }));
        //  const backendActor = await initBackendCanisterActor("plug", null);

        if (!backendActor) {
          console.warn("couldn't create backend actor");
          return;
        };
        setState({ available: true, connected, principal, error: null, backendActor });
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
         if (cache.actorMap.has(canisterId)) {
          console.log("masuk get cache");
          return cache.actorMap.get(canisterId) as T;
        }
                  console.log("masuk diluiar cache");
        const { agent } = await initPlugSignerAgent();

        // const idlFactory = ({ IDL }: { IDL: typeof IDL }) =>
        //   IDL.Service({
        //     greet: IDL.Func([IDL.Text], [IDL.Text], ['query']),
        //   });

        const actor = Actor.createActor(idlFactory as any, { agent, canisterId });
        cache.actorMap.set(canisterId, actor);
        return actor;
      // const agent = SignerAgent.create({ host:'http://127.0.0.1:4943' });
      //   // try {
      //   //     await (agent as any).fetchRootKey();
      //   // } catch (e) {
      //   //   console.warn("[fetchAssets] fetchRootKey warn:", e);
      //   // }

      //    const actor: any = Actor.createActor(idlFactory, {
      //       agent,
      //       canisterId: canisterId,
      //     });
      //     return {actor, agent};

      // const rootKeyPlugLocal = await window.ic?.plug.sessionManager.sessionData?.agent.fetchRootKey()
      //  console.log('root key plug mainnet', rootKeyPlugLocal)
      // const NNSUiActor = await window.ic.plug.createActor({
      //   canisterId: canisterId,
      //   interfaceFactory: idlFactory,
      // });
      // const accounts = await signer.accounts();
      // console.log("accounts",accounts);
      // const agent = await SignerAgent.create({
      //     signer,
      //     account: 'h2bkv-njzw4-3b7oh-ttze7-6t4jq-s56mz-co4mq-xt2te-vswdh-2yozf-bae'
      // });
      // const NNSUiActor = await window.ic.plug.createActor({
      //   canisterId: canisterId,
      //   interfaceFactory: idlFactory,
      // });
      //   const icpLedger = IcrcLedgerCanister.create({
      //     agent: NNSUiActor,
      //     canisterId: 'mxzaz-hqaaa-aaaar-qaada-cai',
      // });
      // return window.ic!.plug!.createActor<T>({ canisterId, interfaceFactory: idlFactory });
      // const icpLedger = await IcrcLedgerCanister.create({
      //   agent,
      //   interfaceFactory: idlFactory,
      //   canisterId: await window.ic!.plug!.getPrincipal(),
    // });
    // return icpLedger;
    },
    [state.connected]
  );

async function initPlugSignerAgent() {
  // 1) Temukan wallet extension Plug via UUID resmi
  const transport = await BrowserExtensionTransport.findTransport({
    uuid: '71edc834-bab2-4d59-8860-c36a01fee7b8', // Plug UUID
  });

  // 2) Bungkus ke Signer
  const signer = new Signer({ transport });

  // 3) Buka channel (lakukan di handler klik)
  await signer.openChannel();

  // 4) Ambil akun aktif → principal
  const [account] = await signer.accounts();
  if (!account) throw new Error('No Plug account found');

  // 5) Buat SignerAgent (drop-in pengganti HttpAgent)
  const agent = await SignerAgent.create({
    signer,
    account: account.owner,
    // host: 'https://icp-api.io', // optional
  });

  // (opsional - hanya untuk dfx local)
 await (agent as HttpAgent).fetchRootKey?.();

  return { agent, signer, account };
}
async function initPlugSignerAgentv2() {
  // 1) Temukan wallet extension Plug via UUID resmi
  const transport = await BrowserExtensionTransport.findTransport({
    uuid: '71edc834-bab2-4d59-8860-c36a01fee7b8', // Plug UUID
  });

  // 2) Bungkus ke Signer
  const signer = new Signer({ transport });

  // 3) Buka channel (lakukan di handler klik)
  await signer.openChannel();

 const sessionKey = Ed25519KeyIdentity.generate();
  const delegationJson = await signer.delegation({
    targets: ['mxzaz-hqaaa-aaaar-qaada-cai'],
    maxTimeToLiveNanos: BigInt(12222) * 1_000_000_000n,
  });

  const chain = DelegationChain.fromJSON(delegationJson);
  const identity = DelegationIdentity.fromDelegation(sessionKey, chain);

  const httpAgent = new HttpAgent({ identity, host: 'http://127.0.0.1:4943'});
  // if (isLocalHost(host)) \
  await httpAgent.fetchRootKey();
  return {agent: httpAgent};
}
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

    // const host = override?.host ?? defaultOpts?.host ?? DEFAULT_HOST;
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

          const [sym, dec, bal] = await Promise.all([
            actor.icrc1_symbol(),
            actor.icrc1_decimals(),
            actor.icrc1_balance_of({ owner, subaccount: [] }), // [] = None
          ]);
          
          const raw = BigInt(bal);
          return {
            canisterId: l.canisterId,
            symbol: String(sym),
            decimals: Number(dec),
            raw: raw.toString(),
            display: toDecimalString(raw, Number(dec)),
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



// plug-actor.ts
// ----------------------------------------------
// One-stop helper: connect Plug + get cached Actor
// ----------------------------------------------
// import { Actor, HttpAgent, IDL } from '@dfinity/agent';
// import { Signer } from '@slide-computer/signer';
// import { SignerAgent } from '@slide-computer/signer-agent';
// import { BrowserExtensionTransport } from '@slide-computer/signer-extension';
// import { DelegationChain, DelegationIdentity, Ed25519KeyIdentity } from '@dfinity/identity';

// type ConnectOptions = {
//   host?: string;                 // 'https://icp-api.io' | 'http://127.0.0.1:4943'
//   whitelist?: string[];          // canister IDs
//   timeout?: number;              // ms
//   keyType?: 'Ed25519' | 'secp256k1';
// };

type GetActorOptions<T> = {
  canisterId: string;
  idlFactory: ({ IDL }: { IDL: typeof IDL }) => any;
  mode?: 'signer-agent' | 'delegation';
  delegationTtlSec?: number;     // default 3600 (1h)
  connect?: ConnectOptions;      // forwarded to Plug requestConnect
};

const PLUG_UUID = '71edc834-bab2-4d59-8860-c36a01fee7b8';
const DEFAULT_HOST = 'https://icp-api.io';

const cache = {
  // cache per canisterId + mode + host
  actorMap: new Map<string, unknown>(),
  // save last connect fingerprint (host+whitelist) to avoid re-connect
  last: { host: '', whitelistKey: '' },
  inFlightConnect: false,
};

function isLocalHost(host?: string) {
  if (!host) return false;
  try {
    const u = new URL(host);
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  } catch { return false; }
}

async function ensurePlugConnected(opts?: ConnectOptions) {
  if (!window.ic?.plug) throw new Error('Plug extension not found');
  if (cache.inFlightConnect) return; // prevent double click races
  cache.inFlightConnect = true;

  try {
    const host = (opts?.host || DEFAULT_HOST).trim();
    const wl = Array.from(new Set([...(opts?.whitelist ?? [])]));
    const whitelistKey = wl.slice().sort().join(',');

    const already = await window.ic.plug.isConnected().catch(() => false);
    if (already && cache.last.host === host && cache.last.whitelistKey === whitelistKey) {
      return; // idempotent
    }

    const ok = await window.ic.plug.requestConnect({
      host,
      whitelist: wl,
      keyType: opts?.keyType,
      timeout: opts?.timeout ?? 60_000,
    });
    if (!ok) throw new Error('User canceled connection');

    if (isLocalHost(host)) {
      await window.ic?.plug?.agent?.fetchRootKey?.().catch(() => {});
    }

    cache.last.host = host;
    cache.last.whitelistKey = whitelistKey;
  } finally {
    cache.inFlightConnect = false;
  }
}

async function getSignerAgent(host?: string) {
  // BrowserExtensionTransport → Signer → SignerAgent
  const transport = await BrowserExtensionTransport.findTransport({ uuid: PLUG_UUID });
  const signer = new Signer({ transport });
  await signer.openChannel(); // call this from a user gesture if you wire it to a button
  const [account] = await signer.accounts();
  if (!account) throw new Error('No Plug account');

  const agent = await SignerAgent.create({
    signer,
    account: account.owner,
    ...(host ? { host } : {}),
  });
  if (isLocalHost(host)) await (agent as any)?.fetchRootKey?.();
  return agent;
}

async function getDelegatedHttpAgent(canisterId: string, host?: string, ttlSec = 3600) {
  // Signer.delegation() → DelegationIdentity → HttpAgent
  const transport = await BrowserExtensionTransport.findTransport({ uuid: PLUG_UUID });
  const signer = new Signer({ transport });
  await signer.openChannel();

  const sessionKey = Ed25519KeyIdentity.generate();
  const delegationJson = await signer.delegation({
    targets: [canisterId],
    maxTimeToLiveNanos: BigInt(ttlSec) * 1_000_000_000n,
  });

  const chain = DelegationChain.fromJSON(delegationJson);
  const identity = DelegationIdentity.fromDelegation(sessionKey, chain);

  const httpAgent = new HttpAgent({ identity, ...(host ? { host } : {}) });
  if (isLocalHost(host)) await httpAgent.fetchRootKey();
  return httpAgent;
}

/**
 * getActor<T>
 * - Connect ke Plug (idempotent)
 * - Bangun Actor (signer-agent / delegation)
 * - Cache per (canisterId, mode, host)
 */
export async function getActor<T>(opts: GetActorOptions<T>): Promise<T> {
  const host = opts.connect?.host;
  const mode = opts.mode ?? 'signer-agent';
  const key = `${opts.canisterId}|${mode}|${host}`;

  if (cache.actorMap.has(key)) {
    return cache.actorMap.get(key) as T;
  }

  // 1) Connect Plug sekali (no-op kalau sudah sama host+whitelist)
  await ensurePlugConnected({
    host,
    whitelist: Array.from(new Set([...(opts.connect?.whitelist ?? []), opts.canisterId])),
    keyType: opts.connect?.keyType,
    timeout: opts.connect?.timeout,
  });

  // 2) Buat agent sesuai mode
  let agent: HttpAgent;
  if (mode === 'signer-agent') {
    agent = (await getSignerAgent(host)) as unknown as HttpAgent;
  } else {
    agent = await getDelegatedHttpAgent(opts.canisterId, host, opts.delegationTtlSec ?? 3600);
  }

  // 3) Buat Actor dan cache
  const actor = Actor.createActor(opts.idlFactory as any, {
    agent,
    canisterId: opts.canisterId,
  }) as unknown as T;

  cache.actorMap.set(key, actor);
  return actor;
}
