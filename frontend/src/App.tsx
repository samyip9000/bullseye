import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Screener from "./components/Screener";
import StrategyView from "./components/StrategyView";
import StrategyDashboard from "./components/StrategyDashboard";
import StrategyDetail from "./components/StrategyDetail";
import LiveStrategyBar from "./components/LiveStrategyBar";
import { useWallet } from "./contexts/WalletContext";
import { useStrategyExecutor } from "./hooks/useStrategyExecutor";
import { useTelegramActions } from "./hooks/useTelegramActions";
import type { Token, FilterRule, LiveStrategy, LiveExecutedTrade, LiveStrategyResult } from "./types";
import { getTokens } from "./services/api";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [ethUsdPrice, setEthUsdPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [liveStrategy, setLiveStrategy] = useState<LiveStrategy | null>(null);
  const [executorStatus, setExecutorStatus] = useState<string | null>(null);

  // External filters from Telegram /screen command
  const [externalFilters, setExternalFilters] = useState<{
    filters: FilterRule[];
    query: string;
  } | null>(null);

  const { walletClient, publicClient, address, isConnected, balances } =
    useWallet();
  const { execute, stop } = useStrategyExecutor();

  // Telegram action relay — polls for commands from the bot
  const handleApplyFilters = useCallback(
    (filters: FilterRule[], rawQuery: string) => {
      setExternalFilters({ filters, query: rawQuery });
    },
    []
  );
  useTelegramActions({ onApplyFilters: handleApplyFilters });

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTokens({ active: false, limit: 200 });
      setTokens(data.tokens);
      setEthUsdPrice(data.ethUsdPrice);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load token data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 30000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  const handleSelectTokenForStrategy = (token: Token) => {
    setSelectedToken(token);
    navigate("/strategy/create");
  };

  const handleExecuteStrategy = useCallback(
    (strategy: LiveStrategy) => {
      setLiveStrategy(strategy);
      setExecutorStatus(null);

      if (!walletClient || !address || !isConnected) {
        setExecutorStatus("Wallet not connected — connect first");
        return;
      }

      // Start the on-chain execution
      execute(strategy, walletClient, publicClient, address, {
        onTradeExecuted: (trade: LiveExecutedTrade) => {
          setLiveStrategy((prev) =>
            prev
              ? {
                  ...prev,
                  executedTrades: [...prev.executedTrades, trade],
                }
              : null
          );
        },
        onStrategyComplete: (result: LiveStrategyResult) => {
          setLiveStrategy((prev) =>
            prev ? { ...prev, status: "completed", result } : null
          );
          setExecutorStatus(null);
        },
        onStatusUpdate: (msg: string) => {
          setExecutorStatus(msg);
        },
        onError: (msg: string) => {
          setExecutorStatus(`Error: ${msg}`);
        },
      });
    },
    [walletClient, publicClient, address, isConnected, execute]
  );

  const handleStopStrategy = useCallback(() => {
    stop(); // Signal the executor to abort
    // The executor will finish its current sell and then call onStrategyComplete
    // If it hasn't started selling yet, mark as cancelled immediately
    setLiveStrategy((prev) => {
      if (!prev) return null;
      // If no result yet, the executor will still call onStrategyComplete
      return { ...prev, status: "cancelled" };
    });
  }, [stop]);

  const handleDismissStrategy = useCallback(() => {
    setLiveStrategy(null);
    setExecutorStatus(null);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-obsidian overflow-hidden">
      <Header ethUsdPrice={ethUsdPrice} />

      {/* Sub-navbar: view tabs */}
      <nav className="flex border-b border-white/5 bg-[#0a0a0a]/60 shrink-0">
        <Link
          to="/screener"
          className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-widest transition-all ${
            location.pathname === "/" || location.pathname === "/screener"
              ? "text-phosphor bg-phosphor/10 border-b-2 border-phosphor"
              : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent"
          }`}
        >
          Screener
        </Link>
        <Link
          to="/strategy"
          className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-widest transition-all ${
            location.pathname.startsWith("/strategy")
              ? "text-phosphor bg-phosphor/10 border-b-2 border-phosphor"
              : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent"
          }`}
        >
          Strategy
        </Link>
      </nav>

      <main className={`flex-1 overflow-hidden ${liveStrategy ? "pb-14" : ""}`}>
        <Routes>
          <Route
            path="/"
            element={
              <Screener
                tokens={tokens}
                loading={loading}
                error={error}
                onRefresh={fetchTokens}
                onSelectForStrategy={handleSelectTokenForStrategy}
                externalFilters={externalFilters}
              />
            }
          />
          <Route
            path="/screener"
            element={
              <Screener
                tokens={tokens}
                loading={loading}
                error={error}
                onRefresh={fetchTokens}
                onSelectForStrategy={handleSelectTokenForStrategy}
                externalFilters={externalFilters}
              />
            }
          />
          <Route path="/strategy" element={<StrategyDashboard />} />
          <Route
            path="/strategy/create"
            element={
              <StrategyView
                tokens={tokens}
                selectedToken={selectedToken}
                onTokenSelect={setSelectedToken}
                onExecuteStrategy={handleExecuteStrategy}
                ethUsdPrice={ethUsdPrice}
                walletEthBalance={balances.eth}
              />
            }
          />
          <Route
            path="/strategy/:id"
            element={
              <StrategyDetail
                onExecuteStrategy={handleExecuteStrategy}
                walletEthBalance={balances.eth}
              />
            }
          />
        </Routes>
      </main>

      {/* Live Strategy Bar */}
      {liveStrategy && (
        <LiveStrategyBar
          strategy={liveStrategy}
          onStop={handleStopStrategy}
          onDismiss={handleDismissStrategy}
          statusMessage={executorStatus}
        />
      )}
    </div>
  );
}
