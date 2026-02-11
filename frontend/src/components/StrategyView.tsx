import { useState, useEffect } from "react";
import {
  Play,
  Save,
  ChevronDown,
  Crosshair,
  Sliders,
  Zap,
  History,
  ExternalLink,
  Loader2,
} from "lucide-react";
import BacktestResults from "./BacktestResults";
import type {
  Token,
  StrategyType,
  StrategyParams,
  BacktestResult,
  HistoricalTrade,
} from "../types";
import {
  createStrategy,
  runBacktest,
  runQuickBacktest,
  fetchHistoricalTrades,
} from "../services/api";

interface StrategyViewProps {
  tokens: Token[];
  selectedToken: Token | null;
  onTokenSelect: (token: Token | null) => void;
}

const STRATEGY_TYPES: { value: StrategyType; label: string; desc: string }[] = [
  {
    value: "price_dip",
    label: "Dip Buy",
    desc: "Buy when price drops X% from recent average",
  },
  {
    value: "momentum",
    label: "Momentum",
    desc: "Buy when price rises X% (ride the wave)",
  },
  {
    value: "mean_reversion",
    label: "Mean Reversion",
    desc: "Buy when price dips below moving average",
  },
  {
    value: "threshold",
    label: "Price Threshold",
    desc: "Buy when price crosses above a set level",
  },
];

const DEFAULT_PARAMS: StrategyParams = {
  entryType: "price_dip",
  entryThresholdPercent: -5,
  lookbackTrades: 20,
  takeProfitPercent: 20,
  stopLossPercent: -10,
  positionSizeEth: 0.1,
};

export default function StrategyView({
  tokens,
  selectedToken,
  onTokenSelect,
}: StrategyViewProps) {
  const [params, setParams] = useState<StrategyParams>(DEFAULT_PARAMS);
  const [strategyName, setStrategyName] = useState("");
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(
    null
  );
  const [backtesting, setBacktesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [historicalTrades, setHistoricalTrades] = useState<HistoricalTrade[]>(
    []
  );
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [tradesError, setTradesError] = useState<string | null>(null);

  // Fetch historical orders when selected token changes
  useEffect(() => {
    if (!selectedToken) {
      setHistoricalTrades([]);
      return;
    }

    let cancelled = false;

    async function loadTrades() {
      setLoadingTrades(true);
      setTradesError(null);
      try {
        const trades = await fetchHistoricalTrades(selectedToken!.id, 50);
        if (!cancelled) {
          setHistoricalTrades(trades);
        }
      } catch (err) {
        console.error("Failed to fetch historical trades:", err);
        if (!cancelled) {
          setTradesError(
            err instanceof Error ? err.message : "Failed to load trades"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTrades(false);
        }
      }
    }

    loadTrades();
    return () => {
      cancelled = true;
    };
  }, [selectedToken]);

  const filteredTokens = tokenSearch
    ? tokens.filter(
        (t) =>
          t.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
          t.symbol.toLowerCase().includes(tokenSearch.toLowerCase())
      )
    : tokens.slice(0, 20);

  const handleQuickBacktest = async () => {
    if (!selectedToken) {
      setStatusMsg("Select a token first");
      setTimeout(() => setStatusMsg(null), 2000);
      return;
    }

    setBacktesting(true);
    setBacktestResult(null);
    try {
      const data = await runQuickBacktest(selectedToken.id, params);
      setBacktestResult(data.result);
    } catch (err) {
      console.error("Backtest failed:", err);
      setStatusMsg("Backtest failed - check console");
      setTimeout(() => setStatusMsg(null), 3000);
    } finally {
      setBacktesting(false);
    }
  };

  const handleSaveAndBacktest = async () => {
    if (!selectedToken) {
      setStatusMsg("Select a token first");
      setTimeout(() => setStatusMsg(null), 2000);
      return;
    }

    setSaving(true);
    setBacktesting(true);
    setBacktestResult(null);

    try {
      const strategy = await createStrategy({
        name: strategyName || `${params.entryType} on ${selectedToken.symbol}`,
        tokenAddress: selectedToken.tokenAddress,
        tokenName: `${selectedToken.symbol} - ${selectedToken.name}`,
        curveId: selectedToken.id,
        strategyType: params.entryType,
        params,
      });

      const data = await runBacktest(strategy.id);
      setBacktestResult(data.result);
      setStatusMsg("Strategy saved & backtested!");
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error("Save/backtest failed:", err);
      setStatusMsg("Operation failed");
      setTimeout(() => setStatusMsg(null), 3000);
    } finally {
      setSaving(false);
      setBacktesting(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Strategy Config */}
      <div className="w-[380px] border-r border-white/[0.03] flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-white/[0.03]">
          <h2 className="text-[0.7rem] uppercase tracking-[2px] font-bold text-gray-500 flex items-center gap-2">
            <Sliders className="w-3 h-3" />
            Strategy Builder
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-5">
          {/* Strategy Name */}
          <div>
            <label className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold mb-1 block">
              Strategy Name
            </label>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="My Alpha Strategy..."
              className="w-full bg-white/[0.03] border border-white/[0.08] text-gray-200 font-mono text-xs px-3 py-2 rounded"
            />
          </div>

          {/* Token Selector */}
          <div>
            <label className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold mb-1 block">
              Target Token
            </label>
            <div className="relative">
              <button
                onClick={() => setShowTokenPicker(!showTokenPicker)}
                className="w-full flex items-center justify-between bg-white/[0.03] border border-white/[0.08] text-xs px-3 py-2 rounded font-mono"
              >
                {selectedToken ? (
                  <span className="text-phosphor">
                    ${selectedToken.symbol}{" "}
                    <span className="text-gray-500">
                      ({selectedToken.name})
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-500">Select a token...</span>
                )}
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>

              {showTokenPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-obsidian-surface border border-white/[0.08] rounded max-h-64 overflow-auto z-20 shadow-xl">
                  <div className="p-2 border-b border-white/[0.03]">
                    <input
                      type="text"
                      value={tokenSearch}
                      onChange={(e) => setTokenSearch(e.target.value)}
                      placeholder="Search..."
                      className="w-full bg-white/[0.03] border border-white/[0.05] text-gray-300 font-mono text-xs px-2 py-1.5 rounded"
                      autoFocus
                    />
                  </div>
                  {filteredTokens.map((token) => (
                    <button
                      key={token.id}
                      onClick={() => {
                        onTokenSelect(token);
                        setShowTokenPicker(false);
                        setTokenSearch("");
                        setBacktestResult(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-phosphor/[0.05] transition-colors flex items-center justify-between"
                    >
                      <span className="text-gray-300">
                        ${token.symbol}{" "}
                        <span className="text-gray-600 text-[0.65rem]">
                          {token.name}
                        </span>
                      </span>
                      <span className="text-gray-600 text-[0.6rem]">
                        {token.ethCollected.toFixed(2)} ETH
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Strategy Type */}
          <div>
            <label className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold mb-2 block">
              Strategy Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STRATEGY_TYPES.map((st) => (
                <button
                  key={st.value}
                  onClick={() =>
                    setParams((p) => ({ ...p, entryType: st.value }))
                  }
                  className={`text-left p-2.5 rounded border transition-all ${
                    params.entryType === st.value
                      ? "border-phosphor/30 bg-phosphor/5"
                      : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1]"
                  }`}
                >
                  <span
                    className={`text-[0.65rem] font-bold block ${
                      params.entryType === st.value
                        ? "text-phosphor"
                        : "text-gray-400"
                    }`}
                  >
                    {st.label}
                  </span>
                  <span className="text-[0.55rem] text-gray-600 block mt-0.5">
                    {st.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-3">
            <label className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold block">
              Parameters
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.55rem] text-gray-600 block mb-1">
                  Entry Threshold %
                </label>
                <input
                  type="number"
                  value={params.entryThresholdPercent}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      entryThresholdPercent: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-phosphor font-mono text-xs px-2 py-1.5 rounded"
                />
              </div>

              <div>
                <label className="text-[0.55rem] text-gray-600 block mb-1">
                  Lookback Trades
                </label>
                <input
                  type="number"
                  value={params.lookbackTrades}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      lookbackTrades: parseInt(e.target.value) || 10,
                    }))
                  }
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-phosphor font-mono text-xs px-2 py-1.5 rounded"
                />
              </div>

              <div>
                <label className="text-[0.55rem] text-gray-600 block mb-1">
                  Take Profit %
                </label>
                <input
                  type="number"
                  value={params.takeProfitPercent}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      takeProfitPercent: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-phosphor font-mono text-xs px-2 py-1.5 rounded"
                />
              </div>

              <div>
                <label className="text-[0.55rem] text-gray-600 block mb-1">
                  Stop Loss %
                </label>
                <input
                  type="number"
                  value={params.stopLossPercent}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      stopLossPercent: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-phosphor font-mono text-xs px-2 py-1.5 rounded"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[0.55rem] text-gray-600 block mb-1">
                  Position Size (ETH)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={params.positionSizeEth}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      positionSizeEth: parseFloat(e.target.value) || 0.1,
                    }))
                  }
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-phosphor font-mono text-xs px-2 py-1.5 rounded"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-white/[0.03] space-y-2">
          {statusMsg && (
            <p className="text-[0.65rem] font-mono text-phosphor text-center animate-pulse">
              {statusMsg}
            </p>
          )}
          <button
            onClick={handleQuickBacktest}
            disabled={backtesting || !selectedToken}
            className="w-full flex items-center justify-center gap-2 bg-phosphor/10 border border-phosphor/30 text-phosphor px-4 py-2.5 text-xs uppercase font-black rounded hover:bg-phosphor hover:text-black hover:shadow-[0_0_15px_#00ff41] transition-all disabled:opacity-30 disabled:hover:bg-phosphor/10 disabled:hover:text-phosphor disabled:hover:shadow-none"
          >
            <Play className="w-3.5 h-3.5" />
            {backtesting ? "Running..." : "Flash Backtest"}
          </button>
          <button
            onClick={handleSaveAndBacktest}
            disabled={saving || backtesting || !selectedToken}
            className="w-full flex items-center justify-center gap-2 bg-white/[0.03] border border-white/[0.08] text-gray-400 px-4 py-2 text-xs uppercase font-bold rounded hover:text-phosphor hover:border-phosphor/20 transition-all disabled:opacity-30"
          >
            <Save className="w-3.5 h-3.5" />
            Save & Backtest
          </button>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/[0.03] flex items-center justify-between">
          <h2 className="text-[0.7rem] uppercase tracking-[2px] font-bold text-gray-500 flex items-center gap-2">
            <Crosshair className="w-3 h-3" />
            Backtest Results
          </h2>
          {selectedToken && (
            <span className="font-mono text-xs text-phosphor flex items-center gap-1.5">
              <Zap className="w-3 h-3" />$
              {selectedToken.symbol}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {!selectedToken ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full border border-white/[0.05] flex items-center justify-center">
                  <Crosshair className="w-8 h-8 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">No token selected</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Select a token from the Screener or use the picker to start
                    backtesting
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Backtest section */}
              {!backtestResult && !backtesting ? (
                <div className="flex items-center justify-center h-48">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full border border-phosphor/10 flex items-center justify-center">
                      <Play className="w-8 h-8 text-phosphor/30" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">
                        Ready to backtest on ${selectedToken.symbol}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Configure your strategy parameters and click "Flash
                        Backtest"
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <BacktestResults
                  result={backtestResult!}
                  loading={backtesting}
                />
              )}

              {/* Historical Orders Section */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded overflow-hidden">
                <div className="flex items-center justify-between p-4 pb-2">
                  <h4 className="text-[0.65rem] uppercase tracking-[2px] text-gray-500 font-bold flex items-center gap-2">
                    <History className="w-3 h-3" />
                    Historical Orders
                  </h4>
                  <span className="text-[0.6rem] font-mono text-gray-600">
                    {loadingTrades
                      ? "Loading..."
                      : `${historicalTrades.length} trades`}
                  </span>
                </div>

                {loadingTrades ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-5 h-5 text-phosphor/50 animate-spin" />
                      <span className="text-xs text-gray-500 font-mono">
                        Fetching on-chain trades...
                      </span>
                    </div>
                  </div>
                ) : tradesError ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-xs text-loss/70 font-mono">
                      {tradesError}
                    </p>
                  </div>
                ) : historicalTrades.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-xs text-gray-600 font-mono">
                      No historical trades found for this token.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-auto">
                    <table className="w-full font-mono text-[0.7rem]">
                      <thead className="sticky top-0 bg-[#0a0a0a]">
                        <tr className="border-b border-white/[0.05]">
                          <th className="text-left px-4 py-2 text-gray-600">
                            SIDE
                          </th>
                          <th className="text-left px-4 py-2 text-gray-600">
                            TRADER
                          </th>
                          <th className="text-right px-4 py-2 text-gray-600">
                            ETH
                          </th>
                          <th className="text-right px-4 py-2 text-gray-600">
                            TOKENS
                          </th>
                          <th className="text-right px-4 py-2 text-gray-600">
                            TIME
                          </th>
                          <th className="text-center px-4 py-2 text-gray-600">
                            TX
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalTrades.map((trade, i) => {
                          const isBuy =
                            trade.side.toLowerCase() === "buy" ||
                            trade.side === "0";
                          const ethAmount =
                            parseFloat(trade.amountEth) / 1e18;
                          const tokenAmount =
                            parseFloat(trade.amountToken) / 1e18;
                          const time = new Date(
                            parseInt(trade.timestamp) * 1000
                          );

                          return (
                            <tr
                              key={`${trade.txHash}-${i}`}
                              className="border-b border-white/[0.015] hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-4 py-2">
                                <span
                                  className={`text-[0.6rem] uppercase font-bold px-2 py-0.5 rounded ${
                                    isBuy
                                      ? "bg-phosphor/10 text-phosphor"
                                      : "bg-loss/10 text-loss"
                                  }`}
                                >
                                  {isBuy ? "BUY" : "SELL"}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-400">
                                {trade.trader.slice(0, 6)}...
                                {trade.trader.slice(-4)}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-300">
                                {ethAmount < 0.001
                                  ? ethAmount.toExponential(2)
                                  : ethAmount.toFixed(4)}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-300">
                                {tokenAmount > 1e6
                                  ? `${(tokenAmount / 1e6).toFixed(1)}M`
                                  : tokenAmount > 1e3
                                  ? `${(tokenAmount / 1e3).toFixed(1)}K`
                                  : tokenAmount.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-500">
                                {time.toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <a
                                  href={`https://basescan.org/tx/${trade.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-600 hover:text-phosphor transition-colors inline-flex"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
