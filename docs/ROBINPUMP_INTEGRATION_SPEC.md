# RobinPump Integration Specification

**Version:** 1.0  
**Date:** February 11, 2026  
**Network:** Base (Chain ID: 8453) / Base Sepolia (Chain ID: 84532)  
**Status:** MVP Integration  

---

## 1. Overview

This document specifies how the RobinPump DeFi application integrates with the [RobinPump](https://robinpump.fun) bonding curve protocol on Base network. RobinPump is a token launchpad that allows anyone to create tokens with a bonding curve pricing mechanism. When a bonding curve accumulates enough ETH (graduates), liquidity is automatically deployed to Aerodrome (Base's primary DEX).

Our integration provides:
- **Real-time price feeds** from RobinPump bonding curves
- **Buy/sell operations** directly through bonding curve contracts
- **Curve discovery** via the Factory contract and Goldsky subgraph
- **Graduation monitoring** to detect when tokens move to Aerodrome DEX

---

## 2. Network Configuration

| Parameter | Mainnet | Testnet |
|---|---|---|
| **Network** | Base | Base Sepolia |
| **Chain ID** | 8453 | 84532 |
| **RPC** | `https://mainnet.base.org` | `https://sepolia.base.org` |
| **Block Explorer** | https://basescan.org | https://sepolia.basescan.org |
| **Native Token** | ETH | ETH |

---

## 3. Contract Addresses

### 3.1 RobinPump Core Contracts

| Contract | Mainnet Address | Purpose |
|---|---|---|
| **Factory (Proxy)** | `0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb` | Creates new bonding curves and tokens |
| **Factory Implementation** | `0xEad0C03Caa6d3f723ec3CEA1899b2c6c8e2DCfed` | Logic contract behind the proxy |
| **Factory Deployer** | `0xab775bE159e630a0dacf230579ddd9a4C8cB9E3A` | EOA that deployed the factory |

| Contract | Testnet Address (Base Sepolia) | Purpose |
|---|---|---|
| **Factory** | `0x9cEcC80AD70a69711a6BbB6842c1509c02A2Dd06` | Testnet factory |

### 3.2 External Dependencies


| Contract | Mainnet Address | Purpose |
|---|---|---|
| **WETH** | `0x4200000000000000000000000000000000000006` | Wrapped ETH (Base standard) |
| **Aerodrome Router** | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | DEX router for graduated tokens |
| **Aerodrome Factory** | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | DEX pool factory |
| **Chainlink ETH/USD** | `0x57d2d46Fc7ff2A7142d479F2f59e1E3F95447077` | Price oracle for ETH/USD conversion |

| Contract | Testnet Address (Base Sepolia) | Purpose |
|---|---|---|
| **WETH** | `0x8EA7Ce7Be0c1E3425e85103a1A76a105f952fA92` | Testnet WETH |
| **Aerodrome Router** | `0x1c08d3722b19f16A7bA69Ad5814e2a514A83524A` | Testnet DEX router |
| **Aerodrome Factory** | `0x8D8C738cC8f30f5D025E62D3c1B9e51e6eD13f77` | Testnet DEX pool factory |

### 3.3 Dynamic Addresses (Per-Curve)

Each token created on RobinPump deploys two contracts:
- **Bonding Curve Contract** — Holds ETH reserves and manages buy/sell pricing
- **ERC-20 Token Contract** — The token itself

These addresses are returned by the `CurveCreated` event and can be looked up via:
- `Factory.tokenToCurve(tokenAddress)` → curve address
- `Factory.isCurve(address)` → boolean
- `BondingCurve.getCurveInfo()` → token address + metadata

---

## 4. Factory Contract Interface

**Address:** `0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb`

### 4.1 Read Functions

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `totalCurves()` | — | `uint256` | Total number of bonding curves created |
| `getCurves(start, count)` | `uint256, uint256` | `address[]` | Paginated list of curve addresses |
| `allCurves(index)` | `uint256` | `address` | Curve address at index |
| `tokenToCurve(token)` | `address` | `address` | Look up curve for a token |
| `curveCreator(curve)` | `address` | `address` | Creator of a curve |
| `isCurve(addr)` | `address` | `bool` | Whether address is a valid curve |
| `getBondingCurveConfig()` | — | `(uint256 initialVirtualEth, uint256 bondingCurveSupply, uint256 currentGraduationThreshold, uint256 feePercent, uint256 feeDenominator)` | Global bonding curve parameters |
| `getInitialVirtualToken()` | — | `uint256` | Initial virtual token reserve |
| `getMaxEth()` | — | `uint256` | Max ETH before graduation |
| `getPurchaseCapPercent()` | — | `(uint256 percent, uint256 denominator)` | Max purchase cap as a percentage |

### 4.2 Write Functions

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `createToken(name, symbol, uri, deadline)` | `string, string, string, uint256` | `(address curve, address token, uint256 tokensReceived)` | Create a new bonding curve + token. **Payable** — sends ETH for initial buy. |

### 4.3 Events

| Event | Parameters | Description |
|---|---|---|
| `CurveCreated` | `curve (indexed), token (indexed), name, symbol, creator (indexed)` | Emitted when a new bonding curve is created |

---

## 5. Bonding Curve Contract Interface

Each bonding curve is deployed as a separate contract. These are the functions available on each curve.

### 5.1 Read Functions (Price Feeds)

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `getCurveInfo()` | — | `(address token, string name, string symbol, string uri, uint256 currentPrice, uint256 marketCap, uint256 virtualEthReserve, uint256 virtualTokenReserve, uint256 tokensAvailable)` | Full curve state |
| `getCurrentPrice()` | — | `uint256` | Current token price in ETH (wei) |
| `getMarketCap()` | — | `uint256` | Current market cap in ETH (wei) |
| `simulateBuy(ethAmount)` | `uint256` | `(uint256 ethToUse, uint256 tokensOut, uint256 refundAmount, bool willGraduate, bool isPartialFill)` | Simulate a buy to preview output |
| `getEthForTokens(tokenAmount)` | `uint256` | `uint256` | ETH you'd receive for selling tokens |
| `getEthRequiredForTokens(tokenAmount)` | `uint256` | `uint256` | ETH required to buy a given token amount |
| `getGraduationInfo()` | — | `(bool graduated, uint256 progress, uint256 ethCollected, uint256 ethThreshold, address pool, uint256 graduatedAt, uint256 lpTokensBurned)` | Graduation status and progress |

### 5.2 Write Functions (Buy/Sell)

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `buy(minTokensOut, deadline)` | `uint256, uint256` | — | **Payable.** Buy tokens with ETH. Slippage protected by `minTokensOut`. Deadline for expiry. |
| `sell(tokensToSell, minEthOut, deadline)` | `uint256, uint256, uint256` | — | Sell tokens for ETH. Slippage protected by `minEthOut`. Deadline for expiry. |

### 5.3 Events

| Event | Parameters | Description |
|---|---|---|
| `TokensBought` | `buyer, ethAmount, tokenAmount, newPrice` | Emitted on buy |
| `TokensSold` | `seller, tokenAmount, ethAmount, newPrice` | Emitted on sell |
| `CurveGraduated` | `pool, ethLiquidity, tokenLiquidity` | Emitted when curve graduates to Aerodrome |

---

## 6. Bonding Curve Mechanics

### 6.1 Pricing Formula

RobinPump uses a **virtual reserve constant-product** bonding curve:

```
price = virtualEthReserve / virtualTokenReserve
```

As ETH is added (buys), `virtualEthReserve` increases and `virtualTokenReserve` decreases, pushing the price up. The reverse happens on sells.

### 6.2 Fee Structure

| Operation | Fee | Deducted From |
|---|---|---|
| Buy | 1% | ETH sent (before token calculation) |
| Sell | 1% | ETH proceeds (before sending to seller) |
| Token Creation | Free | Only gas fees |

### 6.3 Graduation

When a bonding curve accumulates ETH up to its graduation threshold:
1. The curve is **frozen** — no more buys/sells
2. Collected ETH + remaining tokens are deployed to an **Aerodrome liquidity pool**
3. LP tokens are **burned** (permanent liquidity)
4. Token now trades freely on Aerodrome DEX

Check graduation status: `getGraduationInfo()` returns `graduated` boolean and `progress` (0–100%).

### 6.4 Purchase Cap

There is a per-transaction purchase cap (percentage of total supply) to prevent single buyers from acquiring too large a position. Query via `Factory.getPurchaseCapPercent()`.

---

## 7. Data Indexing — Goldsky Subgraph

For historical data, analytics, and efficient querying, RobinPump indexes on-chain data via a Goldsky subgraph.

### 7.1 Endpoints

| Network | URL |
|---|---|
| **Mainnet** | `https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn` |
| **Testnet** | `https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts-sepolia/v2/gn` |

### 7.2 Entities

| Entity | Key Fields | Description |
|---|---|---|
| `Curve` | `id, token, name, symbol, creator, currentPrice, marketCap, ethCollected, graduated` | Bonding curve state |
| `Trade` | `id, curve, trader, type (buy/sell), ethAmount, tokenAmount, price, timestamp` | Individual trade events |
| `Pool` | `id, token0, token1, reserve0, reserve1` | Aerodrome pools (post-graduation) |
| `User` | `id, totalTrades, totalEthVolume` | User statistics |
| `Bundle` | `id, ethPrice` | ETH/USD price snapshots |

### 7.3 Example Queries

**Get all active (non-graduated) curves, sorted by market cap:**
```graphql
{
  curves(
    where: { graduated: false }
    orderBy: marketCap
    orderDirection: desc
    first: 50
  ) {
    id
    token
    name
    symbol
    currentPrice
    marketCap
    ethCollected
    creator
  }
}
```

**Get recent trades for a specific curve:**
```graphql
{
  trades(
    where: { curve: "0x..." }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    id
    trader
    type
    ethAmount
    tokenAmount
    price
    timestamp
  }
}
```

**Get graduation status for a curve:**
```graphql
{
  curve(id: "0x...") {
    graduated
    ethCollected
    pool {
      id
      reserve0
      reserve1
    }
  }
}
```

---

## 8. Integration Architecture

```
┌──────────────────────────────────────────────────┐
│              Frontend (Next.js)                   │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │  Curve List  │  │  Buy/Sell UI │  │  Price   │ │
│  │  Discovery   │  │  (per curve) │  │  Charts  │ │
│  └──────┬───────┘  └──────┬───────┘  └────┬────┘ │
│         │                 │                │      │
│  ┌──────┴─────────────────┴────────────────┴────┐ │
│  │         useRobinPump Hook Layer              │ │
│  │  - useFactory()  (curve discovery)           │ │
│  │  - useCurveInfo() (price feeds)              │ │
│  │  - useBuy() / useSell() (trading)            │ │
│  │  - useGraduation() (status monitoring)       │ │
│  └──────────────────────┬───────────────────────┘ │
│                         │ wagmi v2 / viem          │
└─────────────────────────┼─────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────┴────┐    ┌──────┴──────┐   ┌────┴─────┐
    │  Base   │    │  RobinPump  │   │  Goldsky  │
    │  RPC    │    │  Contracts  │   │  Subgraph │
    │ (read/  │    │  (on-chain) │   │ (indexed  │
    │  write) │    │             │   │  data)    │
    └─────────┘    └─────────────┘   └──────────┘
```

---

## 9. Security Considerations

| Risk | Mitigation |
|---|---|
| **Slippage on buys** | Always pass `minTokensOut` from `simulateBuy()` with user-defined tolerance |
| **Slippage on sells** | Always pass `minEthOut` from `getEthForTokens()` with tolerance |
| **Deadline expiry** | Set `deadline = block.timestamp + 20 minutes` for all trades |
| **Front-running** | Bonding curves are inherently front-runnable; use tight slippage |
| **Rug risk** | Check `getGraduationInfo().progress` — higher is safer (more ETH locked) |
| **Purchase cap** | Factory enforces max % per tx; respect in UI to avoid reverts |
| **Graduated curves** | Check `graduated` flag — buy/sell will revert on graduated curves |
| **Contract proxy** | Factory is a proxy; implementation can be upgraded by deployer |

---

## 10. Rate Limits & Gas Estimates

### Gas Estimates (Base L2)

| Operation | Estimated Gas | Estimated Cost (@ 0.01 gwei) |
|---|---|---|
| `buy()` | ~150,000 | < $0.01 |
| `sell()` | ~120,000 | < $0.01 |
| `createToken()` | ~2,500,000 | ~$0.05 |
| Read calls | 0 (view) | Free |

### RPC Rate Limits

- Public Base RPC: ~25 req/s
- Alchemy/Infura: varies by plan
- Goldsky subgraph: standard GraphQL rate limits

---

## 11. File Manifest

| File | Location | Purpose |
|---|---|---|
| `IRobinPumpFactory.sol` | `contracts/src/interfaces/robinpump/` | Factory interface (Solidity) |
| `IRobinPumpCurve.sol` | `contracts/src/interfaces/robinpump/` | Bonding curve interface (Solidity) |
| `robinpump-abis.ts` | `frontend/src/lib/robinpump/` | TypeScript ABI definitions |
| `robinpump-addresses.ts` | `frontend/src/lib/robinpump/` | Contract addresses by chain |
| `robinpump-subgraph.ts` | `frontend/src/lib/robinpump/` | Goldsky subgraph queries |
| `useRobinPump.ts` | `frontend/src/hooks/` | React hooks for buy/sell/price |
| `CurveCard.tsx` | `frontend/src/components/robinpump/` | Curve info + trading UI |
| `CurveList.tsx` | `frontend/src/components/robinpump/` | Discover active curves |
| `ROBINPUMP_INTEGRATION_SPEC.md` | `docs/` | This document |
