import { useRef, useCallback } from "react";
import { parseEther, formatEther, formatUnits } from "viem";
import type { WalletClient, PublicClient } from "viem";
import {
  BONDING_CURVE_ABI,
  ERC20_ABI,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_DEADLINE_SECONDS,
} from "../lib/robinpump/abis";
import type {
  LiveStrategy,
  LiveExecutedTrade,
  LiveStrategyResult,
} from "../types";

interface ExecutorCallbacks {
  onTradeExecuted: (trade: LiveExecutedTrade) => void;
  onStrategyComplete: (result: LiveStrategyResult) => void;
  onStatusUpdate: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Hook that manages the lifecycle of executing a live strategy's
 * buy/sell trades on the bonding curve over the selected timeframe.
 *
 * For each planned trade from the backtest:
 *   1. Execute a BUY on the bonding curve (split ETH evenly)
 *   2. Wait for a calculated interval
 *   3. Execute a SELL of all tokens received from the buy
 *   4. Record the PnL
 *
 * Trades are spaced evenly across the strategy duration.
 */
export function useStrategyExecutor() {
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const execute = useCallback(
    async (
      strategy: LiveStrategy,
      walletClient: WalletClient,
      publicClient: PublicClient,
      address: string,
      callbacks: ExecutorCallbacks
    ) => {
      if (runningRef.current) {
        callbacks.onError("A strategy is already running");
        return;
      }

      runningRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;

      const curveAddress = strategy.curveAddress as `0x${string}`;
      const userAddress = address as `0x${string}`;
      const totalTrades = strategy.backtestResult.trades.length;

      if (totalTrades === 0) {
        callbacks.onError("No trades to execute");
        runningRef.current = false;
        return;
      }

      // Split ETH evenly across planned trades
      const ethPerTrade = strategy.investAmountEth / totalTrades;

      // Space trades evenly across duration (buy at start of slot, sell at end)
      const slotDurationMs = strategy.durationMs / totalTrades;

      const executedTrades: LiveExecutedTrade[] = [];
      let totalBuyEth = 0;
      let totalSellEth = 0;
      let wins = 0;
      let losses = 0;

      callbacks.onStatusUpdate(
        `Starting strategy: ${totalTrades} trades, ${ethPerTrade.toFixed(6)} ETH each`
      );

      for (let i = 0; i < totalTrades; i++) {
        if (controller.signal.aborted) break;

        const plannedTrade = strategy.backtestResult.trades[i];

        // --- EXECUTE BUY ---
        try {
          callbacks.onStatusUpdate(
            `Trade ${i + 1}/${totalTrades}: Buying with ${ethPerTrade.toFixed(6)} ETH...`
          );

          const ethWei = parseEther(ethPerTrade.toFixed(18));
          const deadline = BigInt(
            Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS
          );

          // Simulate buy
          const simResult = await publicClient.readContract({
            address: curveAddress,
            abi: BONDING_CURVE_ABI,
            functionName: "simulateBuy",
            args: [ethWei],
          });

          const tokensOut = simResult[1];
          if (tokensOut === 0n) {
            callbacks.onError(
              `Trade ${i + 1}: simulateBuy returned 0 tokens — curve may be graduated`
            );
            continue;
          }

          const minTokensOut =
            (tokensOut * BigInt(10000 - DEFAULT_SLIPPAGE_BPS)) / 10000n;

          // Execute buy
          const buyTxHash = await walletClient.writeContract({
            address: curveAddress,
            abi: BONDING_CURVE_ABI,
            functionName: "buy",
            args: [minTokensOut, deadline],
            value: ethWei,
            account: userAddress,
            chain: walletClient.chain,
          });

          await publicClient.waitForTransactionReceipt({ hash: buyTxHash });

          const tokenAmountNum = Number(formatUnits(tokensOut, 18));
          const priceAtBuy = ethPerTrade / tokenAmountNum;

          const buyTrade: LiveExecutedTrade = {
            side: "buy",
            ethAmount: ethPerTrade,
            tokenAmount: tokenAmountNum,
            price: priceAtBuy,
            timestamp: Date.now(),
            txHash: buyTxHash,
            status: "confirmed",
          };
          executedTrades.push(buyTrade);
          totalBuyEth += ethPerTrade;
          callbacks.onTradeExecuted(buyTrade);
          callbacks.onStatusUpdate(
            `Trade ${i + 1}: Bought ${tokenAmountNum.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens`
          );
        } catch (err) {
          console.error(`Buy trade ${i + 1} failed:`, err);
          const failedBuy: LiveExecutedTrade = {
            side: "buy",
            ethAmount: ethPerTrade,
            tokenAmount: 0,
            price: 0,
            timestamp: Date.now(),
            status: "failed",
          };
          executedTrades.push(failedBuy);
          callbacks.onError(
            `Trade ${i + 1} buy failed: ${err instanceof Error ? err.message : "Unknown error"}`
          );
          continue; // Skip sell for this trade
        }

        if (controller.signal.aborted) break;

        // --- WAIT before selling ---
        // Wait for a portion of the slot (leaving time for sell execution)
        const waitMs = Math.max(slotDurationMs * 0.6, 5000);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, waitMs);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        });

        if (controller.signal.aborted) {
          // If aborted during wait, still try to sell tokens
          callbacks.onStatusUpdate(
            `Strategy stopped — selling remaining tokens from trade ${i + 1}...`
          );
        }

        // --- EXECUTE SELL ---
        try {
          // Get curve info to find the token address
          const curveInfo = await publicClient.readContract({
            address: curveAddress,
            abi: BONDING_CURVE_ABI,
            functionName: "getCurveInfo",
          });
          const tokenAddress = curveInfo[0] as `0x${string}`;

          // Get user's token balance
          const tokenBalance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [userAddress],
          });

          if (tokenBalance === 0n) {
            callbacks.onStatusUpdate(
              `Trade ${i + 1}: No tokens to sell (balance is 0)`
            );
            continue;
          }

          // Get ETH output for selling all tokens from this buy
          // Use the token amount from the buy or the full balance (whichever is less)
          const lastBuy = executedTrades.filter(
            (t) => t.side === "buy" && t.status === "confirmed"
          ).pop();
          const tokensToSell = lastBuy
            ? (() => {
                const buyTokensWei = parseEther(
                  lastBuy.tokenAmount.toFixed(18)
                );
                return buyTokensWei > tokenBalance
                  ? tokenBalance
                  : buyTokensWei;
              })()
            : tokenBalance;

          const ethOut = await publicClient.readContract({
            address: curveAddress,
            abi: BONDING_CURVE_ABI,
            functionName: "getEthForTokens",
            args: [tokensToSell],
          });

          const minEthOut =
            (ethOut * BigInt(10000 - DEFAULT_SLIPPAGE_BPS)) / 10000n;

          const deadline = BigInt(
            Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS
          );

          // Check allowance and approve if needed
          const currentAllowance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [userAddress, curveAddress],
          });

          if (currentAllowance < tokensToSell) {
            callbacks.onStatusUpdate(
              `Trade ${i + 1}: Approving token spend...`
            );
            const approveTx = await walletClient.writeContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [curveAddress, tokensToSell],
              account: userAddress,
              chain: walletClient.chain,
            });
            await publicClient.waitForTransactionReceipt({ hash: approveTx });
          }

          callbacks.onStatusUpdate(
            `Trade ${i + 1}: Selling tokens for ~${Number(formatEther(ethOut)).toFixed(6)} ETH...`
          );

          const sellTxHash = await walletClient.writeContract({
            address: curveAddress,
            abi: BONDING_CURVE_ABI,
            functionName: "sell",
            args: [tokensToSell, minEthOut, deadline],
            account: userAddress,
            chain: walletClient.chain,
          });

          await publicClient.waitForTransactionReceipt({ hash: sellTxHash });

          const ethReceived = Number(formatEther(ethOut));
          const tokensSoldNum = Number(formatUnits(tokensToSell, 18));
          const priceAtSell = ethReceived / tokensSoldNum;
          const pnlEth = ethReceived - ethPerTrade;
          const pnlPercent = (pnlEth / ethPerTrade) * 100;

          const isWin = pnlEth >= 0;
          if (isWin) wins++;
          else losses++;

          totalSellEth += ethReceived;

          const sellTrade: LiveExecutedTrade = {
            side: "sell",
            ethAmount: ethReceived,
            tokenAmount: tokensSoldNum,
            price: priceAtSell,
            timestamp: Date.now(),
            txHash: sellTxHash,
            status: "confirmed",
            pnlPercent,
            pnlEth,
          };
          executedTrades.push(sellTrade);
          callbacks.onTradeExecuted(sellTrade);
          callbacks.onStatusUpdate(
            `Trade ${i + 1}: Sold for ${ethReceived.toFixed(6)} ETH (${pnlEth >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%)`
          );
        } catch (err) {
          console.error(`Sell trade ${i + 1} failed:`, err);
          const failedSell: LiveExecutedTrade = {
            side: "sell",
            ethAmount: 0,
            tokenAmount: 0,
            price: 0,
            timestamp: Date.now(),
            status: "failed",
          };
          executedTrades.push(failedSell);
          callbacks.onError(
            `Trade ${i + 1} sell failed: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }

        // --- WAIT for next trade slot (if not the last trade) ---
        if (i < totalTrades - 1 && !controller.signal.aborted) {
          const remainingSlot = Math.max(slotDurationMs * 0.3, 2000);
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, remainingSlot);
            controller.signal.addEventListener("abort", () => {
              clearTimeout(timer);
              resolve();
            });
          });
        }
      }

      // --- COMPUTE FINAL RESULT ---
      const totalPnlEth = totalSellEth - totalBuyEth;
      const totalPnlPercent =
        totalBuyEth > 0 ? (totalPnlEth / totalBuyEth) * 100 : 0;
      const buys = executedTrades.filter(
        (t) => t.side === "buy" && t.status === "confirmed"
      ).length;
      const sells = executedTrades.filter(
        (t) => t.side === "sell" && t.status === "confirmed"
      ).length;

      const result: LiveStrategyResult = {
        totalPnlEth,
        totalPnlPercent,
        totalVolumeEth: totalBuyEth + totalSellEth,
        tradesExecuted: buys + sells,
        buys,
        sells,
        wins,
        losses,
      };

      callbacks.onStrategyComplete(result);
      runningRef.current = false;
      abortRef.current = null;
    },
    []
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return { execute, stop };
}
