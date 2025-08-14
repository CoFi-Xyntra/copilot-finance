// ConnectPlugButton.tsx
import React from "react";
import { usePlug } from "./../helper/usePlug";

type Props = {
  whitelist?: string[];                 // ex: [LEDGER_CANISTER_ID, BACKEND_CANISTER_ID]
  host?: string;                        // ex: "https://ic0.app" (ICP mainnet)
  className?: string;
};

export const ConnectPlugButton: React.FC<Props> = ({ whitelist, host, className }) => {
  const plug = usePlug({ whitelist, host });

  const short = (p?: string) => (p ? `${p.slice(0, 5)}...${p.slice(-5)}` : "");

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
      </div>
    );
  }

  return (
    <button
      onClick={() => plug.connect({ whitelist, host })}
      className={className || "bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white"}
    >
      Connect Plug
    </button>
  );
};
