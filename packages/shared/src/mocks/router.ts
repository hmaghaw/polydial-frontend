// In-browser mock of the PolyDial REST API. Enabled when window.__ENV__.USE_MOCKS is true.
// State persists in localStorage ("pd_mock_db") so edits survive reloads; reset with resetMockDb().
import { ApiError } from "../api/client";
import type * as T from "../api/types";
import { seed, type MockDb } from "./seed";

const KEY = "pd_mock_db_v1";
let db: MockDb = load();
function load(): MockDb {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* ignore */ }
  return seed();
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } };
export function resetMockDb() { db = seed(); save(); }

type Ctx = { params: Record<string, string>; query: URLSearchParams; body: any; token: string | null };
type Handler = (c: Ctx) => unknown;
const routes: { method: string; re: RegExp; keys: string[]; h: Handler; open?: boolean }[] = [];
function on(method: string, pattern: string, h: Handler, open = false) {
  const keys: string[] = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$");
  routes.push({ method, re, keys, h, open });
}
const fail = (status: number, msg: string): never => { throw new ApiError(status, msg); };
const nextId = (rows: any[], key: string) => rows.reduce((m, r) => Math.max(m, Number(r[key]) || 0), 0) + 1;
const find = <R,>(rows: R[], key: keyof R, id: string | number) => rows.find((r) => String(r[key]) === String(id)) ?? fail(404, "Not found");

/** Generic CRUD over an array in the mock DB. */
function crud<K extends keyof MockDb>(base: string, coll: K, idKey: string, opts: { filter?: (r: any, q: URLSearchParams) => boolean; defaults?: object; onDelete?: (id: number) => void } = {}) {
  const rows = () => db[coll] as unknown as any[];
  on("GET", base, ({ query }) => rows().filter((r) => (opts.filter ? opts.filter(r, query) : true)));
  on("GET", `${base}/:id`, ({ params }) => find(rows(), idKey, params.id));
  on("POST", base, ({ body }) => { const r = { ...opts.defaults, ...body, [idKey]: nextId(rows(), idKey) }; rows().push(r); return r; });
  on("PUT", `${base}/:id`, ({ params, body }) => Object.assign(find(rows(), idKey, params.id), body, { [idKey]: find(rows(), idKey, params.id)[idKey] }));
  on("DELETE", `${base}/:id`, ({ params }) => {
    const i = rows().findIndex((r) => String(r[idKey]) === params.id); if (i < 0) fail(404, "Not found");
    rows().splice(i, 1); opts.onDelete?.(Number(params.id)); return null;
  });
}

const session = (): T.Session => ({ token: "mock-token", user: db.users[0], business: db.business });

// ---------- auth ----------
on("POST", "/auth/login", ({ body }) => {
  if (!body.email || !body.password) fail(400, "Enter your email and password.");
  if (String(body.password).length < 8) fail(401, "That email and password don't match an account.");
  return session();
}, true);
on("POST", "/auth/signup", () => ({ message: "Check your inbox to verify your email." }), true);
on("GET", "/auth/me", ({ token }) => (token ? { user: db.users[0], business: db.business } : fail(401, "Sign in to continue.")), true);
on("POST", "/auth/logout", () => null, true);
on("POST", "/auth/forgot-password", () => ({ message: "If that email has an account, a reset link is on its way." }), true);
on("POST", "/auth/reset-password", ({ body }) => (body.token ? { message: "Password updated." } : fail(400, "This reset link is missing its token.")), true);
on("POST", "/auth/verify-email", ({ body }) => (body.token ? { message: "Email verified." } : fail(400, "This verification link is invalid or expired.")), true);
on("POST", "/auth/resend-verification", () => ({ message: "Verification email sent." }), true);
on("POST", "/auth/oauth/:provider/callback", ({ body }) => (body.code ? session() : fail(400, "Sign-in was cancelled.")), true);
on("POST", "/auth/clover", ({ body }) => (body.token ? session() : fail(400, "This Clover link is missing its access token.")), true);

// ---------- business ----------
on("GET", "/business", () => db.business);
on("PUT", "/business", ({ body }) => Object.assign(db.business, body));

// ---------- services / customers / appointments ----------
crud("/services", "services", "service_id", { defaults: { translations: {}, buffer_before_minutes: 0, buffer_after_minutes: 0, is_active: true } });
on("PUT", "/services/:id/translations/:lang", ({ params, body }) => {
  const s = find(db.services, "service_id", params.id); s.translations = { ...s.translations, [params.lang]: body }; return s;
});
crud("/customers", "customers", "customer_id", {
  defaults: { is_active: true, created_at: new Date().toISOString(), language: "en" },
  filter: (r: T.Customer, q) => { const s = (q.get("search") ?? "").toLowerCase(); return !s || `${r.first_name} ${r.last_name} ${r.customer_phone} ${r.email}`.toLowerCase().includes(s); },
});
on("GET", "/customers/:id/calls", ({ params }) => db.calls.filter((c) => String(c.customer_id) === params.id));
crud("/appointments", "appointments", "appointment_id", {
  defaults: { status: "scheduled", booking_type: "appointment" },
  filter: (r: T.Appointment, q) => (!q.get("from") || r.end_time >= q.get("from")!) && (!q.get("to") || r.start_time <= q.get("to")!),
});

// ---------- calls ----------
on("GET", "/calls", ({ query }) => {
  const s = (query.get("search") ?? "").toLowerCase();
  return db.calls.filter((c) =>
    (!s || `${c.customer_name} ${c.customer_phone}`.toLowerCase().includes(s)) &&
    (!query.get("from") || c.call_start >= query.get("from")!) &&
    (!query.get("to") || c.call_start <= query.get("to")! + "T23:59:59") &&
    (!query.get("channel") || c.communication_channel === query.get("channel")) &&
    (!query.get("direction") || c.direction === query.get("direction")));
});
on("GET", "/calls/:sid/conversation", ({ params }) => db.conversations.filter((t) => t.call_sid === params.sid));

// ---------- billing ----------
on("GET", "/billing", () => { const { balance_cents, is_auto_recharge, recharge_threshold, recharge_amount } = db.business; return { balance_cents, is_auto_recharge, recharge_threshold, recharge_amount }; });
on("GET", "/billing/ledger", () => [...db.ledger].sort((a, b) => b.created_at.localeCompare(a.created_at)));
on("PUT", "/billing/auto-recharge", ({ body }) => Object.assign(db.business, body));
on("POST", "/billing/top-up", ({ body }) => {
  const amt = Number(body.amount_cents); if (!(amt >= 500)) fail(400, "The minimum top-up is $5.");
  db.business.balance_cents += amt;
  db.ledger.push({ ledger_id: nextId(db.ledger, "ledger_id"), amount_cents: amt, reason: "Top-up", comments: "Mock checkout", created_at: new Date().toISOString() });
  return { checkout_url: null, balance_cents: db.business.balance_cents };
});

// ---------- languages ----------
const withName = (l: T.BusinessLanguage) => ({ ...l, language_name: db.languages.find((x) => x.language_code === l.language_code)?.language_name });
on("GET", "/languages", () => db.languages);
on("GET", "/languages/:code/voices", ({ params }) => db.voices.filter((v) => v.language_code === params.code));
on("GET", "/business/languages", () => db.business_languages.map(withName));
on("POST", "/business/languages", ({ body }) => {
  if (db.business_languages.some((l) => l.language_code === body.language_code)) fail(409, "That language is already added.");
  const l = { language_code: body.language_code, is_default: db.business_languages.length === 0, language_voice_id: db.voices.find((v) => v.language_code === body.language_code)?.language_voice_id ?? null };
  db.business_languages.push(l); return withName(l);
});
on("PUT", "/business/languages/:code", ({ params, body }) => {
  const l = find(db.business_languages, "language_code", params.code);
  if (body.is_default) db.business_languages.forEach((x) => (x.is_default = false));
  return withName(Object.assign(l, body));
});
on("DELETE", "/business/languages/:code", ({ params }) => {
  const l = find(db.business_languages, "language_code", params.code);
  if (l.is_default) fail(400, "Choose another default language before removing this one.");
  db.business_languages = db.business_languages.filter((x) => x !== l); return null;
});

// ---------- phones ----------
on("GET", "/phones", () => db.phones);
on("PUT", "/phones/:id", ({ params, body }) => {
  if (body.is_primary) db.phones.forEach((p) => (p.is_primary = false));
  return Object.assign(find(db.phones, "business_phone_id", params.id), body);
});
on("DELETE", "/phones/:id", ({ params }) => { db.phones = db.phones.filter((p) => String(p.business_phone_id) !== params.id); return null; });
on("GET", "/phones/available", ({ query }) => {
  const area = query.get("area_code") || ["416", "647", "905", "437"][Math.floor(Math.random() * 4)];
  const contains = query.get("contains") ?? "";
  return Array.from({ length: 8 }, (_, i) => {
    const tail = (contains + String(1000 + ((i * 7919) % 9000))).slice(0, 4).padEnd(4, "0");
    const mid = String(200 + i * 37).slice(0, 3);
    return { phone_number: `+1${area}${mid}${tail}`, friendly_name: `(${area}) ${mid}-${tail}`, region: query.get("region") || "ON", locality: "Toronto", monthly_fee: 1 };
  });
});
const buyNumber = (phone: string, fee: number) => {
  if (db.business.balance_cents < fee) fail(402, "Your balance is too low for this number. Add funds and try again.");
  db.business.balance_cents -= fee;
  db.ledger.push({ ledger_id: nextId(db.ledger, "ledger_id"), amount_cents: -fee, reason: "Phone number purchase", comments: phone, created_at: new Date().toISOString() });
  const p: T.BusinessPhone = { business_phone_id: nextId(db.phones, "business_phone_id"), business_phone: phone, friendly_name: null, channel: "twilio", status: "active", language_code: "en", is_primary: db.phones.length === 0, forwarding_to: null };
  db.phones.push(p); return p;
};
on("POST", "/phones/purchase", ({ body }) => { if (body.enable_auto_recharge) db.business.is_auto_recharge = true; return buyNumber(body.phone_number, 100); });
on("GET", "/premium-numbers", () => db.premium);
on("POST", "/premium-numbers/:id/purchase", ({ params }) => {
  const n = find(db.premium, "_id", params.id); if (n.taken) fail(409, "This number was just reserved by someone else.");
  const p = buyNumber(n.phone_number, Math.round(n.price * 100)); n.taken = true; return p;
});

// ---------- hours / users / translations ----------
on("GET", "/business-hours", () => db.hours);
on("PUT", "/business-hours/:day", ({ params, body }) => Object.assign(find(db.hours, "day_of_week", params.day), body));
on("POST", "/users", ({ body }) => { const u = { active: true, email_verified: false, last_login: null, calls_handled: 0, satisfaction: 0, business_id: 1, ...body, id: `u_${Date.now()}` }; db.users.push(u); return u; });
crud("/users", "users", "id", { defaults: { active: true, email_verified: false, last_login: null, calls_handled: 0, satisfaction: 0, business_id: 1 } });
on("POST", "/translations", ({ body }) => { const r = { ...body, translation_id: nextId(db.translations, "translation_id"), updated_at: new Date().toISOString() }; db.translations.push(r); return r; });
crud("/translations", "translations", "translation_id", {
  filter: (r: T.Translation, q) => { const s = (q.get("search") ?? "").toLowerCase(); return (!s || `${r.phrase} ${r.translated_phrase}`.toLowerCase().includes(s)) && (!q.get("language") || r.language_code === q.get("language")); },
});

// ---------- analytics / reports / db ----------
const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); });
on("GET", "/analytics/overview", () => ({
  calls_today: 23, calls_week: 164, avg_duration: 142, resolution_rate: 0.86,
  volume: days.map((day, i) => { const calls = 14 + ((i * 7) % 11) + (i > 9 ? 6 : 0); return { day, calls, ai: Math.round(calls * 0.82) }; }),
}));
on("GET", "/analytics/voice", () => ({
  stt_accuracy: 0.947, latency_ms: 640,
  emotions: [{ name: "Calm", value: 46 }, { name: "Happy", value: 28 }, { name: "Frustrated", value: 14 }, { name: "Confused", value: 12 }],
  quality: [{ name: "Clarity", value: 92 }, { name: "Background noise", value: 18 }, { name: "Interruptions", value: 7 }],
  by_language: [{ language: "English", accuracy: 96 }, { language: "French", accuracy: 94 }, { language: "Arabic", accuracy: 91 }, { language: "Spanish", accuracy: 93 }],
}));
on("GET", "/analytics/insights", ({ query }) => {
  const k = query.get("range") === "quarter" ? 12 : query.get("range") === "month" ? 4 : 1;
  return {
    regions: [{ region: "Toronto", calls: 96 * k }, { region: "Mississauga", calls: 41 * k }, { region: "Brampton", calls: 22 * k }, { region: "Montréal", calls: 9 * k }, { region: "Other", calls: 6 * k }],
    heatmap: Array.from({ length: 7 }, (_, d) => Array.from({ length: 12 }, (_, h) => Math.max(0, Math.round((h >= 6 && h <= 9 ? 9 : h >= 1 && h <= 2 ? 6 : 2) + (d >= 4 ? 3 : 0) - ((h + d) % 3))))),
    leaderboard: db.users.filter((u) => u.active).map((u) => ({ name: `${u.first_name} ${u.last_name}`, calls: (u.calls_handled ?? 0) * k, resolution: 0.8 + (u.satisfaction ?? 0) / 50, csat: u.satisfaction ?? 0 })).concat([{ name: "PolyDial AI", calls: 412 * k, resolution: 0.88, csat: 4.6 }]).sort((a, b) => b.calls - a.calls),
  };
});
on("GET", "/analytics/sentiment", () => {
  const pos = db.calls.filter((c) => c.sentiment === "positive").length, neg = db.calls.filter((c) => c.sentiment === "negative").length;
  return {
    overall: Math.round(((pos - neg) / db.calls.length + 1) * 50), positive: pos, neutral: db.calls.length - pos - neg, negative: neg,
    trend: days.map((day, i) => ({ day, positive: 8 + (i % 4), neutral: 4 + (i % 3), negative: 1 + (i % 5 === 0 ? 3 : 1) })),
    alerts: db.calls.filter((c) => c.sentiment === "negative"),
    topics: [{ topic: "Delivery time", positive: 22, negative: 61, mentions: 41 }, { topic: "Food quality", positive: 88, negative: 6, mentions: 73 }, { topic: "Booking", positive: 79, negative: 9, mentions: 52 }, { topic: "Pricing", positive: 54, negative: 21, mentions: 19 }],
  };
});
on("GET", "/reports", () => db.reports);
on("POST", "/reports/generate", ({ body }) => { const r = { id: `r${Date.now()}`, name: `${body.template} — ${body.from} to ${body.to}`, type: body.template, created_at: new Date().toISOString(), size_kb: 60 + Math.round(Math.random() * 200) }; db.reports.unshift(r); return r; });
on("GET", "/reports/schedules", () => db.report_schedules);
on("POST", "/reports/schedules", ({ body }) => { const s = { ...body, id: `s${Date.now()}` }; db.report_schedules.push(s); return s; });
on("DELETE", "/reports/schedules/:id", ({ params }) => { db.report_schedules = db.report_schedules.filter((s) => s.id !== params.id); return null; });
const tableMap: Record<string, keyof MockDb> = { business: "business", users: "users", customer: "customers", service: "services", appointment: "appointments", call_meta: "calls", business_phone: "phones", business_ledger: "ledger", translations: "translations", restaurant_item: "items", restaurant_order: "orders" };
on("GET", "/admin/db/tables", () => Object.entries(tableMap).map(([name, k]) => ({ name, rows: Array.isArray(db[k]) ? (db[k] as unknown[]).length : 1 })));
on("GET", "/admin/db/tables/:name", ({ params, query }) => {
  const k = tableMap[params.name] ?? fail(404, "Unknown table");
  const all = (Array.isArray(db[k]) ? db[k] : [db[k]]) as Record<string, unknown>[];
  const page = Number(query.get("page") ?? 1), size = 20;
  const rows = all.slice((page - 1) * size, page * size).map((r) => Object.fromEntries(Object.entries(r).map(([c, v]) => [c, typeof v === "object" && v !== null ? JSON.stringify(v) : v])));
  return { columns: Object.keys(all[0] ?? {}), rows, total: all.length };
});
on("POST", "/support/contact", ({ body }) => (body.message ? { message: "Message sent. We reply within one business day." } : fail(400, "Write a message first.")));

// ---------- restaurant ----------
const R = "/restaurant";
crud(`${R}/menus`, "menus", "menu_id", { defaults: { availability_ids: [] }, onDelete: (id) => (db.sections = db.sections.filter((s) => s.menu_id !== id)) });
on("PUT", `${R}/menus/:id/availabilities`, ({ params, body }) => Object.assign(find(db.menus, "menu_id", params.id), { availability_ids: body.availability_ids }));
on("GET", `${R}/menus/:id/sections`, ({ params }) => db.sections.filter((s) => String(s.menu_id) === params.id).sort((a, b) => a.display_order - b.display_order));
on("POST", `${R}/menus/:id/sections`, ({ params, body }) => { const s = { item_ids: [], description: null, display_order: 1, ...body, menu_id: Number(params.id), menu_section_id: nextId(db.sections, "menu_section_id") }; db.sections.push(s); return s; });
on("PUT", `${R}/sections/:id`, ({ params, body }) => Object.assign(find(db.sections, "menu_section_id", params.id), body));
on("DELETE", `${R}/sections/:id`, ({ params }) => { db.sections = db.sections.filter((s) => String(s.menu_section_id) !== params.id); return null; });
crud(`${R}/availabilities`, "availabilities", "availability_id", {
  defaults: { details: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, is_closed: false, open_time: "09:00", close_time: "17:00" })) },
  onDelete: (id) => db.menus.forEach((m) => (m.availability_ids = m.availability_ids.filter((a) => a !== id))),
});
const stripItem = (key: "category_ids" | "option_group_ids" | "modifier_group_ids" | "tag_ids") => (id: number) => db.items.forEach((i) => (i[key] = i[key].filter((x) => x !== id)));
crud(`${R}/items`, "items", "item_id", {
  defaults: { category_ids: [], option_group_ids: [], modifier_group_ids: [], tag_ids: [], is_active: true, is_combo: false, image_url: null, calories: null },
  filter: (r: T.RestaurantItem, q) => { const s = (q.get("search") ?? "").toLowerCase(); return !s || `${r.name} ${r.description ?? ""}`.toLowerCase().includes(s); },
  onDelete: (id) => db.sections.forEach((s) => (s.item_ids = s.item_ids.filter((x) => x !== id))),
});
crud(`${R}/categories`, "categories", "item_category_id", { onDelete: stripItem("category_ids") });
crud(`${R}/option-groups`, "option_groups", "option_group_id", { defaults: { is_required: false, min_select: 0, max_select: 1, display_order: 0 }, onDelete: stripItem("option_group_ids") });
crud(`${R}/options`, "options", "option_id", { defaults: { is_default: false, display_order: 0, price_delta: 0 }, filter: (r: T.Option, q) => !q.get("option_group_id") || String(r.option_group_id) === q.get("option_group_id") });
crud(`${R}/modifier-groups`, "modifier_groups", "modifier_group_id", { defaults: { is_required: false, min_select: 0, max_select: 99 }, onDelete: stripItem("modifier_group_ids") });
crud(`${R}/modifiers`, "modifiers", "modifier_id", { defaults: { is_active: true, display_order: 0, price_delta: 0 }, filter: (r: T.Modifier, q) => !q.get("modifier_group_id") || String(r.modifier_group_id) === q.get("modifier_group_id") });
crud(`${R}/tags`, "tags", "tag_id", { onDelete: stripItem("tag_ids") });
crud(`${R}/combo-groups`, "combo_groups", "combo_group_id", { defaults: { min_select: 1, max_select: 1, display_order: 1 }, filter: (r: T.ComboGroup, q) => !q.get("item_id") || String(r.item_id) === q.get("item_id") });
crud(`${R}/combo-group-items`, "combo_group_items", "combo_group_item_id", { defaults: { price_delta: 0 }, filter: (r: T.ComboGroupItem, q) => !q.get("combo_group_id") || String(r.combo_group_id) === q.get("combo_group_id") });
const ACTIVE: T.OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"];
// Demo: every so often a new phone order "arrives" while the orders board is polling.
let lastArrival = Date.now();
function maybeArrive() {
  if (Date.now() - lastArrival < 40_000 || Math.random() > 0.35 || !db.items.length) return;
  lastArrival = Date.now();
  const c = db.customers[Math.floor(Math.random() * db.customers.length)];
  const it = db.items.filter((i) => i.is_active && !i.is_combo);
  const pick = it[Math.floor(Math.random() * it.length)];
  const qty = 1 + Math.floor(Math.random() * 2);
  db.orders.push({ order_id: nextId(db.orders, "order_id"), customer_id: c.customer_id, customer_name: `${c.first_name ?? "Caller"} ${c.last_name ?? ""}`.trim(), customer_phone: c.customer_phone,
    order_status: "pending", order_time: new Date().toISOString(), scheduled_time: null, total_price: +(pick.base_price * qty).toFixed(2), notes: "Placed by phone with the AI assistant",
    items: [{ order_item_id: Date.now(), item_id: pick.item_id, name: pick.name, quantity: qty, total_price: +(pick.base_price * qty).toFixed(2), options: [], modifiers: [] }] });
  save();
}
on("GET", `${R}/orders`, ({ query }) => (query.get("scope") !== "history" && maybeArrive(), db.orders.filter((o) => (query.get("scope") === "history" ? !ACTIVE.includes(o.order_status) : ACTIVE.includes(o.order_status))).sort((a, b) => b.order_time.localeCompare(a.order_time))));
on("PATCH", `${R}/orders/:id/status`, ({ params, body }) => Object.assign(find(db.orders, "order_id", params.id), { order_status: body.order_status }));
on("POST", `${R}/clover/sync`, () => ({ items: db.items.length, categories: db.categories.length, modifier_groups: db.modifier_groups.length, duration_ms: 2400 }));

// ---------- dispatcher ----------
export async function mockFetch<T>(method: string, url: string, body: unknown, token: string | null): Promise<T> {
  await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));
  const [path, qs] = url.split("?");
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re); if (!m) continue;
    if (!r.open && !token) throw new ApiError(401, "Sign in to continue.");
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const out = r.h({ params, query: new URLSearchParams(qs), body, token });
    if (method !== "GET") save();
    return JSON.parse(JSON.stringify(out ?? null)) as T;
  }
  throw new ApiError(404, `No mock for ${method} ${path}`);
}
