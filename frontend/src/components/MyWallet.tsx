import { useEffect, useState } from "react";
import {
  X,
  RefreshCw,
  Wallet,
  TrendingUp,
  CircleDollarSign,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { getStrategies } from "../services/api";
import type { Strategy } from "../types";

interface MyWalletProps {
  open: boolean;
  onClose: () => void;
}

const STRATEGY_LABELS: Record<string, string> = {
  price_dip: "Price Dip",
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  threshold: "Threshold",
};

export default function MyWallet({ open, onClose }: MyWalletProps) {
  const { address, balances, refreshBalances, truncatedAddress } = useWallet();
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch active positions (strategies)
  useEffect(() => {
    if (open && address) {
      fetchPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address]);

  const fetchPositions = async () => {
    setLoadingPositions(true);
    try {
      const data = await getStrategies();
      setStrategies(data.strategies);
    } catch (err) {
      console.error("Failed to fetch strategies:", err);
    } finally {
      setLoadingPositions(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshBalances(), fetchPositions()]);
    setRefreshing(false);
  };

  if (!open) return null;

  const usdcNum = parseFloat(balances.usdc);
  const ethNum = parseFloat(balances.eth);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-obsidian-surface border-l border-white/[0.08] z-50 flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-phosphor/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-phosphor" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                MY WALLET
              </h2>
              <p className="text-[0.65rem] text-gray-500 font-mono">
                {truncatedAddress}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-white/[0.05] text-gray-500 hover:text-phosphor transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/[0.05] text-gray-500 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Balances Section */}
          <div className="p-5">
            <div className="text-[0.6rem] uppercase tracking-widest text-gray-500 font-bold mb-3">
              Balances
            </div>

            {/* USDC Balance Card */}
            <div className="bg-gradient-to-br from-phosphor/5 to-transparent border border-phosphor/15 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="w-4 h-4 text-phosphor/70" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    USDC
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#2775CA]" />
                  <span className="text-[0.55rem] text-gray-500 font-mono">
                    Base
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-phosphor tracking-tight">
                  {balances.loading ? (
                    <span className="text-lg text-gray-500 animate-pulse">
                      Loading...
                    </span>
                  ) : (
                    `$${usdcNum.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </span>
              </div>
            </div>

            {/* ETH Balance Card */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#627EEA] flex items-center justify-center">
                    <span className="text-[0.45rem] font-black text-white">
                      E
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    ETH
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#0052FF]" />
                  <span className="text-[0.55rem] text-gray-500 font-mono">
                    Base
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white tracking-tight">
                  {balances.loading ? (
                    <span className="text-lg text-gray-500 animate-pulse">
                      Loading...
                    </span>
                  ) : (
                    ethNum.toLocaleString(undefined, {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 6,
                    })
                  )}
                </span>
                <span className="text-xs text-gray-500 font-mono">ETH</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.05] mx-5" />

          {/* Active Strategies Section */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[0.6rem] uppercase tracking-widest text-gray-500 font-bold">
                Active Strategies
              </div>
              <span className="text-[0.6rem] font-mono text-gray-600 bg-white/[0.03] px-2 py-0.5 rounded">
                {strategies.length}
              </span>
            </div>

            {loadingPositions ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-phosphor/20 border-t-phosphor rounded-full animate-spin" />
              </div>
            ) : strategies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Layers className="w-8 h-8 text-gray-600 mb-3" />
                <p className="text-xs text-gray-500 font-mono">
                  No active strategies
                </p>
                <p className="text-[0.6rem] text-gray-600 mt-1">
                  Create a strategy to start trading
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {strategies.map((strategy) => (
                  <button
                    key={strategy.id}
                    onClick={() => {
                      navigate("/strategy");
                      onClose();
                    }}
                    className="w-full text-left bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 hover:border-phosphor/20 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-phosphor/60" />
                        <span className="text-xs font-bold text-white truncate max-w-[180px]">
                          {strategy.name}
                        </span>
                      </div>
                      <ArrowUpRight className="w-3 h-3 text-gray-600 group-hover:text-phosphor transition-colors" />
                    </div>

                    <div className="flex items-center gap-3 text-[0.6rem] font-mono">
                      <span className="text-gray-500">
                        {strategy.token_name || "Unknown"}
                      </span>
                      <span className="text-gray-600">|</span>
                      <span className="text-phosphor/70">
                        {STRATEGY_LABELS[strategy.strategy_type] ??
                          strategy.strategy_type}
                      </span>
                      <span className="text-gray-600">|</span>
                      <span className="text-gray-400">
                        {strategy.params.positionSizeEth} ETH
                      </span>
                    </div>

                    {/* Strategy params summary */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[0.55rem] bg-phosphor/8 text-phosphor/80 px-1.5 py-0.5 rounded font-mono">
                        TP {strategy.params.takeProfitPercent}%
                      </span>
                      <span className="text-[0.55rem] bg-loss/8 text-loss/80 px-1.5 py-0.5 rounded font-mono">
                        SL {strategy.params.stopLossPercent}%
                      </span>
                      <span className="text-[0.55rem] bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded font-mono">
                        Entry {strategy.params.entryThresholdPercent}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.05] text-center">
          <p className="text-[0.55rem] text-gray-600 font-mono">
            Balances on Base Mainnet &bull; Auto-refreshes every 30s
          </p>
        </div>
      </div>
    </>
  );
}
