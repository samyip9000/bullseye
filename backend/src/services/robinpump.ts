// RobinPump Goldsky Subgraph Client
// Fetches real token data from the RobinPump bonding curve protocol on Base

const SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn";

// ---------- Types (matching actual Goldsky schema) ----------

export interface CurveToken {
  id: string;
  token: string;
  name: string;
  symbol: string;
  uri: string;
  creator: string;
  createdAt: string;
  graduated: boolean;
  graduatedAt: string | null;
  lastPriceEth: string;
  lastPriceUsd: string;
  lastTradeAt: string;
  totalVolumeEth: string;
  ethCollected: string;
  tradeCount: string;
  athPriceEth: string;
  athPriceUsd: string;
  athTimestamp: string;
}

export interface Trade {
  id: string;
  curve: { id: string };
  phase: string;
  side: string; // "buy" | "sell"
  amountEth: string;
  amountToken: string;
  priceEth: string;
  priceUsd: string;
  ethUsdAtTrade: string;
  trader: string;
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface EthBundle {
  ethUsd: string;
  ethUsdDecimals: number;
  updatedAt: string;
}

// ---------- GraphQL helper ----------

async function querySubgraph<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Subgraph request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (json.errors?.length) {
    throw new Error(`Subgraph error: ${json.errors[0].message}`);
  }

  if (!json.data) {
    throw new Error("No data returned from subgraph");
  }

  return json.data;
}

// ---------- Curve query fields ----------

const CURVE_FIELDS = `
  id
  token
  name
  symbol
  uri
  creator
  createdAt
  graduated
  graduatedAt
  lastPriceEth
  lastPriceUsd
  lastTradeAt
  totalVolumeEth
  ethCollected
  tradeCount
  athPriceEth
  athPriceUsd
  athTimestamp
`;

const TRADE_FIELDS = `
  id
  curve { id }
  phase
  side
  amountEth
  amountToken
  priceEth
  priceUsd
  ethUsdAtTrade
  trader
  timestamp
  blockNumber
  txHash
`;

// ---------- Public API ----------

/**
 * Fetch active (non-graduated) curves, sorted by totalVolumeEth descending.
 */
export async function getActiveCurves(limit = 100): Promise<CurveToken[]> {
  const data = await querySubgraph<{ curves: CurveToken[] }>(`
    {
      curves(
        where: { graduated: false }
        orderBy: totalVolumeEth
        orderDirection: desc
        first: ${limit}
      ) {
        ${CURVE_FIELDS}
      }
    }
  `);
  return data.curves;
}

/**
 * Fetch all curves (including graduated), sorted by totalVolumeEth descending.
 */
export async function getAllCurves(limit = 200): Promise<CurveToken[]> {
  const data = await querySubgraph<{ curves: CurveToken[] }>(`
    {
      curves(
        orderBy: totalVolumeEth
        orderDirection: desc
        first: ${limit}
      ) {
        ${CURVE_FIELDS}
      }
    }
  `);
  return data.curves;
}

/**
 * Fetch a single curve by its ID.
 */
export async function getCurveById(curveId: string): Promise<CurveToken | null> {
  const data = await querySubgraph<{ curve: CurveToken | null }>(`
    {
      curve(id: "${curveId.toLowerCase()}") {
        ${CURVE_FIELDS}
      }
    }
  `);
  return data.curve;
}

/**
 * Fetch recent trades for a specific curve.
 * Used for price charts and backtesting.
 */
export async function getTradesForCurve(
  curveId: string,
  limit = 1000,
  orderDirection: "asc" | "desc" = "desc"
): Promise<Trade[]> {
  const data = await querySubgraph<{ trades: Trade[] }>(`
    {
      trades(
        where: { curve: "${curveId.toLowerCase()}" }
        orderBy: timestamp
        orderDirection: ${orderDirection}
        first: ${limit}
      ) {
        ${TRADE_FIELDS}
      }
    }
  `);
  return data.trades;
}

/**
 * Fetch ETH/USD price from the Bundle entity.
 */
export async function getEthUsdPrice(): Promise<number> {
  try {
    const data = await querySubgraph<{ bundles: EthBundle[] }>(`
      {
        bundles(first: 1) {
          ethUsd
          ethUsdDecimals
          updatedAt
        }
      }
    `);
    if (data.bundles.length > 0) {
      return parseFloat(data.bundles[0].ethUsd);
    }
  } catch {
    // Fallback price if bundle query fails
  }
  return 2500; // fallback ETH price
}

/**
 * Search curves by name or symbol.
 */
export async function searchCurves(query: string, limit = 50): Promise<CurveToken[]> {
  // Goldsky subgraph doesn't support full-text search easily,
  // so we fetch all and filter in memory for MVP
  const allCurves = await getAllCurves(500);
  const lower = query.toLowerCase();
  return allCurves
    .filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.symbol.toLowerCase().includes(lower)
    )
    .slice(0, limit);
}
