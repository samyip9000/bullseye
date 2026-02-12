import type {
  TokensResponse,
  TradesResponse,
  Screener,
  Strategy,
  BacktestResult,
  StrategyParams,
  HistoricalTrade,
} from "../types";

const API_BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, string>).error || `Request failed: ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}

// ---------- Tokens ----------

export async function getTokens(params?: {
  q?: string;
  active?: boolean;
  limit?: number;
}): Promise<TokensResponse> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.active !== undefined) search.set("active", String(params.active));
  if (params?.limit) search.set("limit", String(params.limit));

  const qs = search.toString();
  return fetchJson<TokensResponse>(`/tokens${qs ? `?${qs}` : ""}`);
}

export async function getToken(id: string) {
  return fetchJson<
    TokensResponse["tokens"][0] & { ethUsdPrice: number }
  >(`/tokens/${id}`);
}

export async function getTrades(
  curveId: string,
  limit = 500,
  order: "asc" | "desc" = "desc"
): Promise<TradesResponse> {
  return fetchJson<TradesResponse>(
    `/tokens/${curveId}/trades?limit=${limit}&order=${order}`
  );
}

// ---------- Screeners ----------

export async function getScreeners(): Promise<{ screeners: Screener[] }> {
  return fetchJson("/screeners");
}

export async function createScreener(data: {
  name: string;
  filters: unknown[];
  sortField?: string;
  sortDirection?: string;
}): Promise<Screener> {
  return fetchJson("/screeners", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateScreener(
  id: string,
  data: Partial<{
    name: string;
    filters: unknown[];
    sortField: string;
    sortDirection: string;
  }>
): Promise<Screener> {
  return fetchJson(`/screeners/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteScreener(id: string): Promise<void> {
  await fetchJson(`/screeners/${id}`, { method: "DELETE" });
}

// ---------- Historical Trades (Goldsky) ----------

const GOLDSKY_URL =
  "https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn";

export async function fetchHistoricalTrades(
  curveId: string,
  limit = 50
): Promise<HistoricalTrade[]> {
  const res = await fetch(GOLDSKY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
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
        timestamp
        txHash
      }
    }
  `,
      variables: { curve: curveId, limit },
    }),
  });

  if (!res.ok) {
    throw new Error(`Goldsky request failed: ${res.status}`);
  }

  const json = await res.json();
  return (json?.data?.trades ?? []) as HistoricalTrade[];
}

// ---------- Strategies ----------

export async function getStrategies(): Promise<{ strategies: Strategy[] }> {
  return fetchJson("/strategies");
}

export async function getStrategy(
  id: string
): Promise<Strategy & { latestBacktest: { id: string; result: BacktestResult } | null }> {
  return fetchJson(`/strategies/${id}`);
}

export async function updateStrategy(
  id: string,
  data: Partial<{ name: string; strategyType: string; params: StrategyParams }>
): Promise<Strategy> {
  return fetchJson(`/strategies/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createStrategy(data: {
  name: string;
  tokenAddress: string;
  tokenName: string;
  curveId: string;
  strategyType: string;
  params: StrategyParams;
}): Promise<Strategy> {
  return fetchJson("/strategies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteStrategy(id: string): Promise<void> {
  await fetchJson(`/strategies/${id}`, { method: "DELETE" });
}

export async function runBacktest(
  strategyId: string
): Promise<{ backtestId: string; strategyId: string; result: BacktestResult }> {
  return fetchJson(`/strategies/${strategyId}/backtest`, { method: "POST" });
}

export async function runQuickBacktest(
  curveId: string,
  params: StrategyParams
): Promise<{ result: BacktestResult }> {
  return fetchJson("/strategies/quick-backtest", {
    method: "POST",
    body: JSON.stringify({ curveId, params }),
  });
}

// ---------- Telegram ----------

export interface TelegramPairResponse {
  success: boolean;
  status: string;
  telegramUsername: string | null;
  message: string;
}

export interface TelegramStatusResponse {
  connected: boolean;
  status: string | null;
  telegramUsername?: string | null;
  pairedAt?: string;
}

export async function pairTelegram(
  walletAddress: string,
  pairingCode: string
): Promise<TelegramPairResponse> {
  return fetchJson("/telegram/pair", {
    method: "POST",
    body: JSON.stringify({ walletAddress, pairingCode }),
  });
}

export async function getTelegramStatus(
  walletAddress: string
): Promise<TelegramStatusResponse> {
  return fetchJson(`/telegram/status?walletAddress=${encodeURIComponent(walletAddress)}`);
}

export async function disconnectTelegram(
  walletAddress: string
): Promise<{ success: boolean; message: string }> {
  return fetchJson("/telegram/disconnect", {
    method: "DELETE",
    body: JSON.stringify({ walletAddress }),
  });
}

// ---------- Telegram Actions (remote control) ----------

export interface TelegramAction {
  id: string;
  type: "apply_filter" | "open_strategy";
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function getTelegramActions(
  walletAddress: string
): Promise<{ actions: TelegramAction[] }> {
  return fetchJson(
    `/telegram/actions?walletAddress=${encodeURIComponent(walletAddress)}`
  );
}

export async function ackTelegramAction(actionId: string): Promise<void> {
  await fetchJson(`/telegram/actions/${actionId}/ack`, { method: "POST" });
}
