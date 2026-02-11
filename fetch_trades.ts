/**
 * Fetch actual trade history for all screener tokens from the Goldsky subgraph.
 * 
 * Usage: bun run fetch_trades.ts
 * 
 * Outputs:
 *   - docs/trade_history_all_tokens.json  (full raw data)
 *   - docs/TRADE_HISTORY_REPORT.md        (formatted markdown report)
 */

const SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn";

// ---------- Types ----------

interface Curve {
  id: string;
  token: string;
  name: string;
  symbol: string;
  graduated: boolean;
  tradeCount: string;
  totalVolumeEth: string;
  lastPriceEth: string;
  lastPriceUsd: string;
  ethCollected: string;
  createdAt: string;
}

interface Trade {
  side: string;
  trader: string;
  amountEth: string;
  amountToken: string;
  priceEth: string;
  priceUsd: string;
  timestamp: string;
  txHash: string;
}

interface TokenTradeData {
  symbol: string;
  name: string;
  curveId: string;
  tokenAddress: string;
  graduated: boolean;
  tradeCount: number;
  totalVolumeEth: string;
  lastPriceEth: string;
  lastPriceUsd: string;
  ethCollected: string;
  fetchedTrades: number;
  trades: Array<{
    side: string;
    trader: string;
    amountEth: string;
    amountToken: string;
    priceEth: string;
    priceUsd: string;
    timestamp: string;
    date: string;
    txHash: string;
  }>;
}

// ---------- GraphQL helper ----------

async function querySubgraph<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Subgraph HTTP ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }
  if (!json.data) {
    throw new Error("No data returned from subgraph");
  }

  return json.data;
}

// ---------- Fetchers ----------

async function getAllCurves(): Promise<Curve[]> {
  const data = await querySubgraph<{ curves: Curve[] }>(`{
    curves(orderBy: totalVolumeEth, orderDirection: desc, first: 200) {
      id
      token
      name
      symbol
      graduated
      tradeCount
      totalVolumeEth
      lastPriceEth
      lastPriceUsd
      ethCollected
      createdAt
    }
  }`);
  return data.curves;
}

async function getTradesForCurve(curveId: string, limit = 50): Promise<Trade[]> {
  const data = await querySubgraph<{ trades: Trade[] }>(`
    query GetTrades($curve: ID!, $limit: Int!) {
      trades(
        where: { curve: $curve }
        orderBy: timestamp
        orderDirection: desc
        first: $limit
      ) {
        side
        trader
        amountEth
        amountToken
        priceEth
        priceUsd
        timestamp
        txHash
      }
    }
  `, { curve: curveId, limit });
  return data.trades;
}

// ---------- Helpers ----------

function formatEth(val: string): string {
  const n = parseFloat(val);
  if (n === 0) return "0";
  if (n < 0.000001) return n.toExponential(4);
  if (n < 0.01) return n.toFixed(8);
  return n.toFixed(6);
}

function formatUsd(val: string): string {
  const n = parseFloat(val);
  if (n === 0) return "$0";
  if (n < 0.0001) return `$${n.toExponential(4)}`;
  if (n < 0.01) return `$${n.toFixed(8)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------- Markdown Report Generator ----------

function generateMarkdown(results: Record<string, TokenTradeData>): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push("# Bullseye v2 — Actual Trade History Report");
  lines.push("");
  lines.push(`**Generated:** ${now}`);
  lines.push(`**Source:** Goldsky Subgraph (pump-charts/v2)`);
  lines.push(`**Network:** Base (Chain ID: 8453)`);
  lines.push(`**Starting Balance for Test Cases:** 18 USDC`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Summary table
  const entries = Object.values(results).sort((a, b) => b.tradeCount - a.tradeCount);

  lines.push("## Token Summary");
  lines.push("");
  lines.push("| # | Symbol | Name | Curve ID | Status | Trades | Volume (ETH) | Last Price (ETH) | Last Price (USD) | Fetched |");
  lines.push("|---|--------|------|----------|--------|--------|--------------|------------------|------------------|---------|");

  entries.forEach((t, i) => {
    const status = t.graduated ? "GRADUATED" : "BONDING";
    const curveShort = truncAddr(t.curveId);
    lines.push(
      `| ${i + 1} | ${t.symbol} | ${t.name} | \`${curveShort}\` | ${status} | ${t.tradeCount} | ${formatEth(t.totalVolumeEth)} | ${formatEth(t.lastPriceEth)} | ${formatUsd(t.lastPriceUsd)} | ${t.fetchedTrades} |`
    );
  });

  lines.push("");
  lines.push("---");
  lines.push("");

  // Detailed trade history for each token
  lines.push("## Detailed Trade History Per Token");
  lines.push("");

  entries.forEach((t, idx) => {
    const status = t.graduated ? "GRADUATED" : "BONDING";

    lines.push(`### ${idx + 1}. ${t.symbol} — ${t.name}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|-------|-------|");
    lines.push(`| **Curve ID** | \`${t.curveId}\` |`);
    lines.push(`| **Token Address** | \`${t.tokenAddress}\` |`);
    lines.push(`| **Status** | ${status} |`);
    lines.push(`| **Total Trades** | ${t.tradeCount} |`);
    lines.push(`| **Total Volume** | ${formatEth(t.totalVolumeEth)} ETH |`);
    lines.push(`| **ETH Collected** | ${formatEth(t.ethCollected)} ETH |`);
    lines.push(`| **Last Price** | ${formatEth(t.lastPriceEth)} ETH / ${formatUsd(t.lastPriceUsd)} |`);
    lines.push(`| **Trades Fetched** | ${t.fetchedTrades} |`);
    lines.push("");

    if (t.trades.length === 0) {
      lines.push("*No trade data available.*");
      lines.push("");
    } else {
      lines.push("**Recent Trades (newest first):**");
      lines.push("");
      lines.push("| # | Side | ETH Amount | Token Amount | Price (ETH) | Price (USD) | Date/Time | Tx Hash |");
      lines.push("|---|------|------------|--------------|-------------|-------------|-----------|---------|");

      t.trades.forEach((trade, ti) => {
        const side = trade.side.toUpperCase();
        const txShort = trade.txHash ? `\`${trade.txHash.slice(0, 10)}...\`` : "—";
        lines.push(
          `| ${ti + 1} | **${side}** | ${formatEth(trade.amountEth)} | ${formatEth(trade.amountToken)} | ${formatEth(trade.priceEth)} | ${formatUsd(trade.priceUsd)} | ${trade.date} | ${txShort} |`
        );
      });

      lines.push("");

      // Trade statistics
      const buys = t.trades.filter(tr => tr.side === "buy");
      const sells = t.trades.filter(tr => tr.side === "sell");
      const totalBuyEth = buys.reduce((s, tr) => s + parseFloat(tr.amountEth), 0);
      const totalSellEth = sells.reduce((s, tr) => s + parseFloat(tr.amountEth), 0);

      lines.push("**Trade Summary (fetched window):**");
      lines.push("");
      lines.push(`| Metric | Value |`);
      lines.push(`|--------|-------|`);
      lines.push(`| Buy trades | ${buys.length} |`);
      lines.push(`| Sell trades | ${sells.length} |`);
      lines.push(`| Total buy volume | ${formatEth(String(totalBuyEth))} ETH |`);
      lines.push(`| Total sell volume | ${formatEth(String(totalSellEth))} ETH |`);
      lines.push(`| Buy/Sell ratio | ${sells.length > 0 ? (buys.length / sells.length).toFixed(2) : "∞"} |`);

      if (t.trades.length >= 2) {
        const newest = new Date(t.trades[0].date);
        const oldest = new Date(t.trades[t.trades.length - 1].date);
        const spanHours = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60);
        lines.push(`| Time span | ${spanHours.toFixed(1)} hours |`);
        lines.push(`| Avg trades/hour | ${(t.trades.length / Math.max(spanHours, 0.01)).toFixed(1)} |`);
      }

      // Price range in fetched window
      const prices = t.trades.map(tr => parseFloat(tr.priceEth)).filter(p => p > 0);
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice > 0 ? ((maxPrice - minPrice) / minPrice * 100).toFixed(1) : "0";
        lines.push(`| Price range (ETH) | ${formatEth(String(minPrice))} — ${formatEth(String(maxPrice))} |`);
        lines.push(`| Price volatility | ${priceRange}% |`);
      }

      lines.push("");
      
      // Unique traders
      const uniqueTraders = new Set(t.trades.map(tr => tr.trader));
      lines.push(`**Unique traders in window:** ${uniqueTraders.size}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  });

  // Sample trade recommendations for 18 USDC
  lines.push("## Recommended Test Trades (18 USDC Budget)");
  lines.push("");
  lines.push("Based on actual trade data, here are the recommended sample trades:");
  lines.push("");

  const graduated = entries.filter(t => t.graduated);
  const bondingActive = entries.filter(t => !t.graduated && t.tradeCount >= 20);
  const bondingLow = entries.filter(t => !t.graduated && t.tradeCount < 20 && t.tradeCount >= 5);

  lines.push("### Tier 1: Graduated Tokens ($6 USDC total — $2 each)");
  lines.push("");
  graduated.slice(0, 3).forEach((t, i) => {
    lines.push(`${i + 1}. **${t.symbol}** (${t.name}) — \`${t.curveId}\` — ${t.tradeCount} trades, backtest only (graduated)`);
  });
  if (graduated.length === 0) lines.push("*No graduated tokens found*");
  lines.push("");

  lines.push("### Tier 2: Active Bonding Tokens ($6 USDC total — $1 each)");
  lines.push("");
  bondingActive.slice(0, 6).forEach((t, i) => {
    lines.push(`${i + 1}. **${t.symbol}** (${t.name}) — \`${t.curveId}\` — ${t.tradeCount} trades`);
  });
  if (bondingActive.length === 0) lines.push("*No active bonding tokens found*");
  lines.push("");

  lines.push("### Tier 3: Low-Activity Tokens ($4 USDC total — $1 each)");
  lines.push("");
  bondingLow.slice(0, 4).forEach((t, i) => {
    lines.push(`${i + 1}. **${t.symbol}** (${t.name}) — \`${t.curveId}\` — ${t.tradeCount} trades`);
  });
  if (bondingLow.length === 0) lines.push("*No low-activity tokens found*");
  lines.push("");

  lines.push("### Reserve: $2 USDC for gas");
  lines.push("");

  return lines.join("\n");
}

// ---------- Main ----------

async function main() {
  console.log("=== Bullseye v2 — Fetching Trade History from Goldsky ===\n");

  // Step 1: Get all curves
  console.log("Step 1: Fetching all curves...");
  const curves = await getAllCurves();
  console.log(`  Found ${curves.length} curves\n`);

  // Step 2: Fetch trades for each curve
  const results: Record<string, TokenTradeData> = {};
  let processed = 0;
  const total = curves.length;

  for (const curve of curves) {
    processed++;
    const symbol = curve.symbol;
    const name = curve.name;
    const curveId = curve.id;
    const tradeCount = parseInt(curve.tradeCount) || 0;

    const progress = `[${processed}/${total}]`;
    process.stdout.write(`${progress} ${symbol} (${name})... `);

    try {
      // Fetch up to 50 most recent trades
      const trades = await getTradesForCurve(curveId, 50);

      results[curveId] = {
        symbol,
        name,
        curveId,
        tokenAddress: curve.token,
        graduated: curve.graduated,
        tradeCount,
        totalVolumeEth: curve.totalVolumeEth,
        lastPriceEth: curve.lastPriceEth,
        lastPriceUsd: curve.lastPriceUsd,
        ethCollected: curve.ethCollected,
        fetchedTrades: trades.length,
        trades: trades.map((t) => ({
          side: t.side,
          trader: t.trader,
          amountEth: t.amountEth,
          amountToken: t.amountToken,
          priceEth: t.priceEth,
          priceUsd: t.priceUsd,
          timestamp: t.timestamp,
          date: new Date(parseInt(t.timestamp) * 1000).toISOString(),
          txHash: t.txHash,
        })),
      };

      console.log(`${trades.length} trades fetched`);
    } catch (err) {
      console.log(`ERROR: ${err}`);
      results[curveId] = {
        symbol, name, curveId,
        tokenAddress: curve.token,
        graduated: curve.graduated,
        tradeCount,
        totalVolumeEth: curve.totalVolumeEth,
        lastPriceEth: curve.lastPriceEth,
        lastPriceUsd: curve.lastPriceUsd,
        ethCollected: curve.ethCollected,
        fetchedTrades: 0,
        trades: [],
      };
    }

    // Small delay to avoid rate limiting
    await sleep(100);
  }

  // Step 3: Write JSON output
  const jsonPath = "./docs/trade_history_all_tokens.json";
  await Bun.write(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\nJSON output: ${jsonPath}`);

  // Step 4: Generate markdown report
  const mdPath = "./docs/TRADE_HISTORY_REPORT.md";
  const markdown = generateMarkdown(results);
  await Bun.write(mdPath, markdown);
  console.log(`Markdown report: ${mdPath}`);

  // Print summary
  const totalTokens = Object.keys(results).length;
  const totalTradesFetched = Object.values(results).reduce((s, t) => s + t.fetchedTrades, 0);
  const graduatedCount = Object.values(results).filter(t => t.graduated).length;
  const bondingCount = totalTokens - graduatedCount;

  console.log(`\n=== Summary ===`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`  Graduated: ${graduatedCount}`);
  console.log(`  Bonding: ${bondingCount}`);
  console.log(`Total trades fetched: ${totalTradesFetched}`);
  console.log(`\nDone!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
