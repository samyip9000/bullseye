// Backtest Engine
// Runs trading strategies against historical trade data from RobinPump

import { getTradesForCurve, type Trade } from "./robinpump";

// ---------- Types ----------

export interface StrategyParams {
  // Entry conditions
  entryType: "price_dip" | "momentum" | "mean_reversion" | "threshold";
  entryThresholdPercent: number; // e.g., -5 for 5% dip, +10 for 10% rise
  lookbackTrades: number; // Number of trades to look back for reference price

  // Exit conditions
  takeProfitPercent: number; // e.g., 20 for 20% profit
  stopLossPercent: number; // e.g., -10 for 10% loss (negative)

  // Position sizing
  positionSizeEth: number; // ETH per trade
}

export interface BacktestTrade {
  entryTimestamp: number;
  exitTimestamp: number;
  entryPrice: number;
  exitPrice: number;
  pnlPercent: number;
  pnlEth: number;
  type: "win" | "loss";
  exitReason: "take_profit" | "stop_loss" | "end_of_data";
}

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnlPercent: number;
  totalPnlEth: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equityCurve: Array<{ timestamp: number; equity: number }>;
  priceHistory: Array<{ timestamp: number; price: number }>;
}

// ---------- Strategy Templates ----------

function shouldEnter(
  params: StrategyParams,
  currentPrice: number,
  referencePrice: number
): boolean {
  const changePercent = ((currentPrice - referencePrice) / referencePrice) * 100;

  switch (params.entryType) {
    case "price_dip":
      // Buy when price drops by entryThresholdPercent
      return changePercent <= params.entryThresholdPercent;

    case "momentum":
      // Buy when price rises by entryThresholdPercent
      return changePercent >= params.entryThresholdPercent;

    case "mean_reversion":
      // Buy when price is below reference by entryThresholdPercent (dip buy for bounce)
      return changePercent <= params.entryThresholdPercent;

    case "threshold":
      // Buy when price crosses above a threshold
      return currentPrice >= referencePrice * (1 + params.entryThresholdPercent / 100);

    default:
      return false;
  }
}

function shouldExit(
  params: StrategyParams,
  currentPrice: number,
  entryPrice: number
): { exit: boolean; reason: "take_profit" | "stop_loss" } | null {
  const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

  if (pnlPercent >= params.takeProfitPercent) {
    return { exit: true, reason: "take_profit" };
  }

  if (pnlPercent <= params.stopLossPercent) {
    return { exit: true, reason: "stop_loss" };
  }

  return null;
}

// ---------- Main Backtest Function ----------

export async function runBacktest(
  curveId: string,
  params: StrategyParams
): Promise<BacktestResult> {
  // Fetch historical trades (oldest first for chronological processing)
  const trades = await getTradesForCurve(curveId, 1000, "asc");

  if (trades.length < params.lookbackTrades + 10) {
    return createEmptyResult(trades);
  }

  // Convert trades to price points using actual schema fields
  const pricePoints = trades.map((t) => ({
    timestamp: parseInt(t.timestamp),
    price: parseFloat(t.priceEth) || 0,
  })).filter(p => isFinite(p.price) && p.price > 0);

  if (pricePoints.length < params.lookbackTrades + 10) {
    return createEmptyResult(trades);
  }

  const backtestTrades: BacktestTrade[] = [];
  let inPosition = false;
  let entryPrice = 0;
  let entryTimestamp = 0;
  let equity = params.positionSizeEth;
  const equityCurve: Array<{ timestamp: number; equity: number }> = [
    { timestamp: pricePoints[0].timestamp, equity },
  ];

  for (let i = params.lookbackTrades; i < pricePoints.length; i++) {
    const current = pricePoints[i];

    if (!inPosition) {
      // Calculate reference price (average of lookback period)
      const lookbackSlice = pricePoints.slice(
        i - params.lookbackTrades,
        i
      );
      const referencePrice =
        lookbackSlice.reduce((sum, p) => sum + p.price, 0) /
        lookbackSlice.length;

      if (shouldEnter(params, current.price, referencePrice)) {
        inPosition = true;
        entryPrice = current.price;
        entryTimestamp = current.timestamp;
      }
    } else {
      // Check exit conditions
      const exitCheck = shouldExit(params, current.price, entryPrice);

      if (exitCheck) {
        const pnlPercent =
          ((current.price - entryPrice) / entryPrice) * 100;
        const pnlEth = equity * (pnlPercent / 100);

        backtestTrades.push({
          entryTimestamp,
          exitTimestamp: current.timestamp,
          entryPrice,
          exitPrice: current.price,
          pnlPercent,
          pnlEth,
          type: pnlPercent >= 0 ? "win" : "loss",
          exitReason: exitCheck.reason,
        });

        equity += pnlEth;
        inPosition = false;
      }
    }

    equityCurve.push({ timestamp: current.timestamp, equity });
  }

  // Close any open position at end of data
  if (inPosition && pricePoints.length > 0) {
    const lastPrice = pricePoints[pricePoints.length - 1];
    const pnlPercent =
      ((lastPrice.price - entryPrice) / entryPrice) * 100;
    const pnlEth = equity * (pnlPercent / 100);

    backtestTrades.push({
      entryTimestamp,
      exitTimestamp: lastPrice.timestamp,
      entryPrice,
      exitPrice: lastPrice.price,
      pnlPercent,
      pnlEth,
      type: pnlPercent >= 0 ? "win" : "loss",
      exitReason: "end_of_data",
    });

    equity += pnlEth;
  }

  // Calculate metrics
  const winningTrades = backtestTrades.filter((t) => t.type === "win");
  const losingTrades = backtestTrades.filter((t) => t.type === "loss");
  const totalPnlEth = backtestTrades.reduce((sum, t) => sum + t.pnlEth, 0);
  const totalPnlPercent =
    (totalPnlEth / params.positionSizeEth) * 100;

  // Max drawdown
  let peak = params.positionSizeEth;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const drawdown = ((peak - point.equity) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Simplified Sharpe ratio
  const returns = backtestTrades.map((t) => t.pnlPercent);
  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
  const stdDev =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) /
            (returns.length - 1)
        )
      : 1;
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  return {
    totalTrades: backtestTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate:
      backtestTrades.length > 0
        ? (winningTrades.length / backtestTrades.length) * 100
        : 0,
    totalPnlPercent,
    totalPnlEth,
    maxDrawdownPercent: maxDrawdown,
    sharpeRatio,
    trades: backtestTrades,
    equityCurve,
    priceHistory: pricePoints,
  };
}

function createEmptyResult(trades: Trade[]): BacktestResult {
  const priceHistory = trades.map((t) => ({
    timestamp: parseInt(t.timestamp),
    price: parseFloat(t.priceEth) || 0,
  })).filter(p => p.price > 0);

  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalPnlPercent: 0,
    totalPnlEth: 0,
    maxDrawdownPercent: 0,
    sharpeRatio: 0,
    trades: [],
    equityCurve: [],
    priceHistory,
  };
}
