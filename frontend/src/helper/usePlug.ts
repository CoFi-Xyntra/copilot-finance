// usePlug.ts
// React + TypeScript helper buat konek ke Plug dan bikin actor canister.

import { useCallback, useEffect, useMemo, useState } from "react";

// Kalau belum punya type untuk window.ic
declare global {
  interface Window {
    ic?: {
      plug?: {
        isConnected: () => Promise<boolean> | boolean;
        requestConnect: (opts: {
          whitelist?: string[];
          host?: string;                 // ex: "https://ic0.app" (mainnet)
          timeout?: number;              // ms
          keyType?: "Ed25519" | "secp256k1";
        }) => Promise<boolean>;
        createActor: <T>(opts: {
          canisterId: string;
          interfaceFactory: any;        // idlFactory dari dfx generate
        }) => Promise<T>;
        getPrincipal: () => Promise<{ toText: () => string }>;
        // Opsi tergantung versi Plug; tidak selalu ada:
        disconnect?: () => Promise<void>;
      };
    };
  }
}

export type PlugState = {
  available: boolean;         // extension terpasang?
  connected: boolean;         // sudah connect ke situs ini?
  principal?: string;         // principal wallet user
  error?: string | null;
};

export type ConnectOptions = {
  whitelist?: string[];       // daftar canister yang akan diakses (ledger, backend, dll.)
  host?: string;              // "https://ic0.app" (mainnet) | "http://127.0.0.1:4943" (local)
  timeout?: number;           // default 60_000
  keyType?: "Ed25519" | "secp256k1";
};

export function usePlug(defaultOpts?: ConnectOptions) {
  const [state, setState] = useState<PlugState>({
    available: typeof window !== "undefined" && !!window.ic?.plug,
    connected: false,
    principal: undefined,
    error: null,
  });

  // refresh status (dipakai saat mount)
  const refresh = useCallback(async () => {
    try {
      const available = !!window.ic?.plug;
      if (!available) {
        setState((s) => ({ ...s, available: false, connected: false, principal: undefined }));
        return;
      }
      const connected = await window.ic!.plug!.isConnected();
      let principal: string | undefined = undefined;
      if (connected) {
        const p = await window.ic!.plug!.getPrincipal();
        principal = p?.toText?.();
      }
      setState({ available, connected, principal, error: null });
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message ?? String(e) }));
    }
  }, []);

  // connect
  const connect = useCallback(
    async (opts?: ConnectOptions) => {
      try {
        const available = !!window.ic?.plug;
        if (!available) throw new Error("Plug extension not found");
        const merged: ConnectOptions = {
          timeout: 60_000,
          host: defaultOpts?.host,       // isi default mainnet bila mau: "https://ic0.app"
          whitelist: defaultOpts?.whitelist,
          keyType: defaultOpts?.keyType,
          ...opts,
        };
        const ok = await window.ic!.plug!.requestConnect(merged);
        if (!ok) throw new Error("User canceled connection");

        const connected = await window.ic!.plug!.isConnected();
        let principal: string | undefined = undefined;
        if (connected) {
          const p = await window.ic!.plug!.getPrincipal();
          principal = p?.toText?.();
        }
        setState({ available: true, connected, principal, error: null });
        return connected;
      } catch (e: any) {
        setState((s) => ({ ...s, error: e?.message ?? String(e) }));
        return false;
      }
    },
    [defaultOpts?.host, defaultOpts?.keyType, defaultOpts?.whitelist]
  );

  // disconnect (kalau tersedia di versi Plug)
  const disconnect = useCallback(async () => {
    try {
      if (window.ic?.plug?.disconnect) {
        await window.ic.plug.disconnect();
      }
    } finally {
      setState((s) => ({ ...s, connected: false, principal: undefined }));
    }
  }, []);

  // createActor helper (IDL dari dfx generate)
  const createActor = useCallback(async <T,>(canisterId: string, idlFactory: any): Promise<T> => {
    if (!state.connected) throw new Error("Plug is not connected");
    return window.ic!.plug!.createActor<T>({ canisterId, interfaceFactory: idlFactory });
  }, [state.connected]);

  // principal helper
  const getPrincipal = useCallback(async () => {
    if (!state.connected) throw new Error("Plug is not connected");
    const p = await window.ic!.plug!.getPrincipal();
    return p.toText();
  }, [state.connected]);

  // auto refresh saat mount
  useEffect(() => { refresh(); }, [refresh]);

  // memoized API
  const api = useMemo(() => ({ ...state, connect, disconnect, refresh, createActor, getPrincipal }), [state, connect, disconnect, refresh, createActor, getPrincipal]);

  return api;
}
