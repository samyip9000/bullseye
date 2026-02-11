import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createBaseAccountSDK } from "@base-org/account";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  formatUnits,
  formatEther,
  toCoinType,
  type WalletClient,
  type PublicClient,
} from "viem";
import { base, mainnet } from "viem/chains";

// ---------- Constants ----------

/** USDC on Base mainnet */
const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ---------- Types ----------

interface WalletBalances {
  usdcRaw: bigint | null;
  usdc: string; // formatted (6 decimals)
  ethRaw: bigint | null;
  eth: string; // formatted (18 decimals)
  loading: boolean;
}

interface WalletState {
  address: string | null;
  ensName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  walletClient: WalletClient | null;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  truncatedAddress: string | null;
  displayName: string | null;
  balances: WalletBalances;
  refreshBalances: () => Promise<void>;
  publicClient: PublicClient;
}

const WalletContext = createContext<WalletContextType | null>(null);

// ---------- SDK Instance ----------

const sdk = createBaseAccountSDK({
  appName: "Bullseye Agent",
  appLogoUrl: "https://bullseye.app/logo.png",
  appChainIds: [base.id],
});

/** Public client for read-only on-chain calls (Base mainnet) */
const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

/** Mainnet public client for ENS resolution */
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http("https://cloudflare-eth.com"),
});

// ---------- Helpers ----------

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const STORAGE_KEY = "bullseye_wallet_address";

// ---------- Provider ----------

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    ensName: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    walletClient: null,
  });

  const [balances, setBalances] = useState<WalletBalances>({
    usdcRaw: null,
    usdc: "0.00",
    ethRaw: null,
    eth: "0.0000",
    loading: false,
  });

  const balanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- Balance fetching ----------

  const fetchBalances = useCallback(async (addr: string) => {
    const hexAddr = addr as `0x${string}`;
    setBalances((b) => ({ ...b, loading: true }));

    // Fetch ETH and USDC independently so one failing doesn't block the other
    const [ethResult, usdcResult] = await Promise.allSettled([
      publicClient.getBalance({ address: hexAddr }),
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [hexAddr],
      }),
    ]);

    setBalances((prev) => {
      const next = { ...prev, loading: false };

      if (ethResult.status === "fulfilled") {
        next.ethRaw = ethResult.value;
        next.eth = formatEther(ethResult.value);
      } else {
        console.error("Failed to fetch ETH balance:", ethResult.reason);
      }

      if (usdcResult.status === "fulfilled") {
        next.usdcRaw = usdcResult.value;
        next.usdc = formatUnits(usdcResult.value, 6);
      } else {
        console.error("Failed to fetch USDC balance:", usdcResult.reason);
      }

      return next;
    });
  }, []);

  const refreshBalances = useCallback(async () => {
    if (state.address) {
      await fetchBalances(state.address);
    }
  }, [state.address, fetchBalances]);

  // Auto-fetch balances when connected, poll every 30s
  useEffect(() => {
    if (state.isConnected && state.address) {
      fetchBalances(state.address);
      balanceIntervalRef.current = setInterval(
        () => fetchBalances(state.address!),
        30_000,
      );
    } else {
      setBalances({
        usdcRaw: null,
        usdc: "0.00",
        ethRaw: null,
        eth: "0.0000",
        loading: false,
      });
    }
    return () => {
      if (balanceIntervalRef.current) clearInterval(balanceIntervalRef.current);
    };
  }, [state.isConnected, state.address, fetchBalances]);

  // Resolve ENS name when address changes
  useEffect(() => {
    if (!state.address) {
      setState((s) => ({ ...s, ensName: null }));
      return;
    }

    let cancelled = false;
    const hexAddr = state.address as `0x${string}`;

    mainnetClient
      .getEnsName({
        address: hexAddr,
        coinType: toCoinType(base.id),
      })
      .then((name) => {
        if (!cancelled) {
          setState((s) => ({ ...s, ensName: name }));
        }
      })
      .catch((err) => {
        console.error("Failed to resolve ENS name:", err);
        if (!cancelled) {
          setState((s) => ({ ...s, ensName: null }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.address]);

  // Restore session on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // Try to reconnect silently
      reconnect(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reconnect = async (savedAddress: string) => {
    try {
      const provider = sdk.getProvider();
      const client = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      const [account] = await client.getAddresses();

      if (account && account.toLowerCase() === savedAddress.toLowerCase()) {
        setState({
          address: account,
          ensName: null,
          isConnected: true,
          isConnecting: false,
          error: null,
          walletClient: client,
        });
      } else {
        // Address mismatch - clear storage
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Silent reconnect failed - not an error to show
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const provider = sdk.getProvider();
      const client = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      // Request account access
      const [account] = await client.requestAddresses();

      if (!account) {
        throw new Error("No account returned from wallet");
      }

      // Sign an authentication message to verify ownership
      const timestamp = Date.now();
      const message = `Sign in to Bullseye Agent\n\nTimestamp: ${timestamp}\nChain: Base`;

      await client.signMessage({
        account,
        message,
      });

      // Auth successful
      localStorage.setItem(STORAGE_KEY, account);

      setState({
        address: account,
        ensName: null,
        isConnected: true,
        isConnecting: false,
        error: null,
        walletClient: client,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";

      // User rejected = code 4001
      const isUserRejection =
        err instanceof Error &&
        ("code" in err && (err as { code: number }).code === 4001);

      setState((s) => ({
        ...s,
        isConnecting: false,
        error: isUserRejection ? null : message,
      }));

      if (!isUserRejection) {
        console.error("Wallet connection failed:", err);
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      address: null,
      ensName: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      walletClient: null,
    });
  }, []);

  const truncatedAddr = state.address ? truncateAddress(state.address) : null;

  const contextValue: WalletContextType = {
    ...state,
    connect,
    disconnect,
    truncatedAddress: truncatedAddr,
    displayName: state.ensName ?? truncatedAddr,
    balances,
    refreshBalances,
    // Cast needed: @base-org/account bundles its own viem, causing duplicate PublicClient types
    publicClient: publicClient as unknown as PublicClient,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

// ---------- Hook ----------

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
