import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  X,
  Clock,
  Target,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Square,
  ExternalLink,
  Award,
  Percent,
} from "lucide-react";
import type { LiveStrategy } from "../types";

interface LiveStrategyBarProps {
  strategy: LiveStrategy;
  onStop: () => void;
  onDismiss: () => void;
  statusMessage?: string | null;
}

const STRATEGY_LABELS: Record<string, string> = {
  price_dip: "Dip Buy",
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  threshold: "Price Threshold",
};

const STRATEGY_ICONS: Record<string, typeof TrendingUp> = {
  price_dip: Target,
  momentum: Zap,
  mean_reversion: Activity,
  threshold: BarChart3,
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function LiveStrategyBar({
  strategy,
  onStop,
  onDismiss,
  statusMessage,
}: LiveStrategyBarProps) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const calcRemaining = useCallback(() => {
    const elapsed = Date.now() - strategy.startedAt;
    return Math.max(0, strategy.durationMs - elapsed);
  }, [strategy.startedAt, strategy.durationMs]);

  useEffect(() => {
    setRemainingMs(calcRemaining());
    const interval = setInterval(() => {
      const r = calcRemaining();
      setRemainingMs(r);
      if (r <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [calcRemaining]);

  // Auto-expand when strategy completes to show summary
  useEffect(() => {
    if (strategy.status === "completed" && strategy.result) {
      setExpanded(true);
    }
  }, [strategy.status, strategy.result]);

  const progressPercent =
    ((strategy.durationMs - remainingMs) / strategy.durationMs) * 100;
  const isComplete = strategy.status !== "running";
  const Icon = STRATEGY_ICONS[strategy.params.entryType] || TrendingUp;
  const confirmedTrades = strategy.executedTrades.filter(
    (t) => t.status === "confirmed"
  );
  const buyCount = confirmedTrades.filter((t) => t.side === "buy").length;
  const sellCount = confirmedTrades.filter((t) => t.side === "sell").length;

  const handleStopClick = () => {
    if (showStopConfirm) {
      onStop();
      setShowStopConfirm(false);
    } else {
      setShowStopConfirm(true);
      setTimeout(() => setShowStopConfirm(false), 3000);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Progress bar track */}
      <div className="h-[2px] bg-white/[0.05] relative">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            isComplete
              ? strategy.status === "cancelled"
                ? "bg-loss"
                : "bg-[#ffd700]"
              : "bg-phosphor shadow-[0_0_8px_rgba(0,255,65,0.4)]"
          }`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>

      {/* Main bar */}
      <div className="bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/[0.06]">
        <div className="flex items-center gap-4 px-5 py-3">
          {/* Live pulse indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {isComplete ? (
              <div
                className={`w-2 h-2 rounded-full ${
                  strategy.status === "cancelled" ? "bg-loss" : "bg-[#ffd700]"
                }`}
              />
            ) : (
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-phosphor" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-phosphor animate-ping" />
              </div>
            )}
            <span
              className={`text-[0.6rem] uppercase font-black tracking-widest ${
                isComplete
                  ? strategy.status === "cancelled"
                    ? "text-loss"
                    : "text-[#ffd700]"
                  : "text-phosphor"
              }`}
            >
              {isComplete
                ? strategy.status === "cancelled"
                  ? "STOPPED"
                  : "COMPLETED"
                : "LIVE"}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/[0.06]" />

          {/* Strategy info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-phosphor/8 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-phosphor/70" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                  {strategy.name}
                </span>
                <span className="text-[0.55rem] font-mono text-gray-500">
                  ${strategy.token.symbol}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[0.55rem] font-mono text-gray-600">
                  {strategy.investAmountEth} ETH deployed
                </span>
              </div>
            </div>
          </div>

          {/* Status message */}
          {statusMessage && !isComplete && (
            <>
              <div className="w-px h-5 bg-white/[0.06]" />
              <span className="text-[0.6rem] font-mono text-phosphor/80 truncate max-w-[250px] animate-pulse">
                {statusMessage}
              </span>
            </>
          )}

          {/* Trade counter */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <span className="text-[0.6rem] font-mono text-gray-500">
              {buyCount}B / {sellCount}S
            </span>
          </div>

          {/* Live PnL (if sells have happened) */}
          {strategy.result && (
            <>
              <div className="w-px h-5 bg-white/[0.06]" />
              <span
                className={`text-xs font-mono font-bold shrink-0 ${
                  strategy.result.totalPnlEth >= 0
                    ? "text-phosphor"
                    : "text-loss"
                }`}
              >
                {strategy.result.totalPnlEth >= 0 ? "+" : ""}
                {strategy.result.totalPnlEth.toFixed(6)} ETH
              </span>
            </>
          )}

          {/* Countdown timer */}
          <div className="flex items-center gap-2 shrink-0">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                isComplete
                  ? "text-gray-500"
                  : remainingMs < 60000
                  ? "text-loss animate-pulse"
                  : "text-phosphor"
              }`}
            >
              {formatCountdown(remainingMs)}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/[0.06]" />

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md hover:bg-white/[0.05] text-gray-500 hover:text-gray-300 transition-all"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>

          {/* Stop / Dismiss */}
          {!isComplete ? (
            <button
              onClick={handleStopClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[0.65rem] uppercase font-bold rounded-md border transition-all ${
                showStopConfirm
                  ? "bg-loss/20 border-loss/40 text-loss"
                  : "border-white/[0.08] text-gray-500 hover:text-loss hover:border-loss/30 hover:bg-loss/5"
              }`}
            >
              {showStopConfirm ? (
                <>
                  <X className="w-3 h-3" />
                  Confirm Stop
                </>
              ) : (
                <>
                  <Square className="w-3 h-3" />
                  Stop
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[0.65rem] uppercase font-bold rounded-md border border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/[0.15] transition-all"
            >
              <X className="w-3 h-3" />
              Dismiss
            </button>
          )}
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div className="border-t border-white/[0.04] px-5 py-4 bg-white/[0.01]">
            {/* PnL Summary (shown when complete) */}
            {strategy.result && (
              <div className="mb-4">
                <div
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    strategy.result.totalPnlEth >= 0
                      ? "bg-phosphor/5 border-phosphor/20"
                      : "bg-loss/5 border-loss/20"
                  }`}
                >
                  {strategy.result.totalPnlEth >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-phosphor shrink-0" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-loss shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-[0.6rem] uppercase tracking-widest text-gray-500 font-bold">
                      Strategy {strategy.status === "cancelled" ? "Stopped" : "Complete"} &mdash; Final P&L
                    </p>
                    <p
                      className={`text-xl font-mono font-black mt-1 ${
                        strategy.result.totalPnlEth >= 0
                          ? "text-phosphor"
                          : "text-loss"
                      }`}
                    >
                      {strategy.result.totalPnlEth >= 0 ? "+" : ""}
                      {strategy.result.totalPnlEth.toFixed(6)} ETH
                      <span className="text-sm text-gray-500 ml-2">
                        ({strategy.result.totalPnlPercent >= 0 ? "+" : ""}
                        {strategy.result.totalPnlPercent.toFixed(2)}%)
                      </span>
                      {strategy.ethUsdPrice > 0 && (
                        <span className="text-sm text-gray-600 ml-2">
                          ≈ $
                          {(
                            strategy.result.totalPnlEth * strategy.ethUsdPrice
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BarChart3 className="w-3 h-3 text-gray-500" />
                      <span className="text-[0.55rem] uppercase tracking-wider text-gray-600 font-bold">
                        Volume
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-gray-200">
                      {strategy.result.totalVolumeEth.toFixed(6)} ETH
                    </span>
                    {strategy.ethUsdPrice > 0 && (
                      <span className="text-[0.55rem] text-gray-600 font-mono block mt-0.5">
                        ≈ $
                        {(
                          strategy.result.totalVolumeEth * strategy.ethUsdPrice
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Award className="w-3 h-3 text-gray-500" />
                      <span className="text-[0.55rem] uppercase tracking-wider text-gray-600 font-bold">
                        Win Rate
                      </span>
                    </div>
                    <span
                      className={`text-sm font-mono font-bold ${
                        strategy.result.wins >=
                        strategy.result.losses
                          ? "text-phosphor"
                          : "text-loss"
                      }`}
                    >
                      {strategy.result.buys > 0
                        ? (
                            (strategy.result.wins /
                              Math.max(
                                strategy.result.wins +
                                  strategy.result.losses,
                                1
                              )) *
                            100
                          ).toFixed(0)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Percent className="w-3 h-3 text-gray-500" />
                      <span className="text-[0.55rem] uppercase tracking-wider text-gray-600 font-bold">
                        Trades
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-gray-200">
                      {strategy.result.buys}B / {strategy.result.sells}S
                    </span>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3 h-3 text-gray-500" />
                      <span className="text-[0.55rem] uppercase tracking-wider text-gray-600 font-bold">
                        W / L
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold">
                      <span className="text-phosphor">
                        {strategy.result.wins}
                      </span>
                      <span className="text-gray-600 mx-1">/</span>
                      <span className="text-loss">
                        {strategy.result.losses}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Executed Trades Log */}
            {confirmedTrades.length > 0 && (
              <div>
                <h4 className="text-[0.6rem] uppercase tracking-[2px] text-gray-500 font-bold mb-2">
                  Executed Trades
                </h4>
                <div className="max-h-40 overflow-auto space-y-1">
                  {confirmedTrades.map((trade, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-1.5 rounded bg-white/[0.02] text-[0.6rem] font-mono"
                    >
                      <span
                        className={`uppercase font-bold px-1.5 py-0.5 rounded ${
                          trade.side === "buy"
                            ? "bg-phosphor/10 text-phosphor"
                            : "bg-loss/10 text-loss"
                        }`}
                      >
                        {trade.side}
                      </span>
                      <span className="text-gray-400">
                        {trade.ethAmount.toFixed(6)} ETH
                      </span>
                      <span className="text-gray-600">
                        {trade.tokenAmount > 1e6
                          ? `${(trade.tokenAmount / 1e6).toFixed(1)}M`
                          : trade.tokenAmount > 1e3
                          ? `${(trade.tokenAmount / 1e3).toFixed(1)}K`
                          : trade.tokenAmount.toFixed(2)}{" "}
                        tokens
                      </span>
                      {trade.pnlEth !== undefined && (
                        <span
                          className={`font-bold ml-auto ${
                            trade.pnlEth >= 0 ? "text-phosphor" : "text-loss"
                          }`}
                        >
                          {trade.pnlEth >= 0 ? "+" : ""}
                          {trade.pnlEth.toFixed(6)} ETH (
                          {trade.pnlPercent !== undefined
                            ? `${trade.pnlPercent >= 0 ? "+" : ""}${trade.pnlPercent.toFixed(1)}%`
                            : ""}
                          )
                        </span>
                      )}
                      {trade.txHash && (
                        <a
                          href={`https://basescan.org/tx/${trade.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-phosphor transition-colors ml-auto shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategy params (when no result yet) */}
            {!strategy.result && (
              <div className="grid grid-cols-6 gap-4">
                <div>
                  <span className="text-[0.55rem] text-gray-600 block">
                    Entry Threshold
                  </span>
                  <span className="text-xs font-mono text-gray-300 font-bold">
                    {strategy.params.entryThresholdPercent}%
                  </span>
                </div>
                <div>
                  <span className="text-[0.55rem] text-gray-600 block">
                    Take Profit
                  </span>
                  <span className="text-xs font-mono text-phosphor font-bold">
                    +{strategy.params.takeProfitPercent}%
                  </span>
                </div>
                <div>
                  <span className="text-[0.55rem] text-gray-600 block">
                    Stop Loss
                  </span>
                  <span className="text-xs font-mono text-loss font-bold">
                    {strategy.params.stopLossPercent}%
                  </span>
                </div>
                <div>
                  <span className="text-[0.55rem] text-gray-600 block">
                    Deployed
                  </span>
                  <span className="text-xs font-mono text-gray-300 font-bold">
                    {strategy.investAmountEth} ETH
                  </span>
                </div>
                <div>
                  <span className="text-[0.55rem] text-gray-600 block">
                    Planned Trades
                  </span>
                  <span className="text-xs font-mono text-gray-300 font-bold">
                    {strategy.backtestResult.totalTrades}
                  </span>
                </div>
                <div>
                  <span className="text-[0.55rem] text-gray-600 block">
                    Backtest P&L
                  </span>
                  <span
                    className={`text-xs font-mono font-bold ${
                      strategy.backtestResult.totalPnlPercent >= 0
                        ? "text-phosphor"
                        : "text-loss"
                    }`}
                  >
                    {strategy.backtestResult.totalPnlPercent >= 0 ? "+" : ""}
                    {strategy.backtestResult.totalPnlPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
