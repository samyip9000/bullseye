# Bullseye - Text-to-Trade Agent for RobinPump.fun

A hackathon MVP for building and backtesting trading strategies on RobinPump bonding curve tokens (Base network).

## Features

- **Token Screener** — Real-time token data from RobinPump via Goldsky subgraph. Custom filters on market cap, price, ETH collected, and graduation status.
- **Custom Filter Builder** — Create and save screener configurations with multiple filter rules.
- **Strategy Builder** — Configure entry/exit conditions with 4 strategy templates (Dip Buy, Momentum, Mean Reversion, Price Threshold).
- **Flash Backtest** — Run strategies against historical trade data and view performance metrics, equity curves, and trade history.

## Tech Stack

- **Frontend:** React 19 + Vite + TailwindCSS + Recharts
- **Backend:** Bun + Hono + SQLite (bun:sqlite)
- **Data:** RobinPump Goldsky Subgraph (Base mainnet)

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) (v1.0+)

### Install & Run

```bash
# Install backend dependencies
cd backend
bun install

# Install frontend dependencies
cd ../frontend
bun install

# Start backend (port 3001)
cd ../backend
bun run dev

# In another terminal, start frontend (port 5173)
cd ../frontend
bun run dev
```

Open http://localhost:5173 in your browser.

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.ts              # Hono server + CORS
│   │   ├── db.ts                 # SQLite schema
│   │   ├── services/
│   │   │   ├── robinpump.ts      # Goldsky subgraph client
│   │   │   └── backtest.ts       # Backtest engine
│   │   └── routes/
│   │       ├── tokens.ts         # Token feed API
│   │       ├── screeners.ts      # Screener CRUD
│   │       └── strategies.ts     # Strategy + backtest
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main app shell
│   │   ├── components/
│   │   │   ├── Header.tsx        # Nav + stats
│   │   │   ├── Screener.tsx      # Token table + filters
│   │   │   ├── FilterBuilder.tsx # Custom filter UI
│   │   │   ├── StrategyView.tsx  # Strategy config
│   │   │   └── BacktestResults.tsx # Charts + metrics
│   │   ├── services/api.ts       # Backend API client
│   │   └── types.ts              # TypeScript types
│   └── package.json
└── docs/
    ├── BULLSEYE_PRD.md
    └── ROBINPUMP_INTEGRATION_SPEC.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tokens` | List tokens from RobinPump |
| GET | `/api/tokens/:id` | Get single token |
| GET | `/api/tokens/:id/trades` | Trade history |
| POST | `/api/screeners` | Save screener config |
| GET | `/api/screeners` | List saved screeners |
| POST | `/api/strategies` | Create strategy |
| POST | `/api/strategies/:id/backtest` | Run backtest |
| POST | `/api/strategies/quick-backtest` | Quick backtest (no save) |
