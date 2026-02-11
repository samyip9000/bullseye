import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  BarChart3,
  Percent,
} from "lucide-react";
import type { BacktestResult, BacktestTrade } from "../types";

interface BacktestResultsProps {
  result: BacktestResult;
  loading: boolean;
}

// ---------- Custom Marker Components ----------

function BuyMarker(props: {
  cx?: number;
  cy?: number;
  payload?: Record<string, unknown>;
}) {
  const { cx, cy } = props;
  if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) return null;
  return (
    <g>
      {/* Glow ring */}
      <circle cx={cx} cy={cy - 3} r={11} fill="rgba(0,255,65,0.12)" />
      {/* Up triangle = BUY */}
      <polygon
        points={`${cx},${cy - 11} ${cx - 7},${cy + 1} ${cx + 7},${cy + 1}`}
        fill="#00ff41"
        stroke="#0a0a0a"
        strokeWidth={1.2}
      />
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        fill="#00ff41"
        fontSize={8}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="bold"
      >
        BUY
      </text>
    </g>
  );
}

function SellMarker(props: {
  cx?: number;
  cy?: number;
  payload?: Record<string, unknown>;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) return null;
  const isTakeProfit = payload?.exitReason === "take_profit";
  const color = isTakeProfit ? "#ffd700" : "#ff3e3e";
  const label = isTakeProfit ? "TP" : "SL";
  return (
    <g>
      {/* Glow ring */}
      <circle cx={cx} cy={cy + 3} r={11} fill={`${color}18`} />
      {/* Down triangle = SELL */}
      <polygon
        points={`${cx},${cy + 11} ${cx - 7},${cy - 1} ${cx + 7},${cy - 1}`}
        fill={color}
        stroke="#0a0a0a"
        strokeWidth={1.2}
      />
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        fill={color}
        fontSize={8}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  );
}

// ---------- Custom Tooltips ----------

function EquityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-[#0c0c0c] border border-white/10 rounded-md p-2.5 font-mono text-[11px] shadow-2xl min-w-[140px]">
      <p className="text-gray-500 text-[10px] mb-1.5">{label}</p>
      <p className="text-gray-300">
        <span className="text-gray-500">Equity: </span>
        {(data.equity as number)?.toFixed(6)} ETH
      </p>
      {data.buySignal !== undefined && (
        <div className="mt-1.5 pt-1.5 border-t border-white/5">
          <p className="text-[#00ff41] font-bold flex items-center gap-1.5">
            <span className="text-sm">▲</span> BUY ENTRY
          </p>
        </div>
      )}
      {data.sellSignal !== undefined && (
        <div className="mt-1.5 pt-1.5 border-t border-white/5">
          <p
            className={`font-bold flex items-center gap-1.5 ${
              data.exitReason === "take_profit"
                ? "text-[#ffd700]"
                : "text-[#ff3e3e]"
            }`}
          >
            <span className="text-sm">▼</span>
            {data.exitReason === "take_profit"
              ? "TAKE PROFIT"
              : data.exitReason === "stop_loss"
              ? "STOP LOSS"
              : "EXIT (EOD)"}
          </p>
          {data.pnlPercent !== undefined && (
            <p
              className={`mt-0.5 ${
                (data.pnlPercent as number) >= 0
                  ? "text-[#00ff41]"
                  : "text-[#ff3e3e]"
              }`}
            >
              P&L:{" "}
              {(data.pnlPercent as number) >= 0 ? "+" : ""}
              {(data.pnlPercent as number).toFixed(2)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PriceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-[#0c0c0c] border border-white/10 rounded-md p-2.5 font-mono text-[11px] shadow-2xl min-w-[150px]">
      <p className="text-gray-500 text-[10px] mb-1.5">{label}</p>
      <p className="text-gray-300">
        <span className="text-gray-500">Price: </span>
        {(data.price as number)?.toExponential(3)} ETH
      </p>
      {data.buySignal !== undefined && (
        <div className="mt-1.5 pt-1.5 border-t border-white/5">
          <p className="text-[#00ff41] font-bold flex items-center gap-1.5">
            <span className="text-sm">▲</span> BUY @ {(data.buySignal as number).toExponential(2)}
          </p>
        </div>
      )}
      {data.sellSignal !== undefined && (
        <div className="mt-1.5 pt-1.5 border-t border-white/5">
          <p
            className={`font-bold flex items-center gap-1.5 ${
              data.exitReason === "take_profit"
                ? "text-[#ffd700]"
                : "text-[#ff3e3e]"
            }`}
          >
            <span className="text-sm">▼</span>
            {data.exitReason === "take_profit"
              ? "TAKE PROFIT"
              : data.exitReason === "stop_loss"
              ? "STOP LOSS"
              : "EXIT"}{" "}
            @ {(data.sellSignal as number).toExponential(2)}
          </p>
          {data.pnlPercent !== undefined && (
            <p
              className={`mt-0.5 ${
                (data.pnlPercent as number) >= 0
                  ? "text-[#00ff41]"
                  : "text-[#ff3e3e]"
              }`}
            >
              P&L:{" "}
              {(data.pnlPercent as number) >= 0 ? "+" : ""}
              {(data.pnlPercent as number).toFixed(2)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Data Processing ----------

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface EquityDataPoint {
  time: string;
  equity: number;
  buySignal?: number;
  sellSignal?: number;
  exitReason?: string;
  pnlPercent?: number;
}

interface PriceDataPoint {
  time: string;
  price: number;
  buySignal?: number;
  sellSignal?: number;
  exitReason?: string;
  pnlPercent?: number;
}

function processEquityData(result: BacktestResult): EquityDataPoint[] {
  // Build trade signal maps
  const tradeEntryTimestamps = new Set(
    result.trades.map((t) => t.entryTimestamp)
  );
  const tradeExitMap = new Map<number, BacktestTrade>();
  for (const trade of result.trades) {
    tradeExitMap.set(trade.exitTimestamp, trade);
  }

  const importantTimestamps = new Set([
    ...tradeEntryTimestamps,
    ...result.trades.map((t) => t.exitTimestamp),
  ]);

  // Smart downsampling that always preserves trade signal points
  const targetPoints = 200;
  const step = Math.max(
    1,
    Math.floor(result.equityCurve.length / targetPoints)
  );
  const sampled: Array<{ timestamp: number; equity: number }> = [];
  const addedTimestamps = new Set<number>();

  for (let i = 0; i < result.equityCurve.length; i++) {
    const point = result.equityCurve[i];
    if (i % step === 0 || importantTimestamps.has(point.timestamp)) {
      if (!addedTimestamps.has(point.timestamp)) {
        sampled.push(point);
        addedTimestamps.add(point.timestamp);
      }
    }
  }

  sampled.sort((a, b) => a.timestamp - b.timestamp);

  return sampled.map((point) => {
    const isBuy = tradeEntryTimestamps.has(point.timestamp);
    const exitTrade = tradeExitMap.get(point.timestamp);
    const equityVal = parseFloat(point.equity.toFixed(6));

    return {
      time: formatTime(point.timestamp),
      equity: equityVal,
      buySignal: isBuy ? equityVal : undefined,
      sellSignal: exitTrade ? equityVal : undefined,
      exitReason: exitTrade?.exitReason,
      pnlPercent: exitTrade?.pnlPercent,
    };
  });
}

function processPriceData(result: BacktestResult): {
  data: PriceDataPoint[];
  tradeRegions: Array<{ x1: string; x2: string; type: "win" | "loss" }>;
} {
  // Build trade signal maps
  const tradeEntryMap = new Map<number, BacktestTrade>();
  const tradeExitMap = new Map<number, BacktestTrade>();
  for (const trade of result.trades) {
    tradeEntryMap.set(trade.entryTimestamp, trade);
    tradeExitMap.set(trade.exitTimestamp, trade);
  }

  const importantTimestamps = new Set([
    ...result.trades.map((t) => t.entryTimestamp),
    ...result.trades.map((t) => t.exitTimestamp),
  ]);

  // Smart downsampling
  const targetPoints = 200;
  const step = Math.max(
    1,
    Math.floor(result.priceHistory.length / targetPoints)
  );
  const sampled: Array<{ timestamp: number; price: number }> = [];
  const addedTimestamps = new Set<number>();

  for (let i = 0; i < result.priceHistory.length; i++) {
    const point = result.priceHistory[i];
    if (i % step === 0 || importantTimestamps.has(point.timestamp)) {
      if (!addedTimestamps.has(point.timestamp)) {
        sampled.push(point);
        addedTimestamps.add(point.timestamp);
      }
    }
  }

  sampled.sort((a, b) => a.timestamp - b.timestamp);

  // Build time-string map for trade regions
  const tradeRegions = result.trades.map((trade) => ({
    x1: formatTime(trade.entryTimestamp),
    x2: formatTime(trade.exitTimestamp),
    type: trade.type,
  }));

  const data = sampled.map((point) => {
    const entryTrade = tradeEntryMap.get(point.timestamp);
    const exitTrade = tradeExitMap.get(point.timestamp);

    return {
      time: formatTime(point.timestamp),
      price: point.price,
      buySignal: entryTrade ? point.price : undefined,
      sellSignal: exitTrade ? point.price : undefined,
      exitReason: exitTrade?.exitReason,
      pnlPercent: exitTrade?.pnlPercent,
    };
  });

  return { data, tradeRegions };
}

// ---------- Stat Card ----------

function StatCard({
  label,
  value,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-gray-500" />
        <span className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-bold">
          {label}
        </span>
      </div>
      <span
        className={`text-lg font-mono font-bold ${
          positive === undefined
            ? "text-gray-200"
            : positive
            ? "text-phosphor"
            : "text-loss"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ---------- Chart Legend ----------

function ChartLegend() {
  return (
    <div className="flex items-center gap-5 text-[0.6rem] font-mono text-gray-400">
      <span className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <polygon points="6,1 1,10 11,10" fill="#00ff41" stroke="#0a0a0a" strokeWidth="0.8" />
        </svg>
        Buy Entry
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <polygon points="6,11 1,2 11,2" fill="#ffd700" stroke="#0a0a0a" strokeWidth="0.8" />
        </svg>
        Take Profit
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <polygon points="6,11 1,2 11,2" fill="#ff3e3e" stroke="#0a0a0a" strokeWidth="0.8" />
        </svg>
        Stop Loss
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-2 rounded-sm bg-[#00ff41]/10 border border-[#00ff41]/20 inline-block" />
        Win Region
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-2 rounded-sm bg-[#ff3e3e]/10 border border-[#ff3e3e]/20 inline-block" />
        Loss Region
      </span>
    </div>
  );
}

// ---------- Main Component ----------

export default function BacktestResults({
  result,
  loading,
}: BacktestResultsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-phosphor/30 border-t-phosphor rounded-full animate-spin" />
          <span className="text-xs text-gray-500 font-mono">
            Running backtest...
          </span>
        </div>
      </div>
    );
  }

  if (result.totalTrades === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="w-8 h-8 text-gray-600" />
          <p className="text-xs text-gray-500 font-mono">
            No trades triggered with these parameters.
          </p>
          <p className="text-[0.65rem] text-gray-600 font-mono max-w-xs">
            Try adjusting the entry threshold or lookback period. The token may
            not have enough trade history.
          </p>
        </div>
      </div>
    );
  }

  // Process data with trade signals preserved
  const equityData = processEquityData(result);
  const { data: priceData, tradeRegions } = processPriceData(result);
  const isProfitable = result.totalPnlPercent >= 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Overall Result Badge */}
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded border ${
          isProfitable
            ? "bg-phosphor/5 border-phosphor/20"
            : "bg-loss/5 border-loss/20"
        }`}
      >
        {isProfitable ? (
          <TrendingUp className="w-5 h-5 text-phosphor" />
        ) : (
          <TrendingDown className="w-5 h-5 text-loss" />
        )}
        <span
          className={`font-mono text-sm font-bold ${
            isProfitable ? "text-phosphor" : "text-loss"
          }`}
        >
          This strategy would have {isProfitable ? "made" : "lost"}{" "}
          {Math.abs(result.totalPnlPercent).toFixed(2)}% (
          {result.totalPnlEth >= 0 ? "+" : ""}
          {result.totalPnlEth.toFixed(6)} ETH)
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Trades"
          value={String(result.totalTrades)}
          icon={BarChart3}
        />
        <StatCard
          label="Win Rate"
          value={`${result.winRate.toFixed(1)}%`}
          icon={Award}
          positive={result.winRate >= 50}
        />
        <StatCard
          label="Total P&L"
          value={`${result.totalPnlPercent >= 0 ? "+" : ""}${result.totalPnlPercent.toFixed(2)}%`}
          icon={Percent}
          positive={result.totalPnlPercent >= 0}
        />
        <StatCard
          label="Max Drawdown"
          value={`-${result.maxDrawdownPercent.toFixed(2)}%`}
          icon={AlertTriangle}
          positive={result.maxDrawdownPercent < 20}
        />
      </div>

      {/* Equity Curve Chart with Buy/Sell Signals */}
      {equityData.length > 1 && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[0.65rem] uppercase tracking-[2px] text-gray-500 font-bold">
              Equity Curve &mdash; Buy / Sell Positions
            </h4>
            <ChartLegend />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={equityData} margin={{ top: 20, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.03)"
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: "#666" }}
                stroke="rgba(255,255,255,0.05)"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#666" }}
                stroke="rgba(255,255,255,0.05)"
                tickFormatter={(v: number) => v.toFixed(4)}
              />
              <Tooltip content={<EquityTooltip />} />
              <ReferenceLine
                y={equityData[0]?.equity}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="3 3"
                label={{
                  value: "Start",
                  position: "left",
                  fill: "#555",
                  fontSize: 9,
                }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={isProfitable ? "#00ff41" : "#ff3e3e"}
                fill={
                  isProfitable
                    ? "rgba(0,255,65,0.08)"
                    : "rgba(255,62,62,0.08)"
                }
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              {/* Buy signal markers */}
              <Line
                type="monotone"
                dataKey="buySignal"
                stroke="transparent"
                strokeWidth={0}
                dot={<BuyMarker />}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              {/* Sell signal markers */}
              <Line
                type="monotone"
                dataKey="sellSignal"
                stroke="transparent"
                strokeWidth={0}
                dot={<SellMarker />}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Price History Chart with Trade Regions & Signals */}
      {priceData.length > 1 && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[0.65rem] uppercase tracking-[2px] text-gray-500 font-bold">
              Price Action &mdash; Entry / Exit Points
            </h4>
            <ChartLegend />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={priceData} margin={{ top: 20, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.03)"
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: "#666" }}
                stroke="rgba(255,255,255,0.05)"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#666" }}
                stroke="rgba(255,255,255,0.05)"
                tickFormatter={(v: number) => v.toExponential(1)}
              />
              <Tooltip content={<PriceTooltip />} />
              {/* Trade region shading: green = win, red = loss */}
              {tradeRegions.map((region, i) => (
                <ReferenceArea
                  key={`region-${i}`}
                  x1={region.x1}
                  x2={region.x2}
                  fill={
                    region.type === "win"
                      ? "rgba(0,255,65,0.06)"
                      : "rgba(255,62,62,0.06)"
                  }
                  stroke={
                    region.type === "win"
                      ? "rgba(0,255,65,0.15)"
                      : "rgba(255,62,62,0.15)"
                  }
                  strokeDasharray="2 2"
                />
              ))}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#00ff41"
                dot={false}
                strokeWidth={1}
                isAnimationActive={false}
              />
              {/* Buy entry markers */}
              <Line
                type="monotone"
                dataKey="buySignal"
                stroke="transparent"
                strokeWidth={0}
                dot={<BuyMarker />}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              {/* Sell exit markers */}
              <Line
                type="monotone"
                dataKey="sellSignal"
                stroke="transparent"
                strokeWidth={0}
                dot={<SellMarker />}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trade Summary Strip */}
      {result.trades.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {result.trades.map((trade, i) => {
            const isWin = trade.type === "win";
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-[0.65rem] font-mono border ${
                  isWin
                    ? "bg-phosphor/5 border-phosphor/15 text-phosphor"
                    : "bg-loss/5 border-loss/15 text-loss"
                }`}
              >
                <span className="font-bold">#{i + 1}</span>
                <span className="text-gray-500">
                  {trade.entryPrice.toExponential(1)} &rarr;{" "}
                  {trade.exitPrice.toExponential(1)}
                </span>
                <span className="font-bold">
                  {trade.pnlPercent >= 0 ? "+" : ""}
                  {trade.pnlPercent.toFixed(1)}%
                </span>
                <span
                  className={`text-[0.55rem] uppercase px-1.5 py-0.5 rounded ${
                    trade.exitReason === "take_profit"
                      ? "bg-[#ffd700]/10 text-[#ffd700]"
                      : trade.exitReason === "stop_loss"
                      ? "bg-loss/10 text-loss"
                      : "bg-white/5 text-gray-500"
                  }`}
                >
                  {trade.exitReason === "take_profit"
                    ? "TP"
                    : trade.exitReason === "stop_loss"
                    ? "SL"
                    : "EOD"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Trade History Table */}
      {result.trades.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded overflow-hidden">
          <h4 className="text-[0.65rem] uppercase tracking-[2px] text-gray-500 font-bold p-4 pb-2">
            Trade History
          </h4>
          <div className="max-h-48 overflow-auto">
            <table className="w-full font-mono text-[0.7rem]">
              <thead>
                <tr className="border-b border-white/[0.03]">
                  <th className="text-left px-4 py-2 text-gray-600">#</th>
                  <th className="text-left px-4 py-2 text-gray-600">
                    ENTRY PRICE
                  </th>
                  <th className="text-left px-4 py-2 text-gray-600">
                    EXIT PRICE
                  </th>
                  <th className="text-right px-4 py-2 text-gray-600">
                    P&L %
                  </th>
                  <th className="text-right px-4 py-2 text-gray-600">
                    P&L ETH
                  </th>
                  <th className="text-right px-4 py-2 text-gray-600">
                    REASON
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((trade, i) => (
                  <tr key={i} className="border-b border-white/[0.015]">
                    <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2 text-[#00ff41]">
                      {trade.entryPrice.toExponential(2)}
                    </td>
                    <td
                      className={`px-4 py-2 ${
                        trade.exitReason === "take_profit"
                          ? "text-[#ffd700]"
                          : "text-[#ff3e3e]"
                      }`}
                    >
                      {trade.exitPrice.toExponential(2)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-bold ${
                        trade.pnlPercent >= 0 ? "text-phosphor" : "text-loss"
                      }`}
                    >
                      {trade.pnlPercent >= 0 ? "+" : ""}
                      {trade.pnlPercent.toFixed(2)}%
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        trade.pnlEth >= 0 ? "text-phosphor" : "text-loss"
                      }`}
                    >
                      {trade.pnlEth >= 0 ? "+" : ""}
                      {trade.pnlEth.toFixed(6)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`text-[0.6rem] uppercase px-2 py-0.5 rounded ${
                          trade.exitReason === "take_profit"
                            ? "bg-[#ffd700]/10 text-[#ffd700]"
                            : trade.exitReason === "stop_loss"
                            ? "bg-loss/10 text-loss"
                            : "bg-white/5 text-gray-500"
                        }`}
                      >
                        {trade.exitReason.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
