/**
 * RobinPump Bonding Curve ABI definitions (Base mainnet)
 * Spec: docs/ROBINPUMP_INTEGRATION_SPEC.md
 */

// ---------- Bonding Curve ----------

export const BONDING_CURVE_ABI = [
  // --- Read ---
  {
    inputs: [],
    name: "getCurveInfo",
    outputs: [
      { name: "token", type: "address" },
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "uri", type: "string" },
      { name: "currentPrice", type: "uint256" },
      { name: "marketCap", type: "uint256" },
      { name: "virtualEthReserve", type: "uint256" },
      { name: "virtualTokenReserve", type: "uint256" },
      { name: "tokensAvailable", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentPrice",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMarketCap",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "ethAmount", type: "uint256" }],
    name: "simulateBuy",
    outputs: [
      { name: "ethToUse", type: "uint256" },
      { name: "tokensOut", type: "uint256" },
      { name: "refundAmount", type: "uint256" },
      { name: "willGraduate", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenAmount", type: "uint256" }],
    name: "getEthForTokens",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenAmount", type: "uint256" }],
    name: "getEthRequiredForTokens",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getGraduationInfo",
    outputs: [
      { name: "graduated", type: "bool" },
      { name: "progress", type: "uint256" },
      { name: "ethCollected", type: "uint256" },
      { name: "ethThreshold", type: "uint256" },
      { name: "pool", type: "address" },
      { name: "graduatedAt", type: "uint256" },
      { name: "lpTokensBurned", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // --- Write ---
  {
    inputs: [
      { name: "minTokensOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    name: "buy",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "tokensToSell", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    name: "sell",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ---------- Chainlink Price Feed ----------

export const CHAINLINK_PRICE_FEED_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ---------- ERC-20 (for token balance + approve) ----------

export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ---------- Addresses ----------

/** Chainlink ETH/USD on Base mainnet (8 decimals) */
export const CHAINLINK_ETH_USD =
  "0x57d2d46Fc7ff2A7142d479F2f59e1E3F95447077" as const;

/** RobinPump Factory (Proxy) on Base mainnet */
export const ROBINPUMP_FACTORY =
  "0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb" as const;

/** Default slippage tolerance (2%) */
export const DEFAULT_SLIPPAGE_BPS = 200;

/** Default deadline offset (20 minutes) */
export const DEFAULT_DEADLINE_SECONDS = 20 * 60;
