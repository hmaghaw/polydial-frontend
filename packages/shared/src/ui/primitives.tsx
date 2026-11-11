import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "../lib/cn";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "live";
const variants: Record<Variant, string> = {
  primary: "bg-signal text-white hover:bg-signal-700 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:border-ink/30 hover:bg-paper",
  ghost: "text-ink-soft hover:bg-ink/5 hover:text-ink",
  danger: "bg-danger text-white hover:bg-danger/90",
  live: "bg-live text-ink hover:bg-live/90 shadow-sm",
};
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...p }, ref) => (
  <button ref={ref} disabled={disabled || loading}
    className={cn("inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
      size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm", variants[variant], className)} {...p}>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
    {children}
  </button>
));

// ---------- Form controls ----------
const control = "w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-mute focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20 disabled:bg-paper aria-[invalid=true]:border-danger";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(control, "h-10", className)} {...p} />);
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} rows={3} className={cn(control, "py-2", className)} {...p} />);
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => <select ref={ref} className={cn(control, "h-10 pr-8", className)} {...p}>{children}</select>);

export function Field({ label, hint, error, required, children, htmlFor, className }: { label: string; hint?: string; error?: string; required?: boolean; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">{label}{required && <span className="text-danger"> *</span>}</label>
      {children}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : hint ? <p className="text-xs text-ink-mute">{hint}</p> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string; disabled?: boolean; ariaLabel?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      {label && <label htmlFor={id} className="text-sm"><span className="font-medium text-ink">{label}</span>{description && <span className="block text-ink-mute text-xs mt-0.5">{description}</span>}</label>}
      <button id={id} type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-signal/40", checked ? "bg-signal" : "bg-ink/20", disabled && "opacity-50")}>
        <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-ink cursor-pointer py-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-line accent-signal" />
      {label}
    </label>
  );
}

// ---------- Surfaces ----------
export function Card({ title, actions, children, className, bodyClass, description }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-lg border border-line bg-white", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div><h2 className="font-display text-base font-semibold text-ink">{title}</h2>{description && <p className="text-xs text-ink-mute mt-0.5">{description}</p>}</div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

const tones = {
  neutral: "bg-ink/5 text-ink-soft", good: "bg-signal/10 text-signal-700", warn: "bg-live/15 text-[#8a5a0f]",
  bad: "bg-danger/10 text-danger", info: "bg-[#2a78d6]/10 text-[#1d5ba6]",
};
export type Tone = keyof typeof tones;
export const Badge = ({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) =>
  <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn("h-5 w-5 animate-spin text-signal", className)} />;
export const Loading = ({ label = "Loading…" }: { label?: string }) => <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-mute"><Spinner />{label}</div>;

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-ink-mute">{icon}</div>}
      <p className="font-display font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-mute">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return <EmptyState title="This didn't load" body={error instanceof Error ? error.message : "Check your connection and try again."} action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "live" }) {
  return (
    <div className={cn("rounded-lg border bg-white px-5 py-4", tone === "live" ? "border-live/50" : "border-line")}>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-mute">{sub}</p>}
    </div>
  );
}

// ---------- Tabs ----------
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: ReactNode }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line mb-5 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors", value === t.key ? "border-signal text-ink" : "border-transparent text-ink-mute hover:text-ink")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="inline-flex rounded-md border border-line bg-white p-0.5">
      {options.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)} aria-pressed={value === o.key}
          className={cn("rounded px-3 py-1 text-sm", value === o.key ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}>{o.label}</button>
      ))}
    </div>
  );
}

// ---------- Dialog ----------
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])")?.focus(), 30);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className={cn("flex max-h-[92vh] w-full flex-col rounded-t-xl sm:rounded-xl bg-white shadow-xl", w)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div><h2 className="font-display text-lg font-semibold text-ink">{title}</h2>{description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}</div>
          <button data-close onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-mute hover:bg-ink/5 hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = "Delete", loading, tone = "danger" }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string; loading?: boolean; tone?: "danger" | "primary" }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={tone} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="text-sm text-ink-soft">{body}</div>
    </Dialog>
  );
}
