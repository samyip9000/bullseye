# Bullseye v2 — Sample Trade Test Cases

**Date:** February 11, 2026  
**Starting Balance:** 18 USDC  
**ETH/USD Price:** $1,944.96  
**ETH Equivalent:** ~0.00926 ETH  
**Network:** Base (Chain ID: 8453)  
**Platform:** RobinPump Bonding Curves via Goldsky Subgraph  

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Token Selection Matrix](#2-token-selection-matrix)
3. [Test Suite A — Graduated Tokens (High Liquidity)](#3-test-suite-a--graduated-tokens-high-liquidity)
4. [Test Suite B — Bonding Tokens (Medium Activity)](#4-test-suite-b--bonding-tokens-medium-activity)
5. [Test Suite C — Bonding Tokens (Low Activity / Micro-Cap)](#5-test-suite-c--bonding-tokens-low-activity--micro-cap)
6. [Test Suite D — Strategy Variation Tests](#6-test-suite-d--strategy-variation-tests)
7. [Test Suite E — Edge Cases & Risk Scenarios](#7-test-suite-e--edge-cases--risk-scenarios)
8. [Test Suite F — Position Sizing & Balance Management](#8-test-suite-f--position-sizing--balance-management)
9. [Expected Results Summary](#9-expected-results-summary)
10. [Pass/Fail Criteria](#10-passfail-criteria)

---

## 1. Test Environment Setup

### Prerequisites

| Item | Details |
|------|---------|
| Wallet Connected | Base network, address `0x8C12...7C93` |
| USDC Balance | 18.00 USDC |
| ETH Balance | Sufficient for gas (~0.001 ETH minimum) |
| Backend Server | Running on localhost (Bun + Hono) |
| Frontend | React + Vite dev server |
| Data Source | Goldsky subgraph (mainnet) |

### Balance Allocation Plan

| Allocation | USDC | ETH Equivalent | Purpose |
|------------|------|----------------|---------|
| Graduated Token Trades | 6.00 | ~0.00309 ETH | 3 trades × $2.00 each |
| Bonding Token Trades (Medium) | 5.00 | ~0.00257 ETH | 5 trades × $1.00 each |
| Bonding Token Trades (Low) | 3.00 | ~0.00154 ETH | 3 trades × $1.00 each |
| Strategy Tests | 2.00 | ~0.00103 ETH | 4 backtests × $0.50 simulated |
| Edge Case Reserve | 2.00 | ~0.00103 ETH | Safety buffer |
| **Total** | **18.00** | **~0.00926 ETH** | |

### Position Size Reference

At ETH/USD = $1,944.96:
- $1.00 USDC ≈ 0.000514 ETH
- $2.00 USDC ≈ 0.001029 ETH
- $3.00 USDC ≈ 0.001543 ETH
- $6.00 USDC ≈ 0.003086 ETH

---

## 2. Token Selection Matrix

### Tokens Selected for Testing

| # | Symbol | Name | Price | Market Cap | Volume | Trades | Status | Category |
|---|--------|------|-------|------------|--------|--------|--------|----------|
| 1 | IDEA | Idea Coins | $5.64e-6 | $0.001520 | $541.6K | 3,338 | GRADUATED | High Liquidity |
| 2 | ROBIN | Robinpump | $3.53e-6 | $0.000706 | $418.8K | 2,186 | GRADUATED | High Liquidity |
| 3 | BABYMOLT | babymolt | $5.17e-6 | $0.000318 | $126.2K | 1,011 | GRADUATED | High Liquidity |
| 4 | PBNB | PetsBNB | $5.23e-6 | $0.000242 | $91.5K | 341 | BONDING | Medium Activity |
| 5 | STOCK | 24 Hour Stock Trader | $3.69e-6 | $9.40e-5 | $54.3K | 298 | BONDING | Medium Activity |
| 6 | IHAI | I have an idea | $6.69e-6 | $7.10e-5 | $20.7K | 269 | BONDING | Medium Activity |
| 7 | CTDL | AI Market Maker | $4.15e-6 | $1.46e-6 | $684.63 | 23 | BONDING | Low Activity |
| 8 | PENGUIN | PENGUIN | $2.74e-6 | $1.32e-6 | $939.70 | 15 | BONDING | Low Activity |
| 9 | RPUMP | Robin Pump | $3.28e-6 | $1.48e-6 | $1.1K | 21 | BONDING | Low Activity |
| 10 | EPS | Epstein | $3.22e-6 | $7.24e-10 | $0.5149 | 10 | BONDING | Micro-Cap |
| 11 | PEPE | Pepe | $3.07e-6 | $3.51e-7 | $246.66 | 7 | BONDING | Micro-Cap |
| 12 | BULK | Bulkcoin | $3.31e-6 | $5.67e-7 | $399.21 | 11 | BONDING | Low Activity |

---

## 3. Test Suite A — Graduated Tokens (High Liquidity)

> **Note:** Graduated tokens have moved to Aerodrome DEX. Buy/sell on the bonding curve will revert. These tests validate backtest behavior on tokens with the most historical trade data.

---

### TC-A01: Backtest IDEA (Idea Coins) — Dip Buy Strategy

| Field | Value |
|-------|-------|
| **Test ID** | TC-A01 |
| **Token** | IDEA ($IDEA) — Idea Coins |
| **Status** | GRADUATED |
| **Trade Count** | 3,338 |
| **Volume** | $541.6K |
| **Strategy** | Dip Buy (`price_dip`) |
| **Position Size** | 0.001029 ETH (~$2.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `price_dip` |
| `entryThresholdPercent` | `-5` |
| `lookbackTrades` | `20` |
| `takeProfitPercent` | `20` |
| `stopLossPercent` | `-10` |
| `positionSizeEth` | `0.001029` |

**Steps:**

1. Navigate to Screener tab
2. Locate IDEA (Idea Coins) — first row, GRADUATED status
3. Click "Backtest" button
4. Configure strategy as Dip Buy with parameters above
5. Click "Flash Backtest"
6. Verify backtest results load

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Backtest completes | Yes — 3,338 trades provides sufficient data (min: 30) |
| Total trades generated | > 0 (high trade count should produce entries) |
| Price history chart | Renders with data points |
| Equity curve | Renders, starts at 0.001029 ETH |
| Win/loss trades | Both categories populated |
| Max drawdown | Calculated and displayed |
| Sharpe ratio | Calculated (non-zero if trades exist) |

**API Call:**
```json
POST /api/strategies/quick-backtest
{
  "curveId": "<IDEA_curve_id>",
  "params": {
    "entryType": "price_dip",
    "entryThresholdPercent": -5,
    "lookbackTrades": 20,
    "takeProfitPercent": 20,
    "stopLossPercent": -10,
    "positionSizeEth": 0.001029
  }
}
```

**Pass Criteria:**
- [ ] HTTP 200 response
- [ ] `result.totalTrades >= 1`
- [ ] `result.priceHistory.length > 0`
- [ ] `result.equityCurve.length > 0`
- [ ] No console errors

---

### TC-A02: Backtest ROBIN (Robinpump) — Momentum Strategy

| Field | Value |
|-------|-------|
| **Test ID** | TC-A02 |
| **Token** | ROBIN ($ROBIN) — Robinpump |
| **Status** | GRADUATED |
| **Trade Count** | 2,186 |
| **Volume** | $418.8K |
| **Strategy** | Momentum |
| **Position Size** | 0.001029 ETH (~$2.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `momentum` |
| `entryThresholdPercent` | `10` |
| `lookbackTrades` | `15` |
| `takeProfitPercent` | `25` |
| `stopLossPercent` | `-8` |
| `positionSizeEth` | `0.001029` |

**Steps:**

1. Navigate to Screener tab
2. Locate ROBIN (Robinpump) — second row, GRADUATED status
3. Click "Backtest" button
4. Select "Momentum" strategy type
5. Set entry threshold to +10%, lookback to 15, TP 25%, SL -8%
6. Click "Flash Backtest"

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Backtest completes | Yes |
| Momentum entries | Triggered when price rises 10%+ vs lookback average |
| Trade exits | Take profit at +25% or stop loss at -8% |
| PnL calculation | Correct based on entry/exit prices |
| Total PnL ETH | Reflects cumulative gains/losses on 0.001029 ETH |

**Pass Criteria:**
- [ ] HTTP 200 response
- [ ] Momentum entries are correctly identified (price rise ≥ 10%)
- [ ] Exit reasons are either `take_profit`, `stop_loss`, or `end_of_data`
- [ ] `result.winRate` is between 0 and 100
- [ ] `result.totalPnlEth` is a valid number

---

### TC-A03: Backtest BABYMOLT (babymolt) — Mean Reversion Strategy

| Field | Value |
|-------|-------|
| **Test ID** | TC-A03 |
| **Token** | BABYMOLT ($BABYMOLT) — babymolt |
| **Status** | GRADUATED |
| **Trade Count** | 1,011 |
| **Volume** | $126.2K |
| **Strategy** | Mean Reversion |
| **Position Size** | 0.001029 ETH (~$2.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `mean_reversion` |
| `entryThresholdPercent` | `-7` |
| `lookbackTrades` | `25` |
| `takeProfitPercent` | `15` |
| `stopLossPercent` | `-12` |
| `positionSizeEth` | `0.001029` |

**Steps:**

1. Locate BABYMOLT in screener (GRADUATED)
2. Click "Backtest"
3. Select "Mean Reversion" strategy
4. Set threshold -7%, lookback 25, TP 15%, SL -12%
5. Execute Flash Backtest

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Backtest completes | Yes — 1,011 trades is sufficient |
| Entry triggers | When price drops 7%+ below 25-trade average |
| Mean reversion logic | Identical to `price_dip` in engine |
| Trade count | Multiple entries expected given 1,011 data points |

**Pass Criteria:**
- [ ] Backtest returns valid result
- [ ] `result.trades` array is not empty
- [ ] Each trade has valid `entryPrice`, `exitPrice`, `pnlPercent`
- [ ] Equity curve tracks correctly through all trades

---

## 4. Test Suite B — Bonding Tokens (Medium Activity)

> **Note:** These tokens are still in BONDING status (not graduated). They have moderate trade history suitable for backtesting.

---

### TC-B01: Backtest PBNB (PetsBNB) — Dip Buy

| Field | Value |
|-------|-------|
| **Test ID** | TC-B01 |
| **Token** | PBNB ($PBNB) — PetsBNB |
| **Status** | BONDING |
| **Trade Count** | 341 |
| **Volume** | $91.5K |
| **Strategy** | Dip Buy |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `price_dip` |
| `entryThresholdPercent` | `-3` |
| `lookbackTrades` | `10` |
| `takeProfitPercent` | `15` |
| `stopLossPercent` | `-8` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Find PBNB in screener — BONDING status, 341 trades
2. Click "Backtest"
3. Configure: Dip Buy, -3% entry, lookback 10, TP 15%, SL -8%
4. Run Flash Backtest

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Data sufficiency | 341 trades > minimum (lookback + 10 = 20) ✓ |
| Backtest completes | Yes |
| Tighter entry (-3%) | More frequent entries than -5% |
| Position size | 0.000514 ETH per trade |

**Pass Criteria:**
- [ ] Backtest returns result successfully
- [ ] Price history has ~341 data points
- [ ] PnL values proportional to 0.000514 ETH position

---

### TC-B02: Backtest STOCK (24 Hour Stock Trader) — Threshold Strategy

| Field | Value |
|-------|-------|
| **Test ID** | TC-B02 |
| **Token** | STOCK ($STOCK) — 24 Hour Stock Trader |
| **Status** | BONDING |
| **Trade Count** | 298 |
| **Volume** | $54.3K |
| **Strategy** | Price Threshold |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `threshold` |
| `entryThresholdPercent` | `5` |
| `lookbackTrades` | `20` |
| `takeProfitPercent` | `30` |
| `stopLossPercent` | `-15` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Find STOCK in screener
2. Click "Backtest"
3. Select "Price Threshold" strategy
4. Entry: +5% above reference, lookback 20, TP 30%, SL -15%
5. Execute backtest

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Threshold entries | Triggered when price ≥ reference × 1.05 |
| Wider exit range | TP 30% / SL -15% allows trades to develop |
| Fewer total trades | Higher threshold = fewer entries |

**Pass Criteria:**
- [ ] Threshold logic correctly applied: `currentPrice >= referencePrice * 1.05`
- [ ] Wider SL (-15%) produces different results than default (-10%)
- [ ] Result is structurally valid

---

### TC-B03: Backtest IHAI (I have an idea) — Aggressive Dip Buy

| Field | Value |
|-------|-------|
| **Test ID** | TC-B03 |
| **Token** | IHAI ($IHAI) — I have an idea |
| **Status** | BONDING |
| **Trade Count** | 269 |
| **Volume** | $20.7K |
| **Strategy** | Dip Buy (Aggressive) |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `price_dip` |
| `entryThresholdPercent` | `-2` |
| `lookbackTrades` | `5` |
| `takeProfitPercent` | `10` |
| `stopLossPercent` | `-5` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Locate IHAI in screener
2. Backtest with aggressive parameters: -2% entry, short lookback (5), tight exits

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Frequent entries | -2% threshold + 5-trade lookback = many signals |
| Quick exits | Tight TP/SL means fast trade turnover |
| Higher trade count | Compared to conservative strategies |
| Potential whipsaw | Tight parameters may cause frequent losses |

**Pass Criteria:**
- [ ] Higher trade count than TC-B01 (tighter parameters)
- [ ] Each trade PnL bounded by [-5%, +10%] (matching TP/SL)
- [ ] No runtime errors despite rapid entry/exit cycling

---

### TC-B04: Backtest PBNB — Save Strategy Then Backtest

| Field | Value |
|-------|-------|
| **Test ID** | TC-B04 |
| **Token** | PBNB ($PBNB) — PetsBNB |
| **Status** | BONDING |
| **Strategy** | Momentum |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `momentum` |
| `entryThresholdPercent` | `8` |
| `lookbackTrades` | `15` |
| `takeProfitPercent` | `20` |
| `stopLossPercent` | `-10` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Navigate to PBNB → Backtest
2. Configure momentum strategy with above params
3. Click "Save & Backtest" (instead of Flash Backtest)
4. Verify strategy is saved to database
5. Verify backtest runs against saved strategy
6. Navigate to Strategies list and confirm it appears

**API Calls:**
```json
POST /api/strategies
{
  "name": "PBNB Momentum Test",
  "tokenAddress": "<PBNB_token_address>",
  "tokenName": "PetsBNB",
  "curveId": "<PBNB_curve_id>",
  "strategyType": "momentum",
  "params": {
    "entryType": "momentum",
    "entryThresholdPercent": 8,
    "lookbackTrades": 15,
    "takeProfitPercent": 20,
    "stopLossPercent": -10,
    "positionSizeEth": 0.000514
  }
}
```

Then:
```json
POST /api/strategies/<saved_id>/backtest
```

**Pass Criteria:**
- [ ] Strategy saved with HTTP 201
- [ ] Strategy appears in `GET /api/strategies`
- [ ] Backtest against saved strategy returns HTTP 200
- [ ] Backtest result saved in `backtest_results` table
- [ ] `GET /api/strategies/<id>` includes `latestBacktest`

---

### TC-B05: Backtest STOCK — Conservative Momentum

| Field | Value |
|-------|-------|
| **Test ID** | TC-B05 |
| **Token** | STOCK ($STOCK) — 24 Hour Stock Trader |
| **Status** | BONDING |
| **Trade Count** | 298 |
| **Strategy** | Momentum (Conservative) |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `momentum` |
| `entryThresholdPercent` | `15` |
| `lookbackTrades` | `30` |
| `takeProfitPercent` | `40` |
| `stopLossPercent` | `-5` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Run backtest on STOCK with conservative momentum parameters
2. Compare trade count with TC-B02 (same token, different strategy)

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Very few entries | 15% threshold is high; fewer momentum signals |
| Asymmetric risk | TP 40% vs SL -5% = high reward/risk ratio |
| Possible zero trades | May not trigger if no 15% surges in data |

**Pass Criteria:**
- [ ] Backtest completes without error
- [ ] If trades exist, each exit is either `take_profit` (≥40%) or `stop_loss` (≤-5%)
- [ ] Comparing with TC-B02: different trade count confirms strategy variation works

---

## 5. Test Suite C — Bonding Tokens (Low Activity / Micro-Cap)

> **Note:** These tokens have very few trades. Tests verify graceful handling of thin data.

---

### TC-C01: Backtest CTDL (AI Market Maker) — Insufficient Data Handling

| Field | Value |
|-------|-------|
| **Test ID** | TC-C01 |
| **Token** | CTDL ($CTDL) — AI Market Maker |
| **Status** | BONDING |
| **Trade Count** | 23 |
| **Volume** | $684.63 |
| **Strategy** | Dip Buy |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `price_dip` |
| `entryThresholdPercent` | `-5` |
| `lookbackTrades` | `20` |
| `takeProfitPercent` | `20` |
| `stopLossPercent` | `-10` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Select CTDL from screener
2. Run backtest with default dip buy, lookback = 20

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Data check | 23 trades; minimum needed = lookback(20) + 10 = 30 |
| Result | Empty result (insufficient data) |
| No crash | Engine returns gracefully |

**Pass Criteria:**
- [ ] Backtest returns HTTP 200 (not 500)
- [ ] `result.totalTrades === 0`
- [ ] `result.trades` is empty array `[]`
- [ ] `result.priceHistory` may still contain available data points
- [ ] UI displays "not enough data" message or empty chart

---

### TC-C02: Backtest CTDL — Reduced Lookback to Force Execution

| Field | Value |
|-------|-------|
| **Test ID** | TC-C02 |
| **Token** | CTDL ($CTDL) — AI Market Maker |
| **Trade Count** | 23 |
| **Strategy** | Dip Buy (Short Lookback) |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `price_dip` |
| `entryThresholdPercent` | `-3` |
| `lookbackTrades` | `5` |
| `takeProfitPercent` | `15` |
| `stopLossPercent` | `-8` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Re-run CTDL backtest with lookback = 5 (minimum needed = 15 trades)
2. 23 trades ≥ 15 → should produce results

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Data sufficient | 23 ≥ (5 + 10) = 15 ✓ |
| Backtest runs | Yes, with limited data |
| Few trades | Small dataset limits trade opportunities |

**Pass Criteria:**
- [ ] Backtest returns non-empty result
- [ ] At least `result.priceHistory` is populated
- [ ] Engine handles small dataset without errors

---

### TC-C03: Backtest PENGUIN — Low Trade Count

| Field | Value |
|-------|-------|
| **Test ID** | TC-C03 |
| **Token** | PENGUIN ($PENGUIN) |
| **Status** | BONDING |
| **Trade Count** | 15 |
| **Strategy** | Mean Reversion |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `mean_reversion` |
| `entryThresholdPercent` | `-3` |
| `lookbackTrades` | `3` |
| `takeProfitPercent` | `10` |
| `stopLossPercent` | `-5` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Select PENGUIN (15 trades only)
2. Use minimal lookback (3) to maximize usable data window
3. Run backtest

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Data check | 15 ≥ (3 + 10) = 13 ✓ (barely sufficient) |
| Usable window | Only 2 data points for entry evaluation |
| Very few trades | 0–2 trades expected |

**Pass Criteria:**
- [ ] Backtest completes
- [ ] Engine handles near-minimum data gracefully
- [ ] Result metrics are calculated correctly even with 0–1 trades

---

### TC-C04: Backtest EPS (Epstein) — Micro-Cap Edge Case

| Field | Value |
|-------|-------|
| **Test ID** | TC-C04 |
| **Token** | EPS ($EPS) — Epstein |
| **Status** | BONDING |
| **Trade Count** | 10 |
| **Market Cap** | $7.24e-10 (~$0.0000000007) |
| **Volume** | $0.5149 |
| **Strategy** | Price Dip |
| **Position Size** | 0.000514 ETH (~$1.00 USDC) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `price_dip` |
| `entryThresholdPercent` | `-5` |
| `lookbackTrades` | `3` |
| `takeProfitPercent` | `20` |
| `stopLossPercent` | `-10` |
| `positionSizeEth` | `0.000514` |

**Steps:**

1. Select EPS from screener (extremely low market cap)
2. Run backtest with minimal lookback

**Expected Results:**

| Metric | Expected |
|--------|----------|
| Data check | 10 < (3 + 10) = 13 → insufficient |
| Result | Empty result |
| Price precision | Very small numbers (e-6 range) handled correctly |
| No overflow/NaN | Calculations remain valid |

**Pass Criteria:**
- [ ] Returns empty backtest result (not error)
- [ ] No `NaN` or `Infinity` in any field
- [ ] Price values in scientific notation render correctly in UI

---

## 6. Test Suite D — Strategy Variation Tests

> **Purpose:** Run all 4 strategy types against the same token to compare behavior.
> **Token:** PBNB ($PBNB) — 341 trades, BONDING

---

### TC-D01: PBNB — Strategy Comparison Matrix

Run all 4 strategies with position size 0.000257 ETH (~$0.50 USDC) each:

| Test | Strategy | Entry Threshold | Lookback | Take Profit | Stop Loss |
|------|----------|----------------|----------|-------------|-----------|
| TC-D01a | `price_dip` | -5% | 20 | 20% | -10% |
| TC-D01b | `momentum` | +10% | 20 | 20% | -10% |
| TC-D01c | `mean_reversion` | -5% | 20 | 20% | -10% |
| TC-D01d | `threshold` | +5% | 20 | 20% | -10% |

**Steps:**

1. Run Flash Backtest for PBNB with each strategy type
2. Record results in comparison table
3. Verify each strategy produces different entry signals

**Expected Comparison:**

| Metric | price_dip | momentum | mean_reversion | threshold |
|--------|-----------|----------|----------------|-----------|
| Entry Logic | Price ≤ ref × 0.95 | Price ≥ ref × 1.10 | Price ≤ ref × 0.95 | Price ≥ ref × 1.05 |
| Expected Trades | Medium | Few | Medium | Medium-Few |
| Overlapping? | Same as mean_reversion | Unique | Same as price_dip | Unique |

**Pass Criteria:**
- [ ] All 4 backtests complete successfully
- [ ] `price_dip` and `mean_reversion` produce identical results (same logic in engine)
- [ ] `momentum` and `threshold` produce different results from dip strategies
- [ ] `momentum` (10% threshold) produces fewer entries than `threshold` (5%)

---

## 7. Test Suite E — Edge Cases & Risk Scenarios

---

### TC-E01: Zero Position Size

| Field | Value |
|-------|-------|
| **Test ID** | TC-E01 |
| **Token** | IDEA (Idea Coins) |
| **Position Size** | 0 ETH |

**Steps:**

1. Run backtest with `positionSizeEth: 0`

**Expected:** Backtest completes but all PnL values are 0 ETH. No division-by-zero errors.

**Pass Criteria:**
- [ ] No runtime crash
- [ ] `totalPnlEth === 0`
- [ ] `totalPnlPercent` calculated without error

---

### TC-E02: Extremely Tight Stop Loss

| Field | Value |
|-------|-------|
| **Test ID** | TC-E02 |
| **Token** | ROBIN (Robinpump) |
| **Strategy** | Dip Buy |
| **Stop Loss** | -0.5% (very tight) |
| **Take Profit** | 50% (very wide) |

**Strategy Parameters:**

| Parameter | Value |
|-----------|-------|
| `entryType` | `price_dip` |
| `entryThresholdPercent` | `-2` |
| `lookbackTrades` | `10` |
| `takeProfitPercent` | `50` |
| `stopLossPercent` | `-0.5` |
| `positionSizeEth` | `0.000514` |

**Expected:** Mostly stop-loss exits; very low win rate due to tight SL triggering on normal volatility.

**Pass Criteria:**
- [ ] High loss ratio (most trades hit -0.5% SL)
- [ ] `result.losingTrades > result.winningTrades`
- [ ] Max drawdown reflects cumulative small losses
- [ ] No calculation errors

---

### TC-E03: Extremely Wide Parameters

| Field | Value |
|-------|-------|
| **Test ID** | TC-E03 |
| **Token** | IDEA (Idea Coins) |
| **Entry Threshold** | -50% |
| **Take Profit** | 500% |
| **Stop Loss** | -90% |
| **Lookback** | 100 |

**Expected:** Very few or zero trades (50% dip is rare). If entered, positions stay open for a long time.

**Pass Criteria:**
- [ ] Backtest completes without timeout
- [ ] Low trade count (0–2)
- [ ] Final open position closed at `end_of_data` if entered late

---

### TC-E04: Lookback Exceeds Trade Count

| Field | Value |
|-------|-------|
| **Test ID** | TC-E04 |
| **Token** | RPUMP (Robin Pump) — 21 trades |
| **Lookback** | 50 |

**Expected:** Returns empty result. `21 < (50 + 10) = 60` → insufficient data.

**Pass Criteria:**
- [ ] Returns `totalTrades: 0`
- [ ] No error thrown
- [ ] Price history still returned if available

---

### TC-E05: Duplicate Token Symbols

| Field | Value |
|-------|-------|
| **Test ID** | TC-E05 |
| **Tokens** | Multiple tokens share `$IDEA` symbol |

**Steps:**

1. Observe screener has multiple tokens with symbol IDEA:
   - Idea Coins (GRADUATED, 3,338 trades)
   - Idea Coin (BONDING, 32 trades)
   - Idea Coin (BONDING, 25 trades)
   - idea (BONDING, 13 trades)
   - NO IDEA (BONDING, 6 trades)
   - Jesse's Idea (BONDING, 2 trades)
   - IDEA COINS. (BONDING, 11 trades)
2. Verify each IDEA token has a unique `curveId`
3. Run backtest on 2 different IDEA tokens and confirm different results

**Pass Criteria:**
- [ ] Each token has a unique curve ID
- [ ] Backtesting one IDEA token doesn't affect another
- [ ] UI clearly distinguishes tokens with same symbol (shows full name)

---

### TC-E06: Graduated Token Live Trade Attempt (Future Feature)

| Field | Value |
|-------|-------|
| **Test ID** | TC-E06 |
| **Token** | IDEA (Idea Coins) — GRADUATED |
| **Action** | Attempt buy via bonding curve |

**Steps (when live trading is implemented):**

1. Attempt to buy IDEA through bonding curve contract
2. Bonding curve should be frozen after graduation

**Expected:** Transaction reverts with error. UI should show "Token has graduated — trade on Aerodrome instead."

**Pass Criteria:**
- [ ] No funds lost on revert
- [ ] Clear error message displayed
- [ ] Redirect/link to Aerodrome provided

---

## 8. Test Suite F — Position Sizing & Balance Management

---

### TC-F01: Full Balance Allocation Across Multiple Tokens

| Field | Value |
|-------|-------|
| **Test ID** | TC-F01 |
| **Starting Balance** | 18 USDC (~0.00926 ETH) |

**Simulated Trade Allocation:**

| # | Token | Allocation (USDC) | Position (ETH) | Strategy |
|---|-------|-------------------|----------------|----------|
| 1 | IDEA | $2.00 | 0.001029 | Dip Buy |
| 2 | ROBIN | $2.00 | 0.001029 | Momentum |
| 3 | BABYMOLT | $2.00 | 0.001029 | Mean Reversion |
| 4 | PBNB | $1.00 | 0.000514 | Dip Buy |
| 5 | STOCK | $1.00 | 0.000514 | Threshold |
| 6 | IHAI | $1.00 | 0.000514 | Dip Buy |
| 7 | CTDL | $1.00 | 0.000514 | Dip Buy |
| 8 | PENGUIN | $1.00 | 0.000514 | Mean Reversion |
| 9 | RPUMP | $1.00 | 0.000514 | Momentum |
| 10 | PEPE | $1.00 | 0.000514 | Dip Buy |
| 11 | BULK | $1.00 | 0.000514 | Threshold |
| 12 | ROBINMOLT | $1.00 | 0.000514 | Dip Buy |
| | **Gas Reserve** | **$2.00** | **0.001029** | — |
| | **TOTAL** | **$18.00** | **~0.00926** | |

**Steps:**

1. Run backtests for all 12 tokens sequentially
2. Record results for each
3. Calculate aggregate portfolio performance

**Expected Results:**

| Metric | Calculation |
|--------|-------------|
| Total invested | 0.00823 ETH across 12 positions |
| Aggregate PnL | Sum of all individual `totalPnlEth` values |
| Portfolio return | `(sum of PnL) / 0.00823 × 100%` |
| Best performer | Token with highest `totalPnlPercent` |
| Worst performer | Token with lowest `totalPnlPercent` |
| Win rate (portfolio) | `total winning trades / total trades × 100` |

**Pass Criteria:**
- [ ] All 12 backtests complete (some may return empty results)
- [ ] Total allocation does not exceed 18 USDC equivalent
- [ ] Aggregate metrics are internally consistent
- [ ] Gas reserve not consumed by backtest simulation

---

### TC-F02: Position Size vs. Slippage Impact (Informational)

| Field | Value |
|-------|-------|
| **Test ID** | TC-F02 |
| **Purpose** | Document expected slippage for different position sizes |

**Slippage Estimates (1% fee on bonding curve):**

| Position (USDC) | Position (ETH) | Fee Impact (1%) | Net ETH After Fee |
|-----------------|----------------|-----------------|-------------------|
| $1.00 | 0.000514 | 0.00000514 | 0.000509 |
| $2.00 | 0.001029 | 0.00001029 | 0.001019 |
| $3.00 | 0.001543 | 0.00001543 | 0.001528 |
| $6.00 | 0.003086 | 0.00003086 | 0.003055 |

**Note:** For micro-cap tokens (market cap < $0.001), a $1.00 position could significantly move the price. The bonding curve's constant-product formula means larger buys relative to reserves will incur higher slippage.

**Pass Criteria:**
- [ ] Documented for reference
- [ ] Fee calculations verified against contract spec (1% buy, 1% sell)

---

## 9. Expected Results Summary

### By Token Category

| Category | Tokens | Expected Backtest Success | Notes |
|----------|--------|--------------------------|-------|
| Graduated (High Liquidity) | IDEA, ROBIN, BABYMOLT | ✅ All succeed | Rich trade history (1K–3.3K trades) |
| Bonding (Medium Activity) | PBNB, STOCK, IHAI | ✅ All succeed | 269–341 trades, sufficient data |
| Bonding (Low Activity) | CTDL, RPUMP, BULK | ⚠️ Mixed | May return empty with high lookback |
| Bonding (Micro-Cap) | EPS, PEPE, PENGUIN | ⚠️ Mostly empty | <15 trades, edge case handling |

### By Strategy Type

| Strategy | Best Suited For | Expected Behavior |
|----------|-----------------|-------------------|
| `price_dip` | Volatile tokens with recovery | Buys dips, profits on bounces |
| `momentum` | Trending tokens | Buys breakouts, profits on continuation |
| `mean_reversion` | Range-bound tokens | Same as price_dip in current engine |
| `threshold` | Tokens with clear levels | Buys on breakout above threshold |

---

## 10. Pass/Fail Criteria

### Overall Test Pass Criteria

| # | Criteria | Required |
|---|----------|----------|
| 1 | All API calls return valid HTTP responses (200 or 201) | ✅ |
| 2 | No 500 errors on any backtest request | ✅ |
| 3 | Graduated tokens produce non-empty backtest results | ✅ |
| 4 | Insufficient data returns empty result, not error | ✅ |
| 5 | No `NaN`, `Infinity`, or negative win rates in results | ✅ |
| 6 | All 4 strategy types execute without error | ✅ |
| 7 | Equity curve values are consistent with trade PnL | ✅ |
| 8 | Price history timestamps are chronologically ordered | ✅ |
| 9 | Total position allocation ≤ 18 USDC | ✅ |
| 10 | Duplicate symbols (IDEA) are uniquely identified by curve ID | ✅ |

### Defect Severity Classification

| Severity | Definition | Example |
|----------|------------|---------|
| **Critical** | Data loss or fund risk | Wrong PnL calculation, position size overflow |
| **High** | Feature broken | Backtest returns 500 error, strategy not executing |
| **Medium** | Incorrect but functional | Win rate shows > 100%, chart rendering error |
| **Low** | Cosmetic/minor | Rounding difference, slow response time |

---

## Appendix A: Goldsky Subgraph — Trade History Queries

### Subgraph Endpoint

```
POST https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn
```

### Query: Get All Curves (Token List with Curve IDs)

```graphql
{
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
}
```

### Query: Get Trade History for a Specific Curve

```graphql
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
```

**Variables (example):**
```json
{
  "curve": "0x577fd22aaa52449aa11518ab80d611185a9a8aaa",
  "limit": 50
}
```

### Query: Get ETH/USD Price

```graphql
{
  bundles(first: 1) {
    ethUsd
    ethUsdDecimals
    updatedAt
  }
}
```

### Automated Fetch Script

Run the following to fetch actual trade history for all tokens and generate a full report:

```bash
cd "/Users/samyip/Documents/repo other/Bullseye_v2"
bun run fetch_trades.ts
```

**Outputs:**
- `docs/trade_history_all_tokens.json` — Raw trade data (JSON)
- `docs/TRADE_HISTORY_REPORT.md` — Formatted markdown report with trade tables, buy/sell ratios, price volatility, and recommended test trades

---

## Appendix B: API Quick Reference

### Quick Backtest
```bash
curl -X POST http://localhost:3000/api/strategies/quick-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "curveId": "0x577fd22aaa52449aa11518ab80d611185a9a8aaa",
    "params": {
      "entryType": "price_dip",
      "entryThresholdPercent": -5,
      "lookbackTrades": 20,
      "takeProfitPercent": 20,
      "stopLossPercent": -10,
      "positionSizeEth": 0.000514
    }
  }'
```

### Save Strategy + Backtest
```bash
# Step 1: Save
curl -X POST http://localhost:3000/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Strategy",
    "curveId": "0x577fd22aaa52449aa11518ab80d611185a9a8aaa",
    "strategyType": "price_dip",
    "params": {
      "entryType": "price_dip",
      "entryThresholdPercent": -5,
      "lookbackTrades": 20,
      "takeProfitPercent": 20,
      "stopLossPercent": -10,
      "positionSizeEth": 0.000514
    }
  }'

# Step 2: Backtest
curl -X POST http://localhost:3000/api/strategies/<id>/backtest
```

### List All Tokens (via Backend)
```bash
curl http://localhost:3000/api/tokens?active=false&limit=200
```

### Get Trades for a Token (via Backend)
```bash
curl "http://localhost:3000/api/tokens/0x577fd22aaa52449aa11518ab80d611185a9a8aaa/trades?limit=50&order=desc"
```

### Direct Subgraph Query (via curl)
```bash
curl -X POST "https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetTrades($curve: ID!, $limit: Int!) { trades(where: { curve: $curve }, orderBy: timestamp, orderDirection: desc, first: $limit) { side trader amountEth amountToken priceEth priceUsd timestamp txHash } }",
    "variables": {
      "curve": "0x577fd22aaa52449aa11518ab80d611185a9a8aaa",
      "limit": 50
    }
  }'
```
