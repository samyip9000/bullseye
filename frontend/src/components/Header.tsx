import { useEffect, useState } from "react";
import { Crosshair, Zap, Activity, LogOut, Copy, Check, Wallet, CircleDollarSign, Link2 } from "lucide-react";
import { SignInWithBaseButton } from "@base-org/account-ui/react";
import { useWallet } from "../contexts/WalletContext";
import MyWallet from "./MyWallet";
import ConnectionsPanel from "./ConnectionsPanel";

interface HeaderProps {
  ethUsdPrice: number | null;
}

export default function Header({ ethUsdPrice }: HeaderProps) {
  const [synced, setSynced] = useState(false);
  const {
    address,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    truncatedAddress,
    balances,
  } = useWallet();

  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showConnections, setShowConnections] = useState(false);

  useEffect(() => {
    if (ethUsdPrice !== null) setSynced(true);
  }, [ethUsdPrice]);

  const handleCopyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="px-6 py-4 flex justify-between items-center border-b border-white/5 bg-gradient-to-b from-[#0a0a0a] to-transparent shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <Crosshair className="w-6 h-6 text-phosphor" />
        <span className="font-black tracking-[-2px] text-[1.6rem] uppercase text-phosphor drop-shadow-[0_0_15px_rgba(0,255,65,0.15)]">
          BULLSEYE
        </span>
        <span className="text-white/20 font-black text-[1.6rem]">//</span>
        <span className="text-white/20 font-black text-[1.2rem] uppercase tracking-wider">
          AGENT
        </span>
      </div>

      {/* Stats + Wallet */}
      <div className="flex items-center gap-6 font-mono text-sm">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-gray-500" />
          <span className="text-gray-500">ETH/USD:</span>
          <span className="text-phosphor">
            $
            {ethUsdPrice?.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }) ?? "---"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-gray-500" />
          <span className="text-gray-500">STATUS:</span>
          <span className={synced ? "text-phosphor" : "text-loss"}>
            {synced ? "SYNCED" : "CONNECTING..."}
          </span>
          {synced && (
            <span className="w-1.5 h-1.5 rounded-full bg-phosphor shadow-[0_0_10px_#00ff41] animate-pulse" />
          )}
        </div>

        {/* Wallet Section */}
        <div className="border-l border-white/[0.08] pl-6 ml-2">
          {isConnected && address ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2.5 bg-phosphor/5 border border-phosphor/20 rounded-lg px-3 py-1.5 hover:border-phosphor/40 transition-all group"
              >
                {/* Base chain indicator */}
                <div className="w-2 h-2 rounded-full bg-[#0052FF] shadow-[0_0_6px_#0052FF]" />
                <Wallet className="w-3.5 h-3.5 text-phosphor/70 group-hover:text-phosphor transition-colors" />
                <span className="text-phosphor text-xs font-bold tracking-wide">
                  {truncatedAddress}
                </span>
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  {/* Click-away backdrop */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-obsidian-surface border border-white/[0.08] rounded-lg shadow-2xl z-40 overflow-hidden">
                    {/* Wallet Info */}
                    <div className="p-3 border-b border-white/[0.05]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#0052FF] shadow-[0_0_6px_#0052FF]" />
                        <span className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold">
                          Base Mainnet
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-mono break-all leading-relaxed">
                        {address}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setShowWallet(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:text-phosphor hover:bg-phosphor/5 rounded transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <CircleDollarSign className="w-3.5 h-3.5" />
                          My Wallet
                        </div>
                        {!balances.loading && (
                          <span className="text-[0.6rem] font-mono text-phosphor/60">
                            ${parseFloat(balances.usdc).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          handleCopyAddress();
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-400 hover:text-phosphor hover:bg-phosphor/5 rounded transition-all"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-phosphor" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copied ? "Copied!" : "Copy Address"}
                      </button>
                      <button
                        onClick={() => {
                          setShowConnections(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-400 hover:text-phosphor hover:bg-phosphor/5 rounded transition-all"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Connections
                      </button>
                      <button
                        onClick={() => {
                          disconnect();
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-400 hover:text-loss hover:bg-loss/5 rounded transition-all"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {error && (
                <span className="text-loss text-[0.6rem] font-mono max-w-[150px] truncate">
                  {error}
                </span>
              )}
              {isConnecting ? (
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5">
                  <div className="w-3 h-3 border-2 border-phosphor/30 border-t-phosphor rounded-full animate-spin" />
                  <span className="text-xs text-gray-400 font-mono">
                    Connecting...
                  </span>
                </div>
              ) : (
                <SignInWithBaseButton
                  align="center"
                  variant="solid"
                  colorScheme="dark"
                  onClick={connect}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* My Wallet Panel */}
      <MyWallet open={showWallet} onClose={() => setShowWallet(false)} />

      {/* Connections Panel */}
      <ConnectionsPanel open={showConnections} onClose={() => setShowConnections(false)} />
    </header>
  );
}
