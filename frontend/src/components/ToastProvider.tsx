import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "canary" | "danger" | "muted";

export type ToastItem = {
  id: string;
  title: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id"> & { id?: string }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id"> & { id?: string }) => {
      const id = toast.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 5));
      window.setTimeout(() => dismiss(id), 6500);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-20 z-[60] flex w-[min(100%-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={[
              "glass-panel pointer-events-auto px-4 py-3 text-left",
              t.tone === "danger" ? "border-[var(--danger)]" : "",
            ].join(" ")}
          >
            <p className="text-sm font-medium text-[var(--text)]">
              {t.title}
            </p>
            {t.message && (
              <p className="mt-1 text-xs text-[var(--muted)]">{t.message}</p>
            )}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
