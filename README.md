# Bullseye

**Text-to-Trade Agent for RobinPump.fun**
Set-and-forget memecoin trading bots that live on your social channels.

---

Bullseye turns Telegram into a remote control for on-chain trading. Scan hundreds of RobinPump bonding curve tokens, build strategies with plain English, backtest against real trade history, then deploy -- all without leaving your chat. When a strategy fires, the trade executes directly on Base through your connected wallet.

![Token Screener](screenshots/screener.png)

![Strategy Builder](screenshots/strategy.png)

![Strategy Executioner](screenshots/strategy_detail.png)

---

## Why Bullseye

Memecoins move fast. By the time you open a dashboard, connect a wallet, set up alerts, and configure a trade, the window is gone. Bullseye collapses that workflow into a single conversation:

1. **Scan** -- `/screen market cap over 5K and more than 30 trades`
2. **Strategize** -- Pick a template, tune your entry/exit, backtest in seconds
3. **Execute** -- `/execute My Alpha Strategy` and walk away
4. **Get notified** -- The bot reports back when trades hit

No tabs. No dashboards. No babysitting charts.

---

## Features

### Token Screener

Real-time data for every token on RobinPump, indexed via Goldsky subgraph. Filter by market cap, price, ETH collected, volume, trade count, and graduation status. Supports natural language queries -- type "graduated tokens with volume above 10K" and the filters build themselves.

### Strategy Builder

Four configurable strategy templates designed for bonding curve dynamics:

| Template | Logic |
|---|---|
| **Dip Buy** | Enter when price drops X% from recent moving average |
| **Momentum** | Enter when price rises X% (ride the breakout) |
| **Mean Reversion** | Enter when price falls below the lookback average |
| **Price Threshold** | Enter when price crosses a fixed level |

Each strategy is fully parameterized: entry threshold, lookback window, take-profit %, stop-loss %, and position size in ETH.

### Flash Backtest

Run any strategy against historical on-chain trades in seconds. View equity curves, per-trade P&L, win rate, Sharpe ratio, and max drawdown -- all computed from real Goldsky subgraph data, not simulated prices.

### Live Execution

Deploy a backtested strategy directly to Base mainnet. Select your duration (15 min to 24 hr) and investment amount. Bullseye executes buy/sell transactions through the RobinPump bonding curve contracts via your connected wallet, with real-time status updates.

### Telegram Remote Control

Pair your wallet with [@bullseye_tgbot](https://t.me/bullseye_tgbot) and operate the entire platform from Telegram. The bot relays commands to the web app in real-time -- no browser required.

**Pairing:**
1. Send `/pair` to the bot -- get a 6-character code
2. Enter it in the app under **Wallet > Connections > Pair**
3. Done. Your Telegram is linked to your wallet.

**Commands:**

| Command | What it does |
|---|---|
| `/screen <filter>` | Apply a natural language filter to the screener and open it |
| `/strategies` | List your saved strategies with names, types, and short IDs |
| `/execute <name>` | Open a saved strategy in the app for execution |
| `/status` | Check your connection status |
| `/unpair` | Disconnect your wallet |

**Examples:**
```
/screen price under $0.001 and more than 50 trades
/screen graduated tokens with volume above 10K
/screen eth collected more than 0.5 and market cap over 3K
/execute Momentum on PEPE
/strategies
```

When a command is sent, the web app picks it up within seconds, navigates to the right page, applies the action, and shows a toast notification confirming what happened.

---

## Architecture

```
  Telegram                    Bullseye App (Browser)
  ────────                    ──────────────────────
  /screen ...  ──┐
  /execute ... ──┤     ┌──────────────────────────────────┐
  /strategies ───┤     │  React 19 + Vite + TailwindCSS   │
                 │     │                                    │
        ┌────────▼─────┤  Screener ←── external filters    │
        │  Hono API    │  Strategy ←── navigation          │
        │  (Bun)       │  Toast    ←── notifications       │
        │              │                                    │
        │  SQLite      │  Wallet ←── Base SDK (Account)    │
        │  ├ strategies│  Trades ←── Viem + bonding curves │
        │  ├ screeners │                                    │
        │  ├ telegram  └──────────────────────────────────┘
        │  └ actions
        │
        │  Telegram Bot Service
        │  └ long polling (getUpdates)
        │
        └──── Goldsky Subgraph (Base mainnet)
              └ RobinPump bonding curve data
```

**Data flow for remote commands:**
Telegram message --> Bot parses command --> Action queued in SQLite --> Frontend polls every 3s --> Action dispatched (navigate, apply filters, show toast) --> Action acknowledged

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 6, TailwindCSS, Recharts |
| **Wallet** | Base Account SDK, Viem |
| **Backend** | Bun, Hono, SQLite (bun:sqlite) |
| **Bot** | Telegram Bot API (long polling) |
| **Data** | Goldsky Subgraph (RobinPump, Base mainnet) |
| **Chain** | Base (Chain ID 8453) |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Environment

Create `backend/.env`:

```env
TELEGRAM_BOT_TOKEN=<your-token>
```

If omitted, the server runs normally but the Telegram bot is disabled.

### Install & Run

```bash
# Backend
cd backend && bun install && bun run dev

# Frontend (separate terminal)
cd frontend && bun install && bun run dev
```

The backend runs on `http://localhost:3001`, the frontend on `http://localhost:5173`.

---

## Project Structure

```
backend/
  src/
    index.ts                  Server entry + bot startup
    db.ts                     SQLite schema & migrations
    services/
      robinpump.ts            Goldsky subgraph client
      backtest.ts             Backtest engine
      telegram-bot.ts         Bot polling, command handlers, action queue
    routes/
      tokens.ts               Token feed API
      screeners.ts            Screener CRUD
      strategies.ts           Strategy + backtest endpoints
      telegram.ts             Pairing, status, action polling APIs

frontend/
  src/
    App.tsx                   Routing, live strategy orchestration, action relay
    main.tsx                  Providers (Wallet, Toast, Router)
    components/
      Header.tsx              Nav bar, ETH price, wallet dropdown
      Screener.tsx            Token table, NL filters, external filter support
      FilterBuilder.tsx       Visual filter rule editor
      StrategyView.tsx        Strategy config + backtest + execute
      StrategyDashboard.tsx   Saved strategies list
      StrategyDetail.tsx      Single strategy view + re-execute
      BacktestResults.tsx     Equity curves, metrics, trade log
      ConnectionsPanel.tsx    Telegram pairing slide-over
      MyWallet.tsx            Balances, active strategies
      ExecuteConfirmModal.tsx Duration & size confirmation
      LiveStrategyBar.tsx     Execution progress bar
    hooks/
      useStrategyExecutor.ts  On-chain trade execution loop
      useTelegramActions.ts   Action polling + dispatch
    contexts/
      WalletContext.tsx        Base SDK wallet state
      ToastContext.tsx         Toast notification system
    services/
      api.ts                  Backend API client
    utils/
      nlFilterParser.ts       Natural language to filter rules
    types.ts                  Shared TypeScript types
```

---

## API Reference

### Tokens

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tokens` | List all tokens (filters: `q`, `active`, `limit`) |
| GET | `/api/tokens/:id` | Single token with ETH/USD price |
| GET | `/api/tokens/:id/trades` | Trade history for a bonding curve |

### Screeners

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/screeners` | List saved screener configs |
| POST | `/api/screeners` | Create a screener |
| PUT | `/api/screeners/:id` | Update a screener |
| DELETE | `/api/screeners/:id` | Delete a screener |

### Strategies

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/strategies` | List all strategies |
| GET | `/api/strategies/:id` | Get strategy + latest backtest |
| POST | `/api/strategies` | Create a strategy |
| PUT | `/api/strategies/:id` | Update a strategy |
| DELETE | `/api/strategies/:id` | Delete a strategy |
| POST | `/api/strategies/:id/backtest` | Run backtest (saved) |
| POST | `/api/strategies/quick-backtest` | Run backtest (ephemeral) |

### Telegram

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/telegram/pair` | Submit pairing code to link wallet |
| GET | `/api/telegram/status` | Check connection status |
| DELETE | `/api/telegram/disconnect` | Unlink Telegram |
| GET | `/api/telegram/actions` | Poll for pending remote commands |
| POST | `/api/telegram/actions/:id/ack` | Acknowledge a consumed action |

---

## How It Works Under the Hood

### Blockchain Interaction

Bullseye interacts with **Base** (Ethereum L2, Chain ID 8453) through two complementary paths: **reading** indexed on-chain data via the Goldsky subgraph, and **writing** transactions directly to RobinPump smart contracts via Viem.

**Reading -- Goldsky Subgraph (off-chain indexing of on-chain events)**

All token discovery, screening, and backtesting data is sourced from a Goldsky subgraph that indexes RobinPump's on-chain events (`CurveCreated`, `TokensBought`, `TokensSold`, `CurveGraduated`) on Base mainnet. The backend queries this subgraph via GraphQL to fetch curve metadata (price, market cap, ETH collected, volume, trade count, graduation status) and full trade histories for any bonding curve. This indexed data powers the screener's real-time token table and the backtest engine's historical price replay -- enabling millisecond queries over hundreds of tokens without hitting the RPC directly.

**Writing -- Direct smart contract calls via Viem**

When a user executes a live strategy, the frontend interacts with RobinPump's bonding curve contracts on Base through the user's embedded wallet (Base Account SDK + Viem). The trade lifecycle for each position is:

1. **Simulate** -- Call `simulateBuy(ethAmount)` on the bonding curve contract to preview the expected token output, refund amount, and whether the buy would trigger graduation.
2. **Buy** -- Execute `buy(minTokensOut, deadline)` as a payable transaction, sending ETH to the curve. `minTokensOut` is derived from the simulation with a configurable slippage tolerance (basis points). `deadline` is set to `block.timestamp + 20 minutes` to prevent stale execution.
3. **Wait** -- The strategy executor spaces trades evenly across the configured duration (15 min to 24 hr), waiting between buy and sell.
4. **Approve** -- Before selling, check the ERC-20 `allowance()` for the curve contract. If insufficient, call `approve()` on the token contract to authorize the curve to spend the user's tokens.
5. **Sell** -- Call `getEthForTokens(tokensToSell)` to compute expected ETH output, then execute `sell(tokensToSell, minEthOut, deadline)` with slippage protection.
6. **Confirm** -- Wait for transaction receipts via `publicClient.waitForTransactionReceipt()` for both buys and sells before proceeding.

**Bonding curve mechanics**

RobinPump uses a virtual-reserve constant-product bonding curve where `price = virtualEthReserve / virtualTokenReserve`. Each token has its own deployed Bonding Curve contract that holds ETH reserves and manages pricing autonomously -- no order books, no matching engine. Buys increase `virtualEthReserve` and decrease `virtualTokenReserve`, pushing price up; sells do the reverse. A 1% fee is deducted on both buys (from ETH sent) and sells (from ETH proceeds). When a curve collects enough ETH to hit its graduation threshold, it freezes, deploys liquidity to Aerodrome DEX, and burns LP tokens for permanent liquidity. Bullseye monitors graduation status via `getGraduationInfo()` and the subgraph's `graduated` flag to prevent trading on frozen curves.

**Wallet**

Users connect via the Base Account SDK (`@base-org/account`), which provides an embedded smart wallet on Base. All contract interactions (buy, sell, approve) are signed and submitted through this wallet using Viem's `WalletClient`, with the public RPC at `https://mainnet.base.org` used for read calls and transaction receipt polling.

### Backtest Engine

The backtest engine replays historical trades from the Goldsky subgraph against a strategy's parameters. For each trade in the lookback window, it evaluates entry conditions, simulates position management with take-profit and stop-loss levels, and computes per-trade and aggregate metrics including equity curves and Sharpe ratio.

### Telegram Action Relay

The bot service runs a long-polling loop against the Telegram Bot API. When a paired user sends a command like `/screen`, the bot parses it, stores a structured action in the `telegram_actions` SQLite table, and replies with confirmation. The frontend polls `GET /api/telegram/actions` every 3 seconds. When an action arrives, it is dispatched (navigate to the screener, apply filters, or open a strategy), a toast notification is shown, and the action is acknowledged via `POST /api/telegram/actions/:id/ack` so it isn't processed twice.

---

## License

MIT
