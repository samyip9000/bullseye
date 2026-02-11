import { Hono } from "hono";
import db from "../db";
import { runBacktest, type StrategyParams } from "../services/backtest";

const app = new Hono();

// ---------- GET /strategies ----------
app.get("/", (c) => {
  const strategies = db
    .query("SELECT * FROM strategies ORDER BY updated_at DESC")
    .all();

  return c.json({
    strategies: strategies.map((s: Record<string, unknown>) => ({
      ...s,
      params: JSON.parse(s.params as string),
    })),
  });
});

// ---------- GET /strategies/:id ----------
app.get("/:id", (c) => {
  const id = c.req.param("id");
  const strategy = db
    .query("SELECT * FROM strategies WHERE id = ?")
    .get(id) as Record<string, unknown> | null;

  if (!strategy) {
    return c.json({ error: "Strategy not found" }, 404);
  }

  // Get latest backtest result
  const latestBacktest = db
    .query(
      "SELECT * FROM backtest_results WHERE strategy_id = ? ORDER BY executed_at DESC LIMIT 1"
    )
    .get(id) as Record<string, unknown> | null;

  return c.json({
    ...strategy,
    params: JSON.parse(strategy.params as string),
    latestBacktest: latestBacktest
      ? {
          ...latestBacktest,
          result: JSON.parse(latestBacktest.result as string),
        }
      : null,
  });
});

// ---------- POST /strategies ----------
app.post("/", async (c) => {
  const body = await c.req.json();
  const { name, tokenAddress, tokenName, curveId, strategyType, params } = body;

  if (!name || !curveId) {
    return c.json({ error: "Name and curveId are required" }, 400);
  }

  const id = crypto.randomUUID();

  const defaultParams: StrategyParams = {
    entryType: strategyType || "price_dip",
    entryThresholdPercent: -5,
    lookbackTrades: 20,
    takeProfitPercent: 20,
    stopLossPercent: -10,
    positionSizeEth: 0.1,
    ...params,
  };

  db.query(
    `INSERT INTO strategies (id, name, token_address, token_name, curve_id, strategy_type, params)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    tokenAddress || "",
    tokenName || "",
    curveId,
    strategyType || "price_dip",
    JSON.stringify(defaultParams)
  );

  const strategy = db
    .query("SELECT * FROM strategies WHERE id = ?")
    .get(id) as Record<string, unknown>;

  return c.json(
    {
      ...strategy,
      params: JSON.parse(strategy.params as string),
    },
    201
  );
});

// ---------- PUT /strategies/:id ----------
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { name, params, strategyType } = body;

  const existing = db.query("SELECT * FROM strategies WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Strategy not found" }, 404);
  }

  db.query(
    `UPDATE strategies SET
      name = COALESCE(?, name),
      strategy_type = COALESCE(?, strategy_type),
      params = COALESCE(?, params),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name || null,
    strategyType || null,
    params ? JSON.stringify(params) : null,
    id
  );

  const updated = db.query("SELECT * FROM strategies WHERE id = ?").get(id) as Record<string, unknown>;
  return c.json({
    ...updated,
    params: JSON.parse(updated.params as string),
  });
});

// ---------- DELETE /strategies/:id ----------
app.delete("/:id", (c) => {
  const id = c.req.param("id");
  db.query("DELETE FROM backtest_results WHERE strategy_id = ?").run(id);
  db.query("DELETE FROM strategies WHERE id = ?").run(id);
  return c.json({ success: true });
});

// ---------- POST /strategies/:id/backtest ----------
// Run a backtest for a strategy
app.post("/:id/backtest", async (c) => {
  try {
    const id = c.req.param("id");
    const strategy = db
      .query("SELECT * FROM strategies WHERE id = ?")
      .get(id) as Record<string, unknown> | null;

    if (!strategy) {
      return c.json({ error: "Strategy not found" }, 404);
    }

    const params = JSON.parse(strategy.params as string) as StrategyParams;
    const curveId = strategy.curve_id as string;

    // Run backtest
    const result = await runBacktest(curveId, params);

    // Save result
    const backtestId = crypto.randomUUID();
    db.query(
      `INSERT INTO backtest_results (id, strategy_id, token_address, result)
       VALUES (?, ?, ?, ?)`
    ).run(
      backtestId,
      id,
      strategy.token_address as string,
      JSON.stringify(result)
    );

    return c.json({
      backtestId,
      strategyId: id,
      result,
    });
  } catch (err: unknown) {
    console.error("Backtest error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Backtest failed", detail: message }, 500);
  }
});

// ---------- POST /strategies/quick-backtest ----------
// Run a quick backtest without saving the strategy
app.post("/quick-backtest", async (c) => {
  try {
    const body = await c.req.json();
    const { curveId, params } = body;

    if (!curveId || !params) {
      return c.json({ error: "curveId and params are required" }, 400);
    }

    const strategyParams: StrategyParams = {
      entryType: params.entryType || "price_dip",
      entryThresholdPercent: params.entryThresholdPercent ?? -5,
      lookbackTrades: params.lookbackTrades ?? 20,
      takeProfitPercent: params.takeProfitPercent ?? 20,
      stopLossPercent: params.stopLossPercent ?? -10,
      positionSizeEth: params.positionSizeEth ?? 0.1,
    };

    const result = await runBacktest(curveId, strategyParams);

    return c.json({ result });
  } catch (err: unknown) {
    console.error("Quick backtest error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Backtest failed", detail: message }, 500);
  }
});

export default app;
