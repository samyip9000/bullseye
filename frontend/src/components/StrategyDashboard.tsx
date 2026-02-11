import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  TrendingUp,
  Layers,
  Zap,
  Target,
  ArrowUpRight,
  Trash2,
  BarChart3,
  Activity,
  Shield,
} from "lucide-react";
import { getStrategies, deleteStrategy } from "../services/api";
import type { Strategy } from "../types";

const STRATEGY_LABELS: Record<string, string> = {
  price_dip: "Dip Buy",
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  threshold: "Threshold",
};

const STRATEGY_ICONS: Record<string, typeof TrendingUp> = {
  price_dip: Target,
  momentum: Zap,
  mean_reversion: Activity,
  threshold: BarChart3,
};

export default function StrategyDashboard() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getStrategies();
      setStrategies(data.strategies);
    } catch (err) {
      console.error("Failed to fetch strategies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this strategy?")) return;
    setDeletingId(id);
    try {
      await deleteStrategy(id);
      setStrategies((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Failed to delete strategy:", err);
    } finally {
      setDeletingId(null);
    }
  };

  // Aggregate stats
  const totalStrategies = strategies.length;
  const totalEthAllocated = strategies.reduce(
    (sum, s) => sum + (s.params.positionSizeEth || 0),
    0
  );
  const strategyTypes = [...new Set(strategies.map((s) => s.strategy_type))];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-phosphor/20 border-t-phosphor rounded-full animate-spin" />
          <span className="text-xs text-gray-500 font-mono">
            Loading strategies...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-white tracking-wide uppercase">
              Strategy Dashboard
            </h1>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Manage and monitor your active trading strategies
            </p>
          </div>
          <button
            onClick={() => navigate("/strategy/create")}
            className="flex items-center gap-2 bg-phosphor/10 border border-phosphor/30 text-phosphor px-4 py-2.5 text-xs uppercase font-black rounded-lg hover:bg-phosphor hover:text-black hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Strategy
          </button>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-4 gap-4 auto-rows-auto">
          {/* Stats Card - Total Strategies (spans 1 col) */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between hover:border-white/[0.1] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-lg bg-phosphor/10 flex items-center justify-center">
                <Layers className="w-4.5 h-4.5 text-phosphor" />
              </div>
              <span className="text-[0.55rem] uppercase tracking-widest text-gray-600 font-bold">
                Total
              </span>
            </div>
            <div>
              <span className="text-3xl font-black text-white">
                {totalStrategies}
              </span>
              <p className="text-[0.6rem] text-gray-500 font-mono mt-1">
                Active strategies
              </p>
            </div>
          </div>

          {/* Stats Card - ETH Allocated (spans 1 col) */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between hover:border-white/[0.1] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#627EEA]/10 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-[#627EEA]" />
              </div>
              <span className="text-[0.55rem] uppercase tracking-widest text-gray-600 font-bold">
                Allocated
              </span>
            </div>
            <div>
              <span className="text-3xl font-black text-white">
                {totalEthAllocated.toFixed(2)}
              </span>
              <p className="text-[0.6rem] text-gray-500 font-mono mt-1">
                ETH total position size
              </p>
            </div>
          </div>

          {/* Stats Card - Strategy Types (spans 2 cols) */}
          <div className="col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-phosphor/10 flex items-center justify-center">
                  <BarChart3 className="w-4.5 h-4.5 text-phosphor" />
                </div>
                <span className="text-[0.55rem] uppercase tracking-widest text-gray-600 font-bold">
                  Strategy Mix
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {strategyTypes.length === 0 ? (
                <span className="text-xs text-gray-600 font-mono">
                  No strategies yet
                </span>
              ) : (
                strategyTypes.map((type) => {
                  const count = strategies.filter(
                    (s) => s.strategy_type === type
                  ).length;
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2"
                    >
                      <span className="text-xs font-bold text-phosphor">
                        {STRATEGY_LABELS[type] ?? type}
                      </span>
                      <span className="text-[0.6rem] font-mono text-gray-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Strategy Cards - each in bento grid */}
          {strategies.length === 0 ? (
            <div className="col-span-4 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-phosphor/5 border border-phosphor/10 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-phosphor/40" />
              </div>
              <h3 className="text-sm font-bold text-gray-400 mb-1">
                No strategies created yet
              </h3>
              <p className="text-xs text-gray-600 font-mono mb-4 max-w-sm">
                Create your first trading strategy to start backtesting and
                automating your trades
              </p>
              <button
                onClick={() => navigate("/strategy/create")}
                className="flex items-center gap-2 bg-phosphor/10 border border-phosphor/30 text-phosphor px-4 py-2 text-xs uppercase font-black rounded-lg hover:bg-phosphor hover:text-black transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Strategy
              </button>
            </div>
          ) : (
            strategies.map((strategy, index) => {
              const Icon =
                STRATEGY_ICONS[strategy.strategy_type] || TrendingUp;
              // Alternate card sizes for bento effect
              const isWide = index % 3 === 0 && strategies.length > 1;
              return (
                <div
                  key={strategy.id}
                  className={`${
                    isWide ? "col-span-2" : "col-span-1"
                  } bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-phosphor/20 transition-all group cursor-pointer relative`}
                  onClick={() => navigate("/strategy")}
                >
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(strategy.id, e)}
                    disabled={deletingId === strategy.id}
                    className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-loss/10 text-gray-600 hover:text-loss transition-all"
                    title="Delete strategy"
                  >
                    <Trash2
                      className={`w-3.5 h-3.5 ${
                        deletingId === strategy.id ? "animate-spin" : ""
                      }`}
                    />
                  </button>

                  {/* Strategy header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-phosphor/8 border border-phosphor/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-phosphor/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate">
                          {strategy.name}
                        </h3>
                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-phosphor transition-colors shrink-0" />
                      </div>
                      <p className="text-[0.6rem] text-gray-500 font-mono mt-0.5">
                        {strategy.token_name || "Unknown token"}
                      </p>
                    </div>
                  </div>

                  {/* Strategy type badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[0.6rem] bg-phosphor/8 text-phosphor/80 px-2 py-0.5 rounded-md font-mono font-bold">
                      {STRATEGY_LABELS[strategy.strategy_type] ??
                        strategy.strategy_type}
                    </span>
                    <span className="text-[0.6rem] bg-white/[0.04] text-gray-500 px-2 py-0.5 rounded-md font-mono">
                      {strategy.params.positionSizeEth} ETH
                    </span>
                  </div>

                  {/* Params row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[0.55rem] bg-phosphor/8 text-phosphor/70 px-1.5 py-0.5 rounded font-mono">
                      TP {strategy.params.takeProfitPercent}%
                    </span>
                    <span className="text-[0.55rem] bg-loss/8 text-loss/70 px-1.5 py-0.5 rounded font-mono">
                      SL {strategy.params.stopLossPercent}%
                    </span>
                    <span className="text-[0.55rem] bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded font-mono">
                      Entry {strategy.params.entryThresholdPercent}%
                    </span>
                    <span className="text-[0.55rem] bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded font-mono">
                      Lookback {strategy.params.lookbackTrades}
                    </span>
                  </div>

                  {/* Created date */}
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <span className="text-[0.55rem] text-gray-600 font-mono">
                      Created{" "}
                      {new Date(strategy.created_at).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
