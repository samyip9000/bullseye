import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Screener from "./components/Screener";
import StrategyView from "./components/StrategyView";
import StrategyDashboard from "./components/StrategyDashboard";
import type { Token } from "./types";
import { getTokens } from "./services/api";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [ethUsdPrice, setEthUsdPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

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
    // Refresh every 30 seconds
    const interval = setInterval(fetchTokens, 30000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  const handleSelectTokenForStrategy = (token: Token) => {
    setSelectedToken(token);
    navigate("/strategy/create");
  };

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

      <main className="flex-1 overflow-hidden">
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
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}
