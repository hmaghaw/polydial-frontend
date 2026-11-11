import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { phonesApi, billingApi } from "../api/endpoints";
import { cn } from "../lib/cn";
import { cents } from "../lib/format";
import { env } from "../lib/env";
import { Logo } from "./Logo";

export interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean; roles?: ("admin" | "manager" | "staff")[] }
export interface NavGroup { label?: string; items: NavItem[] }

function LiveLine() {
  const { data: phones } = useQuery({ queryKey: ["phones"], queryFn: phonesApi.list });
  const primary = phones?.find((p) => p.is_primary) ?? phones?.[0];
  return (
    <div className="mx-3 mb-4 rounded-md border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-white/60">
        <span className={cn("relative flex h-2 w-2", !primary && "opacity-40")}>
          {primary && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60 motion-reduce:animate-none" />}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", primary ? "bg-live" : "bg-white/40")} />
        </span>
        {primary ? "AI receptionist answering" : "No number yet"}
      </div>
      {primary && <p className="mt-1 font-display text-[15px] font-medium text-white tabular-nums">{primary.business_phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}</p>}
      {primary?.language_code && <p className="text-xs text-white/50">Greets in {primary.language_code.toUpperCase()} · {phones!.length} line{phones!.length > 1 ? "s" : ""}</p>}
    </div>
  );
}

export function AppShell({ nav, portalName }: { nav: NavGroup[]; portalName: string }) {
  const { user, business, signOut, can } = useAuth();
  const [open, setOpen] = useState(false);
  const nav$ = useNavigate();
  const { data: billing } = useQuery({ queryKey: ["billing"], queryFn: billingApi.summary });

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-ink text-white">
      <div className="flex items-center justify-between px-5 pb-5 pt-5">
        <Logo portal={portalName} />
        <button className="lg:hidden text-white/70" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <LiveLine />
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {nav.map((g, i) => (
          <div key={i} className="mb-4">
            {g.label && <p className="px-2 pb-1 text-xs text-white/40">{g.label}</p>}
            {g.items.filter((it) => !it.roles || can(...it.roles)).map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)}
                className={({ isActive }) => cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors [&>svg]:h-4 [&>svg]:w-4",
                  isActive ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
                {it.icon}{it.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="truncate text-sm text-white">{user?.first_name} {user?.last_name}</p>
        <p className="truncate text-xs text-white/50">{business?.name} · {user?.role}</p>
        <button onClick={async () => { await signOut(); nav$("/login"); }} className="mt-2 flex items-center gap-2 text-xs text-white/60 hover:text-white"><LogOut className="h-3.5 w-3.5" />Sign out</button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-paper">
      <div className="hidden lg:block lg:fixed lg:inset-y-0">{sidebar}</div>
      {open && <div className="fixed inset-0 z-40 flex lg:hidden"><div className="h-full">{sidebar}</div><div className="flex-1 bg-ink/40" onClick={() => setOpen(false)} /></div>}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur sm:px-8">
          <button className="lg:hidden rounded p-1.5 text-ink hover:bg-ink/5" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-3 ml-auto text-sm">
            {env.USE_MOCKS && <span className="rounded bg-live/15 px-2 py-0.5 text-xs font-medium text-[#8a5a0f]" title="Data is simulated in your browser">Demo data</span>}
            {billing && <NavLink to="/billing" className={cn("rounded-md px-2.5 py-1 tabular-nums", billing.balance_cents < 500 ? "bg-danger/10 text-danger" : "text-ink-soft hover:bg-ink/5")}>Balance {cents(billing.balance_cents)}</NavLink>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
