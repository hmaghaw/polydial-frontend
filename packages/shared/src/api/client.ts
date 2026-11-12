import { env } from "../lib/env";
import { mockFetch } from "../mocks/router";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) { super(message); }
}
const TOKEN_KEY = "pd_token";
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string | null) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

/** Claims the Flask API puts in its JWT (services/auth_token_validator.py). */
export interface TokenClaims { user_id?: string; email?: string; business_id?: number; role?: string; provider?: string; exp?: number }
export function decodeToken(token: string | null = tokenStore.get()): TokenClaims | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")))));
  } catch { return null; }
}

type Query = Record<string, string | number | boolean | undefined | null>;
export interface RequestOpts { body?: unknown; query?: Query; /** Overrides the stored session token (e.g. email-link tokens). */ token?: string | null }

export async function request<T>(method: string, path: string, opts: RequestOpts = {}): Promise<T> {
  const qs = new URLSearchParams();
  Object.entries(opts.query ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") qs.set(k, String(v)); });
  const url = path + (qs.toString() ? `?${qs}` : "");
  if (env.USE_MOCKS) return mockFetch<T>(method, url, opts.body, tokenStore.get());

  const token = opts.token !== undefined ? opts.token : tokenStore.get();
  let res: Response;
  try {
    res = await fetch(env.API_BASE_URL + url, {
      method,
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Can't reach the PolyDial API at ${env.API_BASE_URL}. Check API_BASE_URL and that the server is running.`);
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  const d = data as { message?: string; error?: string; success?: boolean; status?: string } | null;
  // The Flask API sometimes reports failures with a 200 and { success: false } or { status: "error" }.
  const softFail = !!d && typeof d === "object" && (d.success === false || d.status === "error");
  if (!res.ok || softFail) {
    // Only an authenticated session expiring should sign the user out, not a failed login.
    if (res.status === 401 && token && opts.token === undefined) window.dispatchEvent(new Event("pd:unauthorized"));
    const msg = (typeof d?.message === "string" && d.message) || (typeof d?.error === "string" && d.error) || `Request failed (${res.status})`;
    throw new ApiError(res.ok ? 400 : res.status, msg, data);
  }
  return data as T;
}
const safeJson = (t: string) => { try { return JSON.parse(t); } catch { return t; } };

export const http = {
  get: <T>(p: string, query?: Query, o?: Omit<RequestOpts, "query" | "body">) => request<T>("GET", p, { ...o, query }),
  post: <T>(p: string, body?: unknown, o?: Omit<RequestOpts, "body">) => request<T>("POST", p, { ...o, body: body ?? {} }),
  put: <T>(p: string, body?: unknown, o?: Omit<RequestOpts, "body">) => request<T>("PUT", p, { ...o, body: body ?? {} }),
  patch: <T>(p: string, body?: unknown, o?: Omit<RequestOpts, "body">) => request<T>("PATCH", p, { ...o, body: body ?? {} }),
  del: <T = void>(p: string, body?: unknown, o?: Omit<RequestOpts, "body">) => request<T>("DELETE", p, { ...o, body }),
};
