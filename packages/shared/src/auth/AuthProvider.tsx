import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/endpoints";
import { tokenStore } from "../api/client";
import type { Business, Role, Session, User } from "../api/types";
import { Loading } from "../ui/primitives";

interface AuthState {
  user: User | null; business: Business | null; status: "loading" | "authed" | "anon";
  signIn: (s: Session) => void; signOut: () => Promise<void>; refresh: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>(tokenStore.get() ? "loading" : "anon");

  const refresh = useCallback(async () => {
    try { const me = await authApi.me(); setUser(me.user); setBusiness(me.business); setStatus("authed"); }
    catch { tokenStore.set(null); setUser(null); setStatus("anon"); }
  }, []);
  useEffect(() => { if (tokenStore.get()) refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => { tokenStore.set(null); setUser(null); setStatus("anon"); };
    window.addEventListener("pd:unauthorized", h); return () => window.removeEventListener("pd:unauthorized", h);
  }, []);

  const signIn = (s: Session) => { tokenStore.set(s.token); setUser(s.user); setBusiness(s.business); setStatus("authed"); };
  const signOut = async () => { try { await authApi.logout(); } catch { /* ignore */ } tokenStore.set(null); qc.clear(); setUser(null); setStatus("anon"); };
  const can = (...roles: Role[]) => !!user && roles.includes(user.role);
  return <Ctx.Provider value={{ user, business, status, signIn, signOut, refresh, can }}>{children}</Ctx.Provider>;
}
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error("useAuth outside AuthProvider"); return c; };

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { status, can } = useAuth();
  const loc = useLocation();
  if (status === "loading") return <div className="min-h-screen bg-paper"><Loading label="Checking your session…" /></div>;
  if (status === "anon") return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !can(...roles)) return <div className="p-10 text-center text-sm text-ink-soft">Your role doesn't have access to this page. Ask an admin to change your permissions.</div>;
  return <>{children}</>;
}
