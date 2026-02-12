import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Save,
  Trash2,
  Loader2,
  Zap,
  Target,
  Activity,
  BarChart3,
  TrendingUp,
  Pencil,
  X,
  Check,
  Clock,
  ArrowDownUp,
  Rocket,
} from "lucide-react";
import { parseEther, formatEther, formatUnits } from "viem";
import BacktestResults from "./BacktestResults";
import ExecuteConfirmModal from "./ExecuteConfirmModal";
import { useWallet } from "../contexts/WalletContext";
import {
  BONDING_CURVE_ABI,
  CHAINLINK_PRICE_FEED_ABI,
  ERC20_ABI,
  CHAINLINK_ETH_USD,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_DEADLINE_SECONDS,
} from "../lib/robinpump/abis";
import type {
  Token,
  Strategy,
  StrategyType,
  StrategyParams,
  BacktestResult,
  LiveStrategy,
} from "../types";
import {
  getStrategy,
  getToken,
  updateStrategy,
  deleteStrategy,
  runBacktest,
} from "../services/api";

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

interface StrategyDetailProps {
  onExecuteStrategy?: (strategy: LiveStrategy) => void;
  walletEthBalance?: string | null;
}

export default function StrategyDetail({
  onExecuteStrategy,
  walletEthBalance,
}: StrategyDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editParams, setEditParams] = useState<StrategyParams | null>(null);
  const [editType, setEditType] = useState<StrategyType>("price_dip");
  const [saving, setSaving] = useState(false);

  // Backtest
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(
    null
  );
  const [backtesting, setBacktesting] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Status
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Trade execution
  const [investAmount, setInvestAmount] = useState<number>(100);
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [executingTrade, setExecutingTrade] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [ethUsdPrice, setEthUsdPrice] = useState<number | null>(null);

  // Execute strategy modal
  const [tokenData, setTokenData] = useState<Token | null>(null);
  const [showExecuteModal, setShowExecuteModal] = useState(false);

  const { isConnected, walletClient, address, publicClient, refreshBalances } =
    useWallet();

  // Fetch ETH/USD price on mount and periodically
  const fetchEthPrice = useCallback(async () => {
    try {
      const data = await publicClient.readContract({
        address: CHAINLINK_ETH_USD,
        abi: CHAINLINK_PRICE_FEED_ABI,
        functionName: "latestRoundData",
      });
      // Chainlink answer has 8 decimals
      const price = Number(data[1]) / 1e8;
      if (price > 0) setEthUsdPrice(price);
    } catch (err) {
      console.error("Failed to fetch ETH/USD price:", err);
    }
  }, [publicClient]);

  useEffect(() => {
    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 60_000);
    return () => clearInterval(interval);
  }, [fetchEthPrice]);

  // ---------- Execute Trade ----------

  async function handleExecuteTrade() {
    if (!strategy || !walletClient || !address || !ethUsdPrice) return;
    if (investAmount <= 0) return;

    const curveAddress = strategy.curve_id as `0x${string}`;

    setExecutingTrade(true);
    setTradeError(null);
    setTradeStatus(null);

    try {
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS
      );

      if (tradeMode === "buy") {
        // Convert USDC amount to ETH
        const ethAmount = investAmount / ethUsdPrice;
        const ethWei = parseEther(ethAmount.toFixed(18));

        setTradeStatus(
          `Simulating buy of ~${ethAmount.toFixed(6)} ETH ($${investAmount} USDC)...`
        );

        // Simulate to get expected tokens out
        const simResult = await publicClient.readContract({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: "simulateBuy",
          args: [ethWei],
        });

        const tokensOut = simResult[1];

        if (tokensOut === 0n) {
          throw new Error("Simulation returned 0 tokens — curve may be graduated or amount too small");
        }

        // Apply slippage: minTokensOut = tokensOut * (10000 - slippage) / 10000
        const minTokensOut =
          (tokensOut * BigInt(10000 - DEFAULT_SLIPPAGE_BPS)) / 10000n;

        setTradeStatus(
          `Buying ~${Number(formatUnits(tokensOut, 18)).toLocaleString()} tokens for ${ethAmount.toFixed(6)} ETH...`
        );

        // Execute buy
        const txHash = await walletClient.writeContract({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: "buy",
          args: [minTokensOut, deadline],
          value: ethWei,
          account: address as `0x${string}`,
          chain: walletClient.chain,
        });

        setTradeStatus(`Buy submitted! Waiting for confirmation...`);

        // Wait for receipt
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        setTradeStatus(null);
        showStatus(
          `Buy executed! ~${Number(formatUnits(tokensOut, 18)).toLocaleString()} tokens for ${ethAmount.toFixed(6)} ETH`
        );
        refreshBalances();
      } else {
        // SELL mode
        // Convert USDC to ETH value to sell
        const ethValue = investAmount / ethUsdPrice;
        const curveInfo = await publicClient.readContract({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: "getCurveInfo",
        });

        const tokenAddress = curveInfo[0] as `0x${string}`;

        // Get user's token balance
        const tokenBalance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });

        if (tokenBalance === 0n) {
          throw new Error("You don't hold any tokens for this curve");
        }

        // Estimate how many tokens to sell for the desired ETH
        // Use current price to estimate token amount
        const currentPrice = curveInfo[4]; // price in wei per token
        if (currentPrice === 0n) {
          throw new Error("Current price is 0 — cannot calculate sell amount");
        }

        const ethWei = parseEther(ethValue.toFixed(18));
        // tokensToSell = ethWei * 1e18 / currentPrice (rough estimate)
        let tokensToSell = (ethWei * BigInt(1e18)) / currentPrice;

        // Cap at user's balance
        if (tokensToSell > tokenBalance) {
          tokensToSell = tokenBalance;
        }

        if (tokensToSell === 0n) {
          throw new Error("Sell amount too small");
        }

        // Get exact ETH output for this token amount
        const ethOut = await publicClient.readContract({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: "getEthForTokens",
          args: [tokensToSell],
        });

        // Apply slippage
        const minEthOut =
          (ethOut * BigInt(10000 - DEFAULT_SLIPPAGE_BPS)) / 10000n;

        // Check allowance and approve if needed
        const currentAllowance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address as `0x${string}`, curveAddress],
        });

        if (currentAllowance < tokensToSell) {
          setTradeStatus("Approving token spend...");
          const approveTx = await walletClient.writeContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [curveAddress, tokensToSell],
            account: address as `0x${string}`,
            chain: walletClient.chain,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        setTradeStatus(
          `Selling ~${Number(formatUnits(tokensToSell, 18)).toLocaleString()} tokens for ~${Number(formatEther(ethOut)).toFixed(6)} ETH...`
        );

        // Execute sell
        const txHash = await walletClient.writeContract({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: "sell",
          args: [tokensToSell, minEthOut, deadline],
          account: address as `0x${string}`,
          chain: walletClient.chain,
        });

        setTradeStatus(`Sell submitted! Waiting for confirmation...`);

        await publicClient.waitForTransactionReceipt({ hash: txHash });

        setTradeStatus(null);
        showStatus(
          `Sold ~${Number(formatUnits(tokensToSell, 18)).toLocaleString()} tokens for ${Number(formatEther(ethOut)).toFixed(6)} ETH`
        );
        refreshBalances();
      }
    } catch (err: unknown) {
      console.error("Trade execution failed:", err);
      const message =
        err instanceof Error ? err.message : "Trade failed — check console";
      setTradeError(message);
      setTradeStatus(null);
    } finally {
      setExecutingTrade(false);
    }
  }

  // Fetch token data when strategy loads (for execute modal)
  useEffect(() => {
    if (!strategy) return;
    let cancelled = false;
    async function loadToken() {
      try {
        const data = await getToken(strategy!.curve_id);
        if (!cancelled) setTokenData(data);
      } catch (err) {
        console.error("Failed to fetch token data:", err);
      }
    }
    loadToken();
    return () => { cancelled = true; };
  }, [strategy?.curve_id]);

  useEffect(() => {
    if (!id) return;
    fetchStrategy();
  }, [id]);

  async function fetchStrategy() {
    setLoading(true);
    setError(null);
    try {
      const data = await getStrategy(id!);
      setStrategy(data);
      if (data.latestBacktest) {
        setBacktestResult(data.latestBacktest.result);
      }
    } catch (err) {
      console.error("Failed to fetch strategy:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load strategy"
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    if (!strategy) return;
    setEditName(strategy.name);
    setEditParams({ ...strategy.params });
    setEditType(strategy.strategy_type);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditName("");
    setEditParams(null);
    setEditType("price_dip");
  }

  async function handleSave() {
    if (!strategy || !editParams) return;
    setSaving(true);
    try {
      const updated = await updateStrategy(strategy.id, {
        name: editName,
        strategyType: editType,
        params: { ...editParams, entryType: editType },
      });
      setStrategy(updated);
      setEditing(false);
      showStatus("Strategy updated successfully");
    } catch (err) {
      console.error("Failed to update strategy:", err);
      showStatus("Failed to update strategy");
    } finally {
      setSaving(false);
    }
  }

  async function handleExecute() {
    if (!strategy) return;
    setBacktesting(true);
    setBacktestResult(null);
    try {
      const data = await runBacktest(strategy.id);
      setBacktestResult(data.result);
      showStatus("Backtest completed");
    } catch (err) {
      console.error("Backtest failed:", err);
      showStatus("Backtest failed - check console");
    } finally {
      setBacktesting(false);
    }
  }

  async function handleDelete() {
    if (!strategy) return;
    setDeleting(true);
    try {
      await deleteStrategy(strategy.id);
      navigate("/strategy", { replace: true });
    } catch (err) {
      console.error("Failed to delete strategy:", err);
      showStatus("Failed to delete strategy");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function showStatus(msg: string) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  }

  function handleExecuteStrategyConfirm(durationMinutes: number, investAmountEth: number) {
    if (!strategy || !backtestResult || !tokenData || !ethUsdPrice) return;

    const liveStrategy: LiveStrategy = {
      id: `live-${Date.now()}`,
      name: strategy.name,
      token: tokenData,
      params: strategy.params,
      backtestResult,
      investAmountEth,
      ethUsdPrice,
      curveAddress: strategy.curve_id,
      startedAt: Date.now(),
      durationMs: durationMinutes * 60 * 1000,
      status: "running",
      executedTrades: [],
    };

    onExecuteStrategy?.(liveStrategy);
    setShowExecuteModal(false);
    showStatus("Strategy is now LIVE!");
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-phosphor/50 animate-spin" />
          <span className="text-xs text-gray-500 font-mono">
            Loading strategy...
          </span>
        </div>
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-loss/5 border border-loss/10 flex items-center justify-center">
            <X className="w-8 h-8 text-loss/40" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Strategy not found</p>
            <p className="text-xs text-gray-600 mt-1 font-mono">
              {error || "This strategy may have been deleted."}
            </p>
          </div>
          <button
            onClick={() => navigate("/strategy")}
            className="flex items-center gap-2 text-xs text-phosphor hover:underline font-mono"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const Icon = STRATEGY_ICONS[strategy.strategy_type] || TrendingUp;

  return (
    <div className="h-full overflow-auto">
      {/* Execute Confirmation Modal */}
      {tokenData && backtestResult && strategy && (
        <ExecuteConfirmModal
          open={showExecuteModal}
          onClose={() => setShowExecuteModal(false)}
          onConfirm={handleExecuteStrategyConfirm}
          token={tokenData}
          params={strategy.params}
          strategyName={strategy.name}
          backtestResult={backtestResult}
          ethUsdPrice={ethUsdPrice}
        />
      )}

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/strategy")}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-phosphor transition-colors font-mono group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </button>

          {statusMsg && (
            <span className="text-[0.65rem] font-mono text-phosphor animate-pulse">
              {statusMsg}
            </span>
          )}
        </div>

        {/* Strategy Header Card */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-phosphor/8 border border-phosphor/10 flex items-center justify-center shrink-0">
                <Icon className="w-7 h-7 text-phosphor/70" />
              </div>
              <div>
                {editing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-white/[0.04] border border-phosphor/30 text-white font-bold text-lg px-3 py-1.5 rounded-lg w-80 focus:outline-none focus:border-phosphor/60"
                    autoFocus
                  />
                ) : (
                  <h1 className="text-lg font-black text-white tracking-wide">
                    {strategy.name}
                  </h1>
                )}
                <p className="text-xs text-gray-500 font-mono mt-1">
                  {strategy.token_name || "Unknown token"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[0.6rem] bg-phosphor/8 text-phosphor/80 px-2 py-0.5 rounded-md font-mono font-bold">
                    {STRATEGY_LABELS[strategy.strategy_type] ??
                      strategy.strategy_type}
                  </span>
                  <span className="text-[0.6rem] bg-white/[0.04] text-gray-500 px-2 py-0.5 rounded-md font-mono">
                    {strategy.params.positionSizeEth} ETH
                  </span>
                  <span className="text-[0.6rem] text-gray-600 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(strategy.created_at).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={cancelEditing}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-400 border border-white/[0.08] rounded-lg hover:text-white hover:border-white/[0.15] transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-black bg-phosphor rounded-lg hover:shadow-[0_0_15px_rgba(0,255,65,0.3)] transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-400 border border-white/[0.08] rounded-lg hover:text-phosphor hover:border-phosphor/20 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modify
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-400 border border-white/[0.08] rounded-lg hover:text-loss hover:border-loss/20 hover:bg-loss/5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#111] border border-white/[0.08] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-loss/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-loss" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Delete Strategy
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-mono mb-5">
                Are you sure you want to delete{" "}
                <span className="text-white font-bold">{strategy.name}</span>?
                All associated backtest results will also be removed.
              </p>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-xs font-bold text-gray-400 border border-white/[0.08] rounded-lg hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-loss/80 rounded-lg hover:bg-loss hover:shadow-[0_0_15px_rgba(255,62,62,0.3)] transition-all disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  {deleting ? "Deleting..." : "Delete Strategy"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Parameters Section */}
        {editing && editParams && (
          <div className="bg-white/[0.02] border border-phosphor/10 rounded-xl p-6 space-y-5">
            <h2 className="text-[0.7rem] uppercase tracking-[2px] font-bold text-phosphor/70 flex items-center gap-2">
              <Pencil className="w-3 h-3" />
              Edit Parameters
            </h2>

            {/* Strategy Type */}
            <div>
              <label className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold mb-2 block">
                Strategy Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {STRATEGY_TYPES.map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setEditType(st.value)}
                    className={`text-left p-2.5 rounded-lg border transition-all ${
                      editType === st.value
                        ? "border-phosphor/30 bg-phosphor/5"
                        : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1]"
                    }`}
                  >
                    <span
                      className={`text-[0.65rem] font-bold block ${
                        editType === st.value
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

            {/* Parameters Grid */}
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="text-[0.55rem] text-gray-600 block mb-1">
                  Entry Threshold %
                </label>
                <input
                  type="number"
                  value={editParams.entryThresholdPercent}
                  onChange={(e) =>
                    setEditParams((p) =>
                      p
                        ? {
                            ...p,
                            entryThresholdPercent:
                              parseFloat(e.target.value) || 0,
                          }
                        : p
                    )
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
                  value={editParams.lookbackTrades}
                  onChange={(e) =>
                    setEditParams((p) =>
                      p
                        ? {
                            ...p,
                            lookbackTrades: parseInt(e.target.value) || 10,
                          }
                        : p
                    )
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
                  value={editParams.takeProfitPercent}
                  onChange={(e) =>
                    setEditParams((p) =>
                      p
                        ? {
                            ...p,
                            takeProfitPercent:
                              parseFloat(e.target.value) || 0,
                          }
                        : p
                    )
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
                  value={editParams.stopLossPercent}
                  onChange={(e) =>
                    setEditParams((p) =>
                      p
                        ? {
                            ...p,
                            stopLossPercent:
                              parseFloat(e.target.value) || 0,
                          }
                        : p
                    )
                  }
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-phosphor font-mono text-xs px-2 py-1.5 rounded"
                />
              </div>
              <div>
                <label className="text-[0.55rem] text-gray-600 block mb-1">
                  Position Size (ETH)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editParams.positionSizeEth}
                  onChange={(e) =>
                    setEditParams((p) =>
                      p
                        ? {
                            ...p,
                            positionSizeEth:
                              parseFloat(e.target.value) || 0.1,
                          }
                        : p
                    )
                  }
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-phosphor font-mono text-xs px-2 py-1.5 rounded"
                />
              </div>
            </div>
          </div>
        )}

        {/* Strategy Parameters (read-only when not editing) */}
        {!editing && (
          <div className="grid grid-cols-5 gap-3">
            <ParamCard
              label="Entry Threshold"
              value={`${strategy.params.entryThresholdPercent}%`}
            />
            <ParamCard
              label="Lookback Trades"
              value={String(strategy.params.lookbackTrades)}
            />
            <ParamCard
              label="Take Profit"
              value={`${strategy.params.takeProfitPercent}%`}
              positive
            />
            <ParamCard
              label="Stop Loss"
              value={`${strategy.params.stopLossPercent}%`}
              negative
            />
            <ParamCard
              label="Position Size"
              value={`${strategy.params.positionSizeEth} ETH`}
            />
          </div>
        )}

        {/* Amount to Invest & Execute Trade */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 space-y-4">
          {/* Buy / Sell toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTradeMode("buy")}
              className={`flex-1 py-2 text-xs uppercase font-black rounded-lg border transition-all ${
                tradeMode === "buy"
                  ? "bg-phosphor/10 border-phosphor/30 text-phosphor"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeMode("sell")}
              className={`flex-1 py-2 text-xs uppercase font-black rounded-lg border transition-all ${
                tradeMode === "sell"
                  ? "bg-loss/10 border-loss/30 text-loss"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300"
              }`}
            >
              Sell
            </button>
          </div>

          <label className="text-[0.6rem] uppercase tracking-[2px] text-gray-500 font-bold block">
            {tradeMode === "buy" ? "Amount to Invest" : "Amount to Sell"}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              step={1}
              value={investAmount}
              onChange={(e) =>
                setInvestAmount(Math.max(0, parseFloat(e.target.value) || 0))
              }
              className="w-40 bg-white/[0.03] border border-white/[0.08] text-phosphor font-mono text-sm px-3 py-2.5 rounded-lg text-right focus:outline-none focus:border-phosphor/40"
            />
            <span className="text-xs font-bold text-gray-400 tracking-wide">
              USDC
            </span>
            {ethUsdPrice && investAmount > 0 && (
              <span className="text-[0.6rem] text-gray-600 font-mono">
                ~{(investAmount / ethUsdPrice).toFixed(6)} ETH
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {[-100, -50, -10, -1].map((delta) => (
              <button
                key={delta}
                onClick={() =>
                  setInvestAmount((prev) => Math.max(0, prev + delta))
                }
                className="px-3 py-1.5 text-[0.65rem] font-bold font-mono rounded-lg border border-white/[0.06] bg-white/[0.02] text-loss hover:bg-loss/10 hover:border-loss/30 transition-all"
              >
                {delta}
              </button>
            ))}
            {[+1, +10, +50, +100].map((delta) => (
              <button
                key={delta}
                onClick={() => setInvestAmount((prev) => prev + delta)}
                className="px-3 py-1.5 text-[0.65rem] font-bold font-mono rounded-lg border border-white/[0.06] bg-white/[0.02] text-phosphor hover:bg-phosphor/10 hover:border-phosphor/30 transition-all"
              >
                +{delta}
              </button>
            ))}
          </div>

          {/* Trade status / error */}
          {tradeStatus && (
            <p className="text-[0.65rem] font-mono text-phosphor animate-pulse">
              {tradeStatus}
            </p>
          )}
          {tradeError && (
            <p className="text-[0.65rem] font-mono text-loss break-all">
              {tradeError}
            </p>
          )}

          <button
            onClick={handleExecuteTrade}
            disabled={
              editing ||
              investAmount <= 0 ||
              !isConnected ||
              !ethUsdPrice ||
              executingTrade
            }
            className={`flex items-center gap-2 px-5 py-3 text-xs uppercase font-black rounded-lg transition-all disabled:opacity-30 disabled:hover:shadow-none ${
              tradeMode === "buy"
                ? "bg-phosphor/10 border border-phosphor/30 text-phosphor hover:bg-phosphor hover:text-black hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] disabled:hover:bg-phosphor/10 disabled:hover:text-phosphor"
                : "bg-loss/10 border border-loss/30 text-loss hover:bg-loss hover:text-white hover:shadow-[0_0_20px_rgba(255,62,62,0.3)] disabled:hover:bg-loss/10 disabled:hover:text-loss"
            }`}
          >
            {executingTrade ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDownUp className="w-4 h-4" />
            )}
            {executingTrade
              ? "Executing..."
              : !isConnected
              ? "Connect Wallet"
              : tradeMode === "buy"
              ? "Execute Buy"
              : "Execute Sell"}
          </button>

          {!isConnected && (
            <p className="text-[0.55rem] text-gray-600 font-mono">
              Connect your wallet to execute trades on-chain.
            </p>
          )}
        </div>

        {/* Backtest Section */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExecute}
            disabled={backtesting || editing}
            className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] text-gray-400 px-5 py-3 text-xs uppercase font-bold rounded-lg hover:text-phosphor hover:border-phosphor/20 transition-all disabled:opacity-30"
          >
            {backtesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {backtesting ? "Running Backtest..." : "Backtest"}
          </button>
          {backtestResult && !backtesting && (
            <span className="text-[0.6rem] text-gray-600 font-mono">
              Last run completed &mdash; scroll down for results
            </span>
          )}
        </div>

        {/* Backtest Results */}
        {(backtestResult || backtesting) && (
          <div className="space-y-2">
            <h2 className="text-[0.7rem] uppercase tracking-[2px] font-bold text-gray-500 flex items-center gap-2">
              <BarChart3 className="w-3 h-3" />
              Backtest Results
            </h2>
            <BacktestResults
              result={backtestResult!}
              loading={backtesting}
            />

            {/* Execute Strategy CTA - shown after backtest results */}
            {backtestResult && backtestResult.totalTrades > 0 && !backtesting && tokenData && (
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-phosphor/[0.06] to-transparent border border-phosphor/15 rounded-lg mt-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">
                    Ready to go live?
                  </p>
                  <p className="text-[0.6rem] text-gray-500 font-mono mt-0.5">
                    Deploy this strategy with {strategy.params.positionSizeEth} ETH
                    {ethUsdPrice && (
                      <span className="text-gray-600">
                        {" "}(≈ ${(strategy.params.positionSizeEth * ethUsdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    )}
                    {" "}on {strategy.token_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowExecuteModal(true)}
                  className="flex items-center gap-2 bg-phosphor text-black px-5 py-2.5 text-xs uppercase font-black rounded-lg hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all shrink-0"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  Execute Strategy
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Helper Component ----------

function ParamCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] transition-all">
      <span className="text-[0.55rem] uppercase tracking-widest text-gray-600 font-bold block mb-1">
        {label}
      </span>
      <span
        className={`text-sm font-mono font-bold ${
          positive
            ? "text-phosphor"
            : negative
            ? "text-loss"
            : "text-gray-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
