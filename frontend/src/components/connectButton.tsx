import React, { useEffect, useState } from "react";
import { usePlug, type AssetBalance, type LedgerConfig } from "./../helper/usePlug";

type Props = {
  whitelist?: string[];                 // ex: [LEDGER_CANISTER_ID, BACKEND_CANISTER_ID]
  host?: string;                        // ex: "https://ic0.app" (mainnet) | "http://127.0.0.1:4943" (local)
  className?: string;
  ledgers?: LedgerConfig[];             // <<— tambah: daftar ledger ICRC-1 utk discan
};

export const ConnectPlugButton: React.FC<Props> = ({ whitelist, host, className, ledgers }) => {
  const plug = usePlug({ whitelist, host, ledgers }); // whitelist & host diteruskan ke hook
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetBalance[]>([]);

  const short = (p?: string) => (p ? `${p.slice(0, 5)}...${p.slice(-5)}` : "");

  // Setelah tersambung, ambil aset (pakai effect biar nggak await di render)
  useEffect(() => {
    (async () => {
      if (plug.connected) {
        try {
          const list = await plug.fetchAssets();
          setAssets(list);
          console.log("assets", list);
        } catch (e) {
          console.error(e);
        }
      } else {
        setAssets([]);
      }
    })();
  }, [plug.connected]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const ok = await plug.connect({ whitelist, host });
      if (ok) {
        const list = await plug.fetchAssets(); // aman di sini
        setAssets(list);
        console.log("assets", list);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!plug.available) {
    return (
      <a
        href="https://plugwallet.ooo/"
        target="_blank"
        rel="noreferrer"
        className={className || "bg-amber-500 text-black px-3 py-2 rounded"}
      >
        Install Plug
      </a>
    );
  }

  if (plug.connected) {
    return (
      <div className={`flex items-center gap-2 ${className || ""}`}>
        <span className="px-3 py-2 bg-emerald-600 text-white rounded">
          Connected: {short(plug.principal)}
        </span>
        <button
          onClick={plug.disconnect}
          className="px-3 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600"
        >
          Disconnect
        </button>

        {/* contoh render aset */}
        {assets.length > 0 && (
          <div className="ml-3 text-sm bg-zinc-800 text-white px-3 py-2 rounded">
            {assets.map(a => (
              <div key={a.canisterId}>
                {a.label || a.symbol}: {a.display}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}               // <<— pakai handler async
      disabled={loading}
      className={className || "bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white disabled:opacity-60"}
    >
      {loading ? "Connecting..." : "Connect Plug"}
    </button>
  );
};
