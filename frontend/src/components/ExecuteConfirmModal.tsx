import { useState } from "react";
import {
  X,
  Zap,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  Target,
  Activity,
  BarChart3,
  Wallet,
} from "lucide-react";
import type { Token, StrategyParams, BacktestResult } from "../types";

interface ExecuteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (durationMinutes: number, investAmountEth: number) => void;
  token: Token;
  params: StrategyParams;
  strategyName: string;
  backtestResult: BacktestResult;
  ethUsdPrice?: number | null;
  walletEthBalance?: string | null; // formatted ETH balance from wallet
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

const DURATION_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "6 hours", value: 360 },
  { label: "24 hours", value: 1440 },
];

export default function ExecuteConfirmModal({
  open,
  onClose,
  onConfirm,
  token,
  params,
  strategyName,
  backtestResult,
  ethUsdPrice,
  walletEthBalance,
}: ExecuteConfirmModalProps) {
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [investEth, setInvestEth] = useState(0.05);

  if (!open) return null;

  const isProfitable = backtestResult.totalPnlPercent >= 0;
  const Icon = STRATEGY_ICONS[params.entryType] || TrendingUp;
  const usdcEquivalent =
    ethUsdPrice && ethUsdPrice > 0 ? investEth * ethUsdPrice : null;
  const maxEth = walletEthBalance ? parseFloat(walletEthBalance) : 0;
  const overBalance = maxEth > 0 && investEth > maxEth;
  const ethPerTrade =
    backtestResult.totalTrades > 0
      ? investEth / backtestResult.totalTrades
      : investEth;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-[#0c0c0c] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-gradient-to-r from-phosphor/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-phosphor/10 border border-phosphor/20 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-phosphor" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wide">
                Execute Strategy
              </h2>
              <p className="text-[0.6rem] text-gray-500 font-mono">
                Review and confirm before going live
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/[0.05] text-gray-500 hover:text-gray-300 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-auto">
          {/* Strategy Summary Card */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-phosphor/8 border border-phosphor/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-phosphor/70" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">
                  {strategyName ||
                    `${params.entryType} on ${token.symbol}`}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[0.6rem] bg-phosphor/8 text-phosphor/80 px-2 py-0.5 rounded-md font-mono font-bold">
                    {STRATEGY_LABELS[params.entryType] ?? params.entryType}
                  </span>
                  <span className="text-[0.6rem] text-gray-500 font-mono">
                    on
                  </span>
                  <span className="text-[0.6rem] bg-white/[0.04] text-phosphor px-2 py-0.5 rounded-md font-mono font-bold">
                    ${token.symbol}
                  </span>
                </div>
              </div>
            </div>

            {/* Parameters Grid */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              <div className="bg-white/[0.03] rounded-md p-2.5">
                <span className="text-[0.55rem] text-gray-600 block">
                  Take Profit
                </span>
                <span className="text-xs text-phosphor font-mono font-bold">
                  +{params.takeProfitPercent}%
                </span>
              </div>
              <div className="bg-white/[0.03] rounded-md p-2.5">
                <span className="text-[0.55rem] text-gray-600 block">
                  Stop Loss
                </span>
                <span className="text-xs text-loss font-mono font-bold">
                  {params.stopLossPercent}%
                </span>
              </div>
              <div className="bg-white/[0.03] rounded-md p-2.5">
                <span className="text-[0.55rem] text-gray-600 block">
                  Entry Threshold
                </span>
                <span className="text-xs text-gray-300 font-mono font-bold">
                  {params.entryThresholdPercent}%
                </span>
              </div>
              <div className="bg-white/[0.03] rounded-md p-2.5">
                <span className="text-[0.55rem] text-gray-600 block">
                  Lookback
                </span>
                <span className="text-xs text-gray-300 font-mono font-bold">
                  {params.lookbackTrades} trades
                </span>
              </div>
            </div>
          </div>

          {/* ETH Investment Amount */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1.5">
                <Wallet className="w-3 h-3" />
                Amount to Deploy
              </label>
              {walletEthBalance && (
                <button
                  onClick={() => {
                    // Leave 0.005 ETH for gas
                    const usable = Math.max(0, maxEth - 0.005);
                    setInvestEth(
                      parseFloat(usable.toFixed(6))
                    );
                  }}
                  className="text-[0.55rem] font-mono text-gray-500 hover:text-phosphor transition-colors"
                >
                  Balance:{" "}
                  <span className="text-gray-300 font-bold">
                    {parseFloat(walletEthBalance).toFixed(4)} ETH
                  </span>{" "}
                  <span className="text-phosphor/60 ml-0.5">MAX</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={0.001}
                  step={0.01}
                  value={investEth}
                  onChange={(e) =>
                    setInvestEth(
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                  className={`w-full bg-white/[0.03] border text-phosphor font-mono text-lg pl-3 pr-14 py-2.5 rounded-lg focus:outline-none transition-colors ${
                    overBalance
                      ? "border-loss/40 focus:border-loss/60"
                      : "border-white/[0.08] focus:border-phosphor/40"
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-500">
                  ETH
                </span>
              </div>
              {usdcEquivalent !== null && investEth > 0 && (
                <span className="text-xs font-mono text-gray-500 shrink-0 w-24 text-right">
                  ≈ $
                  {usdcEquivalent.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              )}
            </div>

            {overBalance && (
              <p className="text-[0.6rem] text-loss font-mono mt-1.5">
                Exceeds wallet balance
              </p>
            )}

            <div className="flex items-center gap-1.5 mt-2">
              {[0.01, 0.05, 0.1, 0.25, 0.5].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setInvestEth(amt)}
                  className={`px-2.5 py-1 text-[0.6rem] font-bold font-mono rounded border transition-all ${
                    investEth === amt
                      ? "border-phosphor/30 bg-phosphor/10 text-phosphor"
                      : "border-white/[0.06] bg-white/[0.02] text-gray-500 hover:text-gray-300 hover:border-white/[0.12]"
                  }`}
                >
                  {amt} ETH
                </button>
              ))}
            </div>

            {backtestResult.totalTrades > 0 && investEth > 0 && (
              <p className="text-[0.55rem] text-gray-600 font-mono mt-2">
                ~{ethPerTrade.toFixed(6)} ETH per trade across{" "}
                {backtestResult.totalTrades} planned entries
              </p>
            )}
          </div>

          {/* Backtest Performance Badge */}
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
              isProfitable
                ? "bg-phosphor/5 border-phosphor/20"
                : "bg-loss/5 border-loss/20"
            }`}
          >
            {isProfitable ? (
              <TrendingUp className="w-4 h-4 text-phosphor shrink-0" />
            ) : (
              <TrendingDown className="w-4 h-4 text-loss shrink-0" />
            )}
            <div className="flex-1">
              <span
                className={`font-mono text-xs font-bold ${
                  isProfitable ? "text-phosphor" : "text-loss"
                }`}
              >
                Backtest: {isProfitable ? "+" : ""}
                {backtestResult.totalPnlPercent.toFixed(2)}% (
                {backtestResult.totalPnlEth >= 0 ? "+" : ""}
                {backtestResult.totalPnlEth.toFixed(6)} ETH)
              </span>
              <span className="text-[0.6rem] text-gray-500 block mt-0.5 font-mono">
                {backtestResult.winRate.toFixed(0)}% win rate across{" "}
                {backtestResult.totalTrades} trades
              </span>
            </div>
          </div>

          {/* Planned Trades (from backtest) */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.04]">
              <h4 className="text-[0.6rem] uppercase tracking-[2px] text-gray-500 font-bold flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Planned Execution Sequence
              </h4>
            </div>
            <div className="max-h-48 overflow-auto">
              {backtestResult.trades.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-gray-600 font-mono">
                    Strategy will monitor and trade when conditions are met
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {backtestResult.trades.map((trade, i) => {
                    const isWin = trade.type === "win";
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="text-[0.6rem] text-gray-600 font-mono w-5 shrink-0">
                          #{i + 1}
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[0.6rem] uppercase font-bold px-1.5 py-0.5 rounded bg-phosphor/10 text-phosphor">
                            BUY
                          </span>
                          <span className="text-[0.65rem] font-mono text-gray-400">
                            {trade.entryPrice.toExponential(2)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                          <span
                            className={`text-[0.6rem] uppercase font-bold px-1.5 py-0.5 rounded ${
                              trade.exitReason === "take_profit"
                                ? "bg-[#ffd700]/10 text-[#ffd700]"
                                : "bg-loss/10 text-loss"
                            }`}
                          >
                            {trade.exitReason === "take_profit"
                              ? "TP"
                              : trade.exitReason === "stop_loss"
                              ? "SL"
                              : "EXIT"}
                          </span>
                          <span className="text-[0.65rem] font-mono text-gray-400">
                            {trade.exitPrice.toExponential(2)}
                          </span>
                        </div>
                        <span
                          className={`text-[0.65rem] font-mono font-bold shrink-0 ${
                            isWin ? "text-phosphor" : "text-loss"
                          }`}
                        >
                          {trade.pnlPercent >= 0 ? "+" : ""}
                          {trade.pnlPercent.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold mb-2 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Strategy Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedDuration(opt.value)}
                  className={`text-center py-2 px-3 rounded-md border text-xs font-mono font-bold transition-all ${
                    selectedDuration === opt.value
                      ? "border-phosphor/30 bg-phosphor/5 text-phosphor"
                      : "border-white/[0.06] bg-white/[0.02] text-gray-500 hover:border-white/[0.12] hover:text-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2.5 bg-[#ffd700]/5 border border-[#ffd700]/15 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-[#ffd700] shrink-0 mt-0.5" />
            <div>
              <p className="text-[0.65rem] text-[#ffd700]/90 font-bold">
                Real Funds Warning
              </p>
              <p className="text-[0.6rem] text-gray-500 mt-0.5 leading-relaxed">
                This will execute real on-chain buy/sell trades using{" "}
                <span className="text-white font-bold">
                  {investEth} ETH
                  {usdcEquivalent !== null && (
                    <span className="text-gray-400 font-normal">
                      {" "}
                      (≈ $
                      {usdcEquivalent.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      )
                    </span>
                  )}
                </span>{" "}
                from your wallet on the Base bonding curve. Trades will be
                executed automatically over the selected timeframe.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-white/[0.05] bg-[#080808]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-xs uppercase font-bold text-gray-500 border border-white/[0.08] rounded-lg hover:text-gray-300 hover:border-white/[0.15] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedDuration, investEth)}
            disabled={investEth <= 0 || overBalance}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs uppercase font-black bg-phosphor/10 border border-phosphor/30 text-phosphor rounded-lg hover:bg-phosphor hover:text-black hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-all disabled:opacity-30 disabled:hover:bg-phosphor/10 disabled:hover:text-phosphor"
          >
            <Zap className="w-3.5 h-3.5" />
            Deploy {investEth} ETH &mdash; Go Live
          </button>
        </div>
      </div>
    </div>
  );
}
