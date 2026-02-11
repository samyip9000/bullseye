// ---------- Token / Curve ----------

export interface Token {
  id: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  uri: string;
  priceEth: number;
  priceUsd: number;
  marketCapEth: number;
  marketCapUsd: number;
  ethCollected: number;
  ethCollectedUsd: number;
  totalVolumeEth: number;
  totalVolumeUsd: number;
  tradeCount: number;
  graduated: boolean;
  creator: string;
  athPriceUsd: number;
  lastTradeAt: number;
  createdAt: number;
}

export interface TokensResponse {
  tokens: Token[];
  ethUsdPrice: number;
  count: number;
}

// ---------- Trades ----------

export interface TradeRecord {
  id: string;
  trader: string;
  type: "buy" | "sell";
  ethAmount: number;
  tokenAmount: number;
  price: number;
  priceUsd: number;
  timestamp: number;
}

export interface TradesResponse {
  trades: TradeRecord[];
  count: number;
  ethUsdPrice: number;
}

// ---------- Screener ----------

export type FilterField =
  | "marketCapUsd"
  | "priceUsd"
  | "ethCollected"
  | "totalVolumeUsd"
  | "tradeCount"
  | "graduated";

export type FilterOperator = ">" | "<" | ">=" | "<=" | "=" | "!=";

export interface FilterRule {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

export interface Screener {
  id: string;
  name: string;
  filters: FilterRule[];
  sort_field: string;
  sort_direction: string;
  created_at: string;
  updated_at: string;
}

// ---------- Strategy ----------

export type StrategyType =
  | "price_dip"
  | "momentum"
  | "mean_reversion"
  | "threshold";

export interface StrategyParams {
  entryType: StrategyType;
  entryThresholdPercent: number;
  lookbackTrades: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  positionSizeEth: number;
}

export interface Strategy {
  id: string;
  name: string;
  token_address: string;
  token_name: string;
  curve_id: string;
  strategy_type: StrategyType;
  params: StrategyParams;
  created_at: string;
  updated_at: string;
}

// ---------- Backtest ----------

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

// ---------- Historical Trades (Goldsky) ----------

export interface HistoricalTrade {
  side: string;
  trader: string;
  amountEth: string;
  amountToken: string;
  timestamp: string;
  txHash: string;
}

// ---------- Wallet ----------

export interface WalletUser {
  address: string;
  chainId: number;
  connectedAt: number;
}

// ---------- View State ----------
// Navigation is handled by react-router-dom routes (/, /screener, /strategy)
