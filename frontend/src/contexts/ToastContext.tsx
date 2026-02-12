import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Send, X, Filter, Rocket, Info } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastVariant = "telegram" | "info" | "success" | "error";

interface Toast {
  id: string;
  message: string;
  detail?: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  addToast: (
    message: string,
    opts?: { detail?: string; variant?: ToastVariant; durationMs?: number }
  ) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICONS: Record<ToastVariant, ReactNode> = {
  telegram: <Send className="w-4 h-4 text-[#2AABEE]" />,
  info: <Info className="w-4 h-4 text-phosphor" />,
  success: <Rocket className="w-4 h-4 text-phosphor" />,
  error: <Filter className="w-4 h-4 text-red-400" />,
};

const BG: Record<ToastVariant, string> = {
  telegram:
    "bg-[#0d1117] border-[#2AABEE]/30 shadow-[0_0_20px_rgba(42,171,238,0.1)]",
  info: "bg-[#0d1117] border-phosphor/20 shadow-[0_0_20px_rgba(0,255,65,0.05)]",
  success:
    "bg-[#0d1117] border-phosphor/30 shadow-[0_0_20px_rgba(0,255,65,0.1)]",
  error:
    "bg-[#0d1117] border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]",
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (
      message: string,
      opts?: { detail?: string; variant?: ToastVariant; durationMs?: number }
    ) => {
      const id = crypto.randomUUID();
      const toast: Toast = {
        id,
        message,
        detail: opts?.detail,
        variant: opts?.variant ?? "info",
        durationMs: opts?.durationMs ?? 5000,
      };

      setToasts((prev) => [...prev, toast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.durationMs);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast container — fixed top-right */}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm max-w-sm animate-slide-in-right ${BG[toast.variant]}`}
          >
            <div className="mt-0.5 shrink-0">{ICONS[toast.variant]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white leading-tight">
                {toast.message}
              </p>
              {toast.detail && (
                <p className="text-[0.65rem] text-gray-400 mt-0.5 font-mono leading-relaxed">
                  {toast.detail}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors mt-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
