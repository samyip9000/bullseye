import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { useToast } from "../contexts/ToastContext";
import {
  getTelegramActions,
  ackTelegramAction,
  type TelegramAction,
} from "../services/api";
import {
  parseNaturalLanguageFilters,
  describeFilters,
} from "../utils/nlFilterParser";
import type { FilterRule } from "../types";

const POLL_INTERVAL_MS = 3000;

interface UseTelegramActionsOpts {
  /** Callback to apply filter rules to the screener */
  onApplyFilters: (filters: FilterRule[], rawQuery: string) => void;
}

/**
 * Polls for pending Telegram actions and dispatches them:
 * - apply_filter → navigates to /screener and applies filters
 * - open_strategy → navigates to /strategy/:id
 */
export function useTelegramActions({ onApplyFilters }: UseTelegramActionsOpts) {
  const { address, isConnected } = useWallet();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const processingRef = useRef(false);

  const processActions = useCallback(async () => {
    if (!address || !isConnected || processingRef.current) return;

    processingRef.current = true;
    try {
      const { actions } = await getTelegramActions(address);

      for (const action of actions) {
        await handleAction(action);
        // Acknowledge so it won't be returned again
        await ackTelegramAction(action.id).catch(() => {});
      }
    } catch {
      // Silently ignore polling failures
    } finally {
      processingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected]);

  const handleAction = useCallback(
    async (action: TelegramAction) => {
      switch (action.type) {
        case "apply_filter": {
          const query = (action.payload.query as string) || "";
          const filters = parseNaturalLanguageFilters(query);

          if (filters.length > 0) {
            const desc = describeFilters(filters);
            onApplyFilters(filters, query);
            navigate("/screener");
            addToast("Telegram: Filter applied", {
              detail: desc,
              variant: "telegram",
              durationMs: 6000,
            });
          } else {
            addToast("Telegram: Could not parse filter", {
              detail: `"${query}" — try rephrasing`,
              variant: "error",
              durationMs: 5000,
            });
          }
          break;
        }

        case "open_strategy": {
          const strategyId = action.payload.strategyId as string;
          const strategyName = action.payload.strategyName as string;
          if (strategyId) {
            navigate(`/strategy/${strategyId}`);
            addToast("Telegram: Opening strategy", {
              detail: strategyName || strategyId.slice(0, 8),
              variant: "telegram",
              durationMs: 5000,
            });
          }
          break;
        }

        default:
          break;
      }
    },
    [onApplyFilters, navigate, addToast]
  );

  useEffect(() => {
    if (!address || !isConnected) return;

    // Poll immediately on mount, then on interval
    processActions();
    const interval = setInterval(processActions, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [address, isConnected, processActions]);
}
