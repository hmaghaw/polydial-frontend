import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
type T = { id: number; msg: string; tone: "ok" | "err" };
const Ctx = createContext<(msg: string, tone?: "ok" | "err") => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-md bg-ink px-4 py-3 text-sm text-white shadow-lg">
            {t.tone === "ok" ? <CheckCircle2 className="h-4 w-4 text-signal-300" /> : <AlertCircle className="h-4 w-4 text-live" />}{t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
