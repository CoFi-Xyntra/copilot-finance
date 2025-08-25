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
  const [showDropdown, setShowDropdown] = useState(false);

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

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

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
        className={`group relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold px-4 py-3 sm:px-6 rounded-2xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center gap-2 sm:gap-3 text-sm sm:text-base ${className || ""}`}
      >
        <div className="relative z-10 flex items-center gap-2 sm:gap-3">
          <div className="w-5 h-5 sm:w-6 sm:h-6 bg-black rounded-full flex items-center justify-center">
            <span className="text-amber-500 text-xs sm:text-sm font-bold">P</span>
          </div>
          <span className="hidden sm:inline">Install Plug Wallet</span>
          <span className="sm:hidden">Install Plug</span>
          <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-all duration-700"></div>
      </a>
    );
  }

  if (plug.connected) {
    return (
      <div className={`${className || ""}`}>
        {/* Estado conectado con diseño futurista */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
          <div className="relative bg-gray-800/80 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-3 sm:p-4">
            {/* Header de conexión */}
            <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
              <div className="relative dropdown-container flex-1">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 hover:bg-gray-700/30 rounded-lg p-2 transition-colors cursor-pointer group"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full flex items-center justify-center">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-900 rounded-full flex items-center justify-center">
                        <span className="text-emerald-400 text-xs font-bold">P</span>
                      </div>
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-400 rounded-full border-2 border-gray-800 animate-pulse"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-emerald-400 font-semibold text-xs sm:text-sm flex items-center gap-2">
                      Connected Wallet
                      <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="text-gray-400 text-xs font-mono truncate">{short(plug.principal)}</div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className="absolute left-0 top-full mt-2 w-full min-w-[200px] bg-gray-800/95 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="py-1">
                      {/* Copy Address */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(plug.principal || '');
                          setShowDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Address
                      </button>

                      {/* View on Explorer */}
                      <button
                        onClick={() => {
                          window.open(`https://dashboard.internetcomputer.org/account/${plug.principal}`, '_blank');
                          setShowDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View on Explorer
                      </button>

                      {/* Separator */}
                      <div className="border-t border-gray-600/50 my-1"></div>

                      {/* Disconnect */}
                      <button
                        onClick={() => {
                          plug.disconnect();
                          setShowDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Disconnect Wallet
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Assets display mejorado */}
            {assets.length > 0 && (
              <div className="border-t border-gray-700/50 pt-3 sm:pt-4">
                <div className="text-gray-300 text-xs sm:text-sm font-medium mb-2 sm:mb-3 flex items-center gap-2">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span className="hidden sm:inline">Your Assets</span>
                  <span className="sm:hidden">Assets</span>
                </div>
                <div className="space-y-1.5 sm:space-y-2 max-h-40 sm:max-h-48 overflow-y-auto">
                  {assets.map(asset => (
                    <div key={asset.canisterId} className="bg-gray-700/30 rounded-lg sm:rounded-xl p-2 sm:p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{(asset.label || asset.symbol || 'T')[0]}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-medium text-xs sm:text-sm truncate">{asset.label || asset.symbol}</div>
                          <div className="text-gray-400 text-xs truncate">{asset.canisterId.slice(0, 8)}...</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-teal-400 font-bold text-xs sm:text-sm">{asset.display}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className={`group relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold px-4 py-3 sm:px-8 sm:py-4 rounded-2xl hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 sm:gap-3 min-w-[160px] sm:min-w-[200px] justify-center text-sm sm:text-base ${className || ""}`}
    >
      {/* Efecto de brillo */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
      
      {/* Contenido del botón */}
      <div className="relative z-10 flex items-center gap-2 sm:gap-3">
        {loading ? (
          <>
            {/* Spinner de carga */}
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span className="hidden sm:inline">Connecting...</span>
            <span className="sm:hidden">Connecting</span>
          </>
        ) : (
          <>
            {/* Icono de Plug Wallet */}
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xs sm:text-sm font-bold">P</span>
            </div>
            <span className="hidden sm:inline">Connect Plug</span>
            <span className="sm:hidden">Connect</span>
            {/* Icono de wallet */}
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </>
        )}
      </div>
      
      {/* Efecto shimmer */}
      {!loading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-all duration-700"></div>
      )}
      
      {/* Partículas decorativas */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-2 left-4 w-1 h-1 bg-white rounded-full opacity-60 animate-pulse"></div>
        <div className="absolute bottom-3 right-6 w-1 h-1 bg-white rounded-full opacity-40 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/2 right-4 w-0.5 h-0.5 bg-white rounded-full opacity-50 animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
    </button>
  );
};
