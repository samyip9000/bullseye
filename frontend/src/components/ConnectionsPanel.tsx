import { useEffect, useState } from "react";
import {
  X,
  Link2,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Unplug,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "../contexts/WalletContext";
import {
  pairTelegram,
  getTelegramStatus,
  disconnectTelegram,
} from "../services/api";

interface ConnectionsPanelProps {
  open: boolean;
  onClose: () => void;
}

const TELEGRAM_BOT_URL = "https://t.me/bullseye_tgbot";

export default function ConnectionsPanel({
  open,
  onClose,
}: ConnectionsPanelProps) {
  const { address } = useWallet();

  const [pairingCode, setPairingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Connection status
  const [connected, setConnected] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [pairedAt, setPairedAt] = useState<string | null>(null);

  // Fetch current status on open
  useEffect(() => {
    if (open && address) {
      checkStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address]);

  // Clear form state when closing
  useEffect(() => {
    if (!open) {
      setError(null);
      setSuccess(null);
      setPairingCode("");
    }
  }, [open]);

  const checkStatus = async () => {
    if (!address) return;
    setCheckingStatus(true);
    try {
      const res = await getTelegramStatus(address);
      setConnected(res.connected);
      setTelegramUsername(res.telegramUsername ?? null);
      setPairedAt(res.pairedAt ?? null);
    } catch {
      // Ignore — just means no connection yet
    } finally {
      setCheckingStatus(false);
    }
  };

  const handlePair = async () => {
    if (!address || !pairingCode.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await pairTelegram(address, pairingCode.trim());
      setSuccess(res.message);
      setConnected(true);
      setTelegramUsername(res.telegramUsername);
      setPairedAt(new Date().toISOString());
      setPairingCode("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to pair. Check the code and try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await disconnectTelegram(address);
      setConnected(false);
      setTelegramUsername(null);
      setPairedAt(null);
      setSuccess("Telegram disconnected successfully");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to disconnect";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-obsidian-surface border-l border-white/[0.08] z-50 flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-phosphor/10 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-phosphor" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                CONNECTIONS
              </h2>
              <p className="text-[0.65rem] text-gray-500 font-mono">
                Link external services
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-gray-500 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Telegram Section */}
          <div className="p-5">
            <div className="text-[0.6rem] uppercase tracking-widest text-gray-500 font-bold mb-4">
              Telegram Bot
            </div>

            {/* Telegram Logo + Info Card */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#2AABEE]/10 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 text-[#2AABEE]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Telegram</p>
                  <p className="text-[0.65rem] text-gray-500">
                    Real-time alerts & notifications
                  </p>
                </div>
                {checkingStatus ? (
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin ml-auto shrink-0" />
                ) : connected ? (
                  <div className="ml-auto flex items-center gap-1.5 bg-phosphor/10 px-2 py-1 rounded-full shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-phosphor shadow-[0_0_6px_#00ff41]" />
                    <span className="text-[0.6rem] font-bold text-phosphor uppercase tracking-wider">
                      Paired
                    </span>
                  </div>
                ) : (
                  <div className="ml-auto flex items-center gap-1.5 bg-white/[0.03] px-2 py-1 rounded-full shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                    <span className="text-[0.6rem] font-bold text-gray-500 uppercase tracking-wider">
                      Not Connected
                    </span>
                  </div>
                )}
              </div>

              {connected && (
                <div className="space-y-1">
                  {telegramUsername && (
                    <p className="text-[0.65rem] text-gray-400 font-mono">
                      @{telegramUsername}
                    </p>
                  )}
                  {pairedAt && (
                    <p className="text-[0.6rem] text-gray-600 font-mono">
                      Paired{" "}
                      {new Date(pairedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Pairing or Disconnect based on state */}
            {connected ? (
              <div className="space-y-3">
                <div className="bg-phosphor/5 border border-phosphor/15 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-phosphor mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-white font-semibold mb-1">
                        Telegram is connected
                      </p>
                      <p className="text-[0.65rem] text-gray-400 leading-relaxed">
                        You'll receive trade alerts, strategy notifications, and
                        market updates directly in Telegram.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-loss/20 text-loss hover:bg-loss/10 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unplug className="w-3.5 h-3.5" />
                  )}
                  Disconnect Telegram
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Instructions */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[0.65rem] text-gray-400 leading-relaxed mb-3">
                    To pair your Telegram account:
                  </p>
                  <ol className="space-y-2.5 text-[0.65rem] text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-phosphor font-bold min-w-[16px]">
                        1.
                      </span>
                      <span>
                        Open{" "}
                        <a
                          href={TELEGRAM_BOT_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2AABEE] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          @bullseye_tgbot
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>{" "}
                        on Telegram
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-phosphor font-bold min-w-[16px]">
                        2.
                      </span>
                      <span>
                        Send{" "}
                        <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-phosphor font-mono">
                          /pair
                        </code>{" "}
                        to get your unique pairing code
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-phosphor font-bold min-w-[16px]">
                        3.
                      </span>
                      <span>
                        Enter the code below and click{" "}
                        <span className="text-phosphor font-semibold">
                          Pair
                        </span>
                      </span>
                    </li>
                  </ol>
                </div>

                {/* Open Bot Button */}
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#2AABEE]/10 border border-[#2AABEE]/20 text-[#2AABEE] hover:bg-[#2AABEE]/20 hover:border-[#2AABEE]/40 transition-all text-xs font-bold uppercase tracking-wider"
                >
                  <Send className="w-3.5 h-3.5" />
                  Open Bullseye Bot in Telegram
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>

                {/* Input */}
                <div>
                  <label className="text-[0.6rem] uppercase tracking-widest text-gray-500 font-bold mb-2 block">
                    Pairing Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pairingCode}
                      onChange={(e) =>
                        setPairingCode(e.target.value.toUpperCase())
                      }
                      placeholder="e.g. A3K7N2"
                      maxLength={8}
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white font-mono tracking-[0.3em] text-center placeholder:text-gray-600 placeholder:tracking-normal focus:outline-none focus:border-phosphor/40 focus:ring-1 focus:ring-phosphor/20 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePair();
                      }}
                    />
                    <button
                      onClick={handlePair}
                      disabled={loading || !pairingCode.trim()}
                      className="px-4 py-2.5 rounded-lg bg-phosphor/10 border border-phosphor/20 text-phosphor text-xs font-bold uppercase tracking-wider hover:bg-phosphor/20 hover:border-phosphor/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" />
                      )}
                      Pair
                    </button>
                  </div>
                  <p className="text-[0.55rem] text-gray-600 mt-2 font-mono">
                    Codes expire after 10 minutes
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 bg-loss/5 border border-loss/15 rounded-xl p-4 mt-3">
                <AlertCircle className="w-4 h-4 text-loss mt-0.5 shrink-0" />
                <p className="text-xs text-loss/90">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-start gap-3 bg-phosphor/5 border border-phosphor/15 rounded-xl p-4 mt-3">
                <CheckCircle2 className="w-4 h-4 text-phosphor mt-0.5 shrink-0" />
                <p className="text-xs text-phosphor/90">{success}</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.05] mx-5" />

          {/* Future Connections Placeholder */}
          <div className="p-5">
            <div className="text-[0.6rem] uppercase tracking-widest text-gray-500 font-bold mb-3">
              More Integrations
            </div>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Link2 className="w-8 h-8 text-gray-700 mb-3" />
              <p className="text-xs text-gray-500 font-mono">Coming soon</p>
              <p className="text-[0.6rem] text-gray-600 mt-1">
                Discord, Webhooks, and more
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.05] text-center">
          <p className="text-[0.55rem] text-gray-600 font-mono">
            Connections are linked to your wallet address
          </p>
        </div>
      </div>
    </>
  );
}
