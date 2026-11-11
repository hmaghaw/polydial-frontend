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

type Query = Record<string, string | number | boolean | undefined | null>;
export async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Query } = {}): Promise<T> {
  const qs = new URLSearchParams();
  Object.entries(opts.query ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") qs.set(k, String(v)); });
  const url = path + (qs.toString() ? `?${qs}` : "");
  if (env.USE_MOCKS) return mockFetch<T>(method, url, opts.body, tokenStore.get());

  const res = await fetch(env.API_BASE_URL + url, {
    method,
    credentials: "include",
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("pd:unauthorized"));
    const msg = (data as { message?: string; error?: string } | null)?.message ?? (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}
const safeJson = (t: string) => { try { return JSON.parse(t); } catch { return t; } };

export const http = {
  get: <T>(p: string, query?: Query) => request<T>("GET", p, { query }),
  post: <T>(p: string, body?: unknown) => request<T>("POST", p, { body: body ?? {} }),
  put: <T>(p: string, body?: unknown) => request<T>("PUT", p, { body: body ?? {} }),
  patch: <T>(p: string, body?: unknown) => request<T>("PATCH", p, { body: body ?? {} }),
  del: <T = void>(p: string) => request<T>("DELETE", p),
};
