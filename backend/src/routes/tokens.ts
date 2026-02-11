import { Hono } from "hono";
import {
  getAllCurves,
  getActiveCurves,
  getCurveById,
  getTradesForCurve,
  getEthUsdPrice,
  searchCurves,
} from "../services/robinpump";

const app = new Hono();

// ---------- GET /tokens ----------
// Returns token list from RobinPump with optional filtering
app.get("/", async (c) => {
  try {
    const query = c.req.query("q");
    const activeOnly = c.req.query("active") !== "false";
    const limit = parseInt(c.req.query("limit") || "100");

    let curves;
    if (query) {
      curves = await searchCurves(query, limit);
    } else if (activeOnly) {
      curves = await getActiveCurves(limit);
    } else {
      curves = await getAllCurves(limit);
    }

    // Get ETH/USD price for conversion
    const ethUsdPrice = await getEthUsdPrice();

    // Transform for frontend using actual subgraph fields
    const tokens = curves.map((curve) => {
      const priceEth = parseFloat(curve.lastPriceEth) || 0;
      const priceUsd = parseFloat(curve.lastPriceUsd) || 0;
      const totalVolumeEth = parseFloat(curve.totalVolumeEth) || 0;
      const ethCollected = parseFloat(curve.ethCollected) || 0;
      const tradeCount = parseInt(curve.tradeCount) || 0;
      const athPriceUsd = parseFloat(curve.athPriceUsd) || 0;

      // Estimate market cap: for bonding curves this is roughly ethCollected * 2
      // since the virtual reserve model means total supply value ≈ 2x ETH in curve
      const marketCapEth = priceEth * totalVolumeEth;
      const marketCapUsd = marketCapEth * ethUsdPrice;

      return {
        id: curve.id,
        tokenAddress: curve.token,
        name: curve.name,
        symbol: curve.symbol,
        uri: curve.uri,
        priceEth,
        priceUsd,
        marketCapEth,
        marketCapUsd,
        ethCollected,
        ethCollectedUsd: ethCollected * ethUsdPrice,
        totalVolumeEth,
        totalVolumeUsd: totalVolumeEth * ethUsdPrice,
        tradeCount,
        graduated: curve.graduated,
        creator: curve.creator,
        athPriceUsd,
        lastTradeAt: parseInt(curve.lastTradeAt) || 0,
        createdAt: parseInt(curve.createdAt) || 0,
      };
    });

    return c.json({
      tokens,
      ethUsdPrice,
      count: tokens.length,
    });
  } catch (err: unknown) {
    console.error("Error fetching tokens:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Failed to fetch tokens", detail: message }, 500);
  }
});

// ---------- GET /tokens/:id ----------
// Returns a single token by curve ID
app.get("/:id", async (c) => {
  try {
    const curveId = c.req.param("id");
    const curve = await getCurveById(curveId);

    if (!curve) {
      return c.json({ error: "Token not found" }, 404);
    }

    const ethUsdPrice = await getEthUsdPrice();
    const priceEth = parseFloat(curve.lastPriceEth) || 0;
    const priceUsd = parseFloat(curve.lastPriceUsd) || 0;
    const totalVolumeEth = parseFloat(curve.totalVolumeEth) || 0;
    const ethCollected = parseFloat(curve.ethCollected) || 0;
    const marketCapEth = ethCollected * 2;

    return c.json({
      id: curve.id,
      tokenAddress: curve.token,
      name: curve.name,
      symbol: curve.symbol,
      uri: curve.uri,
      priceEth,
      priceUsd,
      marketCapEth,
      marketCapUsd: marketCapEth * ethUsdPrice,
      ethCollected,
      ethCollectedUsd: ethCollected * ethUsdPrice,
      totalVolumeEth,
      totalVolumeUsd: totalVolumeEth * ethUsdPrice,
      tradeCount: parseInt(curve.tradeCount) || 0,
      graduated: curve.graduated,
      creator: curve.creator,
      athPriceUsd: parseFloat(curve.athPriceUsd) || 0,
      lastTradeAt: parseInt(curve.lastTradeAt) || 0,
      createdAt: parseInt(curve.createdAt) || 0,
      ethUsdPrice,
    });
  } catch (err: unknown) {
    console.error("Error fetching token:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Failed to fetch token", detail: message }, 500);
  }
});

// ---------- GET /tokens/:id/trades ----------
// Returns trade history for a specific curve
app.get("/:id/trades", async (c) => {
  try {
    const curveId = c.req.param("id");
    const limit = parseInt(c.req.query("limit") || "500");
    const order = (c.req.query("order") as "asc" | "desc") || "desc";

    const trades = await getTradesForCurve(curveId, limit, order);
    const ethUsdPrice = await getEthUsdPrice();

    const formattedTrades = trades.map((trade) => ({
      id: trade.id,
      trader: trade.trader,
      type: trade.side,
      phase: trade.phase,
      ethAmount: parseFloat(trade.amountEth) || 0,
      tokenAmount: parseFloat(trade.amountToken) || 0,
      priceEth: parseFloat(trade.priceEth) || 0,
      priceUsd: parseFloat(trade.priceUsd) || 0,
      ethUsdAtTrade: parseFloat(trade.ethUsdAtTrade) || 0,
      timestamp: parseInt(trade.timestamp) || 0,
      txHash: trade.txHash,
    }));

    return c.json({
      trades: formattedTrades,
      count: formattedTrades.length,
      ethUsdPrice,
    });
  } catch (err: unknown) {
    console.error("Error fetching trades:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Failed to fetch trades", detail: message }, 500);
  }
});

// ---------- GET /tokens/price/eth ----------
// Returns current ETH/USD price
app.get("/price/eth", async (c) => {
  try {
    const ethUsdPrice = await getEthUsdPrice();
    return c.json({ ethUsdPrice });
  } catch {
    return c.json({ ethUsdPrice: 2500 });
  }
});

export default app;
