// API surface wired to the PolyDial Flask backend (hmaghaw/appointment_system, appointment_app/routes).
// Every export has the same shape as endpoints.mock.ts, so pages don't change. Each function maps to
// the real route, injects business_id from the session JWT, and normalizes the response to types.ts.
// Features the backend has no route for reject with a clear "not available" ApiError (status 501).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiError, decodeToken, http } from "./client";
import type * as T from "./types";
import type * as M from "./endpoints.mock";

type Q = Record<string, string | number | boolean | undefined>;
type Row = Record<string, any>;

// ---------- helpers ----------
const SESSION_USER_KEY = "pd_user";
const saveUser = (u: T.User | null) => { try { u ? localStorage.setItem(SESSION_USER_KEY, JSON.stringify(u)) : localStorage.removeItem(SESSION_USER_KEY); } catch { /* ignore */ } };
const loadUser = (): T.User | null => { try { return JSON.parse(localStorage.getItem(SESSION_USER_KEY) ?? "null"); } catch { return null; } };

function businessId(): number {
  const id = decodeToken()?.business_id;
  if (id === undefined || id === null) throw new ApiError(401, "Your session has no business. Sign in again.");
  return Number(id);
}
const unsupported = (what: string): Promise<never> =>
  Promise.reject(new ApiError(501, `${what} isn't available on the PolyDial API yet.`));
const post = <R = any>(p: string, body: Row = {}, token?: string | null) => http.post<R>(p, body, token !== undefined ? { token } : undefined);
const bpost = <R = any>(p: string, body: Row = {}) => post<R>(p, { business_id: businessId(), ...body });

/** Finds the array in the backend's varying envelopes: [..], {data:[..]}, {key:[..]}, {data:{key:[..]}}. */
function listOf(res: any, ...keys: string[]): Row[] {
  if (Array.isArray(res)) return res;
  for (const src of [res, res?.data]) {
    if (Array.isArray(src)) return src;
    if (src && typeof src === "object") for (const k of keys) if (Array.isArray(src[k])) return src[k];
  }
  return [];
}
/** Finds the object in {data:{key:{..}}}, {data:{..}}, {key:{..}} or {..}. */
function oneOf(res: any, ...keys: string[]): Row {
  const base = res?.data && typeof res.data === "object" && !Array.isArray(res.data) ? res.data : res;
  for (const k of keys) if (base?.[k] && typeof base[k] === "object" && !Array.isArray(base[k])) return base[k];
  return base ?? {};
}
const num = (v: any, d = 0) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v: any) => v === true || v === 1 || v === "1" || v === "true";
const ids = (arr: any, ...keys: string[]): T.ID[] =>
  Array.isArray(arr) ? arr.map((x) => (typeof x === "object" ? num(keys.map((k) => x?.[k]).find((v) => v !== undefined)) : num(x))).filter(Boolean) : [];
const pick = (o: Row, keys: string[]) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Flask serializes naive datetimes as "Tue, 01 Jul 2025 10:00:00 GMT"; they are business-local, so drop the zone. */
const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
function naive(v: any): string {
  if (!v) return v;
  const s = String(v);
  const m = s.match(/^\w{3}, (\d{2}) (\w{3}) (\d{4}) (\d{2}:\d{2}:\d{2}) GMT$/);
  if (m) return `${m[3]}-${MONTHS[m[2]]}-${m[1]}T${m[4]}`;
  return s.replace(" ", "T");
}
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localIso = (d: Date) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const hhmm = (v: any) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${pad(Number(m[1]))}:${m[2]}` : String(v);
};
// The API numbers days 0=Monday…6=Sunday (and business-hours/get returns day names); the UI uses 0=Sunday.
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dayFromApi = (v: any): number => {
  const byName = DAY_NAMES.indexOf(String(v).toLowerCase());
  return byName >= 0 ? byName : (num(v) + 1) % 7;
};
const dayToApi = (d: number) => (d + 6) % 7;
const digits = (p: string) => p.replace(/\D/g, "");

/** Applies set differences through add/remove endpoints (the API has no "replace" for join tables). */
async function syncSet(current: T.ID[], next: T.ID[] | undefined, add: (id: T.ID) => Promise<unknown>, remove: (id: T.ID) => Promise<unknown>) {
  if (!next) return;
  const cur = new Set(current.map(Number)); const nxt = new Set(next.map(Number));
  for (const id of nxt) if (!cur.has(id)) await add(id);
  for (const id of cur) if (!nxt.has(id)) await remove(id);
}

// ---------- mappers ----------
function toUser(a: Row, claims = decodeToken()): T.User {
  return {
    id: String(a.id ?? claims?.user_id ?? ""), email: a.email ?? claims?.email ?? "",
    first_name: a.first_name ?? "", last_name: a.last_name ?? "",
    role: ((a.role ?? claims?.role ?? "admin") as T.Role), business_id: num(claims?.business_id ?? a.business_id),
    active: a.active === undefined ? true : bool(a.active), phone: a.phone ?? null,
    email_verified: a.email_verified === undefined ? true : bool(a.email_verified), last_login: a.last_login ?? null,
  };
}
function toBusiness(b: Row): T.Business {
  return {
    business_id: num(b.business_id ?? b.id), name: b.name ?? "", business_type: b.business_type ?? "general",
    timezone: b.timezone ?? "", status: b.status ?? "active", balance_cents: num(b.balance_cents),
    is_auto_recharge: bool(b.is_auto_recharge), recharge_threshold: num(b.recharge_threshold), recharge_amount: num(b.recharge_amount),
    address: b.address ?? null, branch_phone_number: b.branch_phone_number ?? null,
  };
}
const toCustomer = (c: Row): T.Customer => ({
  customer_id: num(c.customer_id), customer_phone: c.customer_phone ?? "", first_name: c.first_name ?? null, last_name: c.last_name ?? null,
  email: c.email ?? null, language: c.language ?? "en", notes: c.notes ?? null, is_active: c.is_active === undefined ? true : bool(c.is_active),
  created_at: naive(c.created_at) ?? "",
});
const toCall = (c: Row): T.CallMeta => ({
  call_sid: c.call_sid, customer_id: c.customer_id ?? null, customer_name: (c.customer_name ?? "").trim() || undefined,
  customer_phone: c.customer_phone ?? undefined, call_start: naive(c.call_start), call_end: c.call_end ? naive(c.call_end) : null,
  call_duration: num(c.call_duration), call_status: c.call_status ?? "", communication_channel: c.communication_channel ?? "phone",
  direction: c.direction ?? "inbound", sentiment: c.sentiment, summary: c.summary, language: c.language,
});
const toAppointment = (a: Row): T.Appointment => ({
  appointment_id: num(a.appointment_id), customer_id: a.customer_id ?? null, service_id: a.service_id ?? null,
  start_time: naive(a.start_time), end_time: naive(a.end_time), booking_type: a.booking_type ?? "appointment",
  status: a.status ?? "scheduled", notes: a.notes ?? null,
});
const toPhone = (p: Row): T.BusinessPhone => ({
  business_phone_id: num(p.business_phone_id), business_phone: p.business_phone ?? p.phone_number ?? "",
  friendly_name: p.friendly_name ?? null, channel: p.channel ?? "twilio", status: p.status ?? "active",
  language_code: p.language_code ?? null, is_primary: bool(p.is_primary), forwarding_to: p.forwarding_to ?? null,
});
const toHours = (h: Row): T.BusinessHours => ({ day_of_week: dayFromApi(h.day_of_week), open_time: hhmm(h.open_time), close_time: hhmm(h.close_time), is_closed: bool(h.is_closed) });

// ---------- auth ----------
async function sessionFrom(res: Row): Promise<T.Session> {
  const token = res.access_token as string;
  const claims = decodeToken(token);
  let business: Row = res.business ?? {};
  try { business = await post("/api/business/get", { business_id: claims?.business_id }, token); } catch { /* fall back to the login payload */ }
  const user = toUser(res.admin ?? {}, claims);
  saveUser(user);
  return { token, user, business: toBusiness(business) };
}

export const authApi: typeof M.authApi = {
  login: async (email, password) => sessionFrom(await post("/api/auth/login", { email, password }, null)),
  signup: async (b) => {
    const r = await post("/api/auth/signup", { businessName: b.business_name, adminFirstName: b.first_name, adminLastName: b.last_name, email: b.email, password: b.password, adminPhone: b.phone }, null);
    return { message: r.message ?? "Check your email to verify your account." };
  },
  // No /me route: rebuild the session from the stored user + JWT claims + a fresh business row.
  me: async () => {
    const claims = decodeToken();
    if (!claims || (claims.exp && claims.exp * 1000 < Date.now())) throw new ApiError(401, "Session expired");
    const business = toBusiness(await post("/api/business/get", { business_id: claims.business_id }));
    const stored = loadUser();
    const user = stored && stored.business_id === num(claims.business_id) ? stored : toUser({}, claims);
    return { user, business };
  },
  logout: async () => { saveUser(null); },
  forgotPassword: async (email) => ({ message: (await post("/api/auth/request-password-reset", { email }, null)).message }),
  // The reset and verify links carry a JWT that the API expects as the bearer token.
  resetPassword: async (token, password) => ({ message: (await post("/api/auth/reset-password", { password }, token)).message }),
  verifyEmail: async (token) => ({ message: (await http.get<Row>("/api/auth/verify-email", undefined, { token })).message ?? "Email verified" }),
  resendVerification: async (email) => ({ message: (await post("/api/auth/resend_verify_email", { email }, null)).message }),
  oauthCallback: (provider) => unsupported(`Sign-in with ${provider}`),
  cloverLogin: async (token) => sessionFrom(await post("/api/clover/login", { token }, null)),
};

// ---------- business ----------
export const businessApi: typeof M.businessApi = {
  get: async () => toBusiness(await bpost("/api/business/get")),
  // PUT /api/business only accepts is_auto_recharge, recharge_threshold, recharge_amount, elevenlabs_agent_id.
  update: async (b) => toBusiness(await http.put<Row>("/api/business", { business_id: businessId(), ...b })),
};

// ---------- services ----------
async function businessLanguages(): Promise<T.BusinessLanguage[]> {
  const r = await bpost("/api/business/list_languages");
  return listOf(r, "languages").map((l) => ({ language_code: l.language_code, language_name: l.language_name, is_default: bool(l.is_default), language_voice_id: l.language_voice_id ?? null }));
}
const defaultLang = (ls: T.BusinessLanguage[]) => ls.find((l) => l.is_default)?.language_code ?? ls[0]?.language_code ?? "en";
const listServicesIn = async (language: string) => listOf(await bpost("/api/services/list", { language, all: true }), "services");
const toService = (s: Row): T.Service => ({
  service_id: num(s.service_id), name: s.name ?? "", description: s.description ?? null, duration_minutes: num(s.duration_minutes),
  price: num(s.price), is_active: bool(s.is_active), buffer_before_minutes: num(s.buffer_before_minutes), buffer_after_minutes: num(s.buffer_after_minutes),
});

async function listServices(): Promise<T.Service[]> {
  const langs = await businessLanguages().catch(() => [] as T.BusinessLanguage[]);
  const def = defaultLang(langs);
  const [base, ...others] = await Promise.all([listServicesIn(def), ...langs.filter((l) => l.language_code !== def).map((l) => listServicesIn(l.language_code).catch(() => []))]);
  const others_ = langs.filter((l) => l.language_code !== def);
  return base.map((row) => {
    const s = toService(row);
    s.translations = {};
    others_.forEach((l, i) => {
      const t = others[i].find((x) => num(x.service_id) === s.service_id);
      if (t && t.translation_id) s.translations![l.language_code] = { name: t.name, description: t.description ?? null };
    });
    return s;
  });
}
async function findService(id: T.ID | string): Promise<T.Service> {
  const s = (await listServices()).find((x) => x.service_id === Number(id));
  if (!s) throw new ApiError(404, "Service not found");
  return s;
}
export const servicesApi: typeof M.servicesApi = {
  list: () => listServices(),
  get: (id) => findService(id),
  create: async (b) => {
    const language = defaultLang(await businessLanguages().catch(() => []));
    const r = await bpost("/api/services/create", { language, description: "", ...pick(b as Row, ["name", "description", "duration_minutes", "price", "buffer_before_minutes", "buffer_after_minutes", "is_active"]) });
    return toService(oneOf(r, "service"));
  },
  // PUT /api/services updates duration_minutes, price, buffer_before_minutes, is_active only.
  update: async (id, b) => { await http.put("/api/services", { service_id: Number(id), ...b }); return findService(id); },
  remove: async (id) => { await http.del("/api/services", { service_id: Number(id) }); },
  translate: async (id, lang, b) => {
    const row = (await listServicesIn(lang)).find((x) => num(x.service_id) === Number(id));
    if (!row?.translation_id) throw new ApiError(404, `No ${lang.toUpperCase()} translation exists for this service yet.`);
    await http.put("/api/services/translation", { translation_id: row.translation_id, ...b });
    return findService(id);
  },
};

// ---------- customers ----------
const listCustomers = async () => listOf(await bpost("/api/customers/list"), "customers").map(toCustomer);
const listCalls = async (q: Row) => listOf(await bpost("/api/call-meta/list", q), "calls").map(toCall);
export const customersApi: typeof M.customersApi = {
  list: () => listCustomers(),
  get: async (id) => toCustomer(oneOf(await post("/api/customers/info", { customer_id: Number(id) }), "customer")),
  create: async (b) => toCustomer(await bpost("/api/customers", b)),
  update: async (id, b) => toCustomer(oneOf(await http.put<Row>("/api/customers", { ...b, customer_id: Number(id) }), "customer")),
  remove: async (id) => { await http.del("/api/customers", { customer_id: Number(id) }); },
  calls: (id) => listCalls({ customer_id: id }),
};

// ---------- appointments ----------
const lastDay = (to: string) => ymd(new Date(new Date(to).getTime() - 1));
export const appointmentsApi: typeof M.appointmentsApi = {
  list: async (q) => {
    const r = await bpost("/api/appointments/business", { start_date: q?.from ? ymd(new Date(String(q.from))) : undefined, end_date: q?.to ? lastDay(String(q.to)) : undefined });
    return listOf(r, "appointments").map(toAppointment);
  },
  get: () => unsupported("Loading a single appointment"),
  create: async (b) => {
    const start = new Date(String(b.start_time)); const end = new Date(String(b.end_time ?? b.start_time));
    let r: any;
    if (b.booking_type === "appointment" || !b.booking_type) {
      r = await bpost("/api/appointments", { customer_id: b.customer_id, service_id: b.service_id, start_time: localIso(start), notes: b.notes });
    } else if (b.booking_type === "anonymous") {
      r = await bpost("/api/appointments/create_from_ui", { customer_option: "skip_customer", service_id: b.service_id, start_time: localIso(start), end_time: localIso(end), notes: b.notes });
    } else {
      // block / break / holiday are "closed time" (service_id 0); holiday blocks whole days.
      r = await bpost("/api/appointments/create_from_ui", { service_id: 0, full_day: b.booking_type === "holiday" ? 1 : 0, start_time: localIso(start), end_time: localIso(end), notes: b.notes });
    }
    const row = Array.isArray(r) ? r[0] : oneOf(r, "appointment");
    return toAppointment({ ...b, ...row });
  },
  // PUT /api/appointments only reschedules (date + time); other field changes are not saved by the API.
  update: async (id, b) => {
    const start = new Date(String(b.start_time));
    await http.put("/api/appointments", { appointment_id: Number(id), date: ymd(start), time: `${pad(start.getHours())}:${pad(start.getMinutes())}` });
    return toAppointment({ ...b, start_time: localIso(start), appointment_id: id });
  },
  remove: async (id) => { await http.del("/api/appointments", { appointment_id: Number(id) }); },
};

// ---------- calls ----------
export const callsApi: typeof M.callsApi = {
  list: (q) => listCalls({
    customer_name: q.search || undefined, communication_channel: q.channel || undefined, direction: q.direction || undefined,
    start_date_from: q.from ? ymd(new Date(q.from)) : undefined, start_date_to: q.to ? ymd(new Date(q.to)) : undefined,
  }),
  conversation: async (sid) => listOf(await post("/api/call-meta/conversation", { call_sid: sid }), "conversation").map((t) => ({
    call_conversation_id: num(t.call_conversation_id), call_sid: t.call_sid ?? sid, role: t.role, content: t.content ?? null, created_at: naive(t.created_at),
  })),
};

// ---------- billing ----------
export const billingApi: typeof M.billingApi = {
  summary: async () => {
    const b = await businessApi.get();
    return { balance_cents: b.balance_cents, is_auto_recharge: b.is_auto_recharge, recharge_threshold: b.recharge_threshold, recharge_amount: b.recharge_amount };
  },
  ledger: async () => listOf(await bpost("/api/stripe/transaction_history"), "transactions").map((t, i) => ({
    ledger_id: i + 1, amount_cents: t.amount_cents !== undefined ? num(t.amount_cents) : num(t.amount_dollars) * 100,
    reason: t.reason ?? null, comments: null, created_at: naive(t.created_at),
  })),
  updateAutoRecharge: (b) => http.put("/api/business", { business_id: businessId(), ...b }),
  // POST /api/stripe/topup credits the balance directly (whole dollars); it does not collect a payment.
  topUp: async (amount_cents) => {
    const r = await bpost("/api/stripe/topup", { amount: Math.round(amount_cents / 100), request_id: uuid() });
    return { checkout_url: null, balance_cents: num(r.balance_cents) };
  },
};

// ---------- languages ----------
export const languagesApi: typeof M.languagesApi = {
  catalog: async () => listOf(await http.get("/api/list_supported_languages"), "languages").map((l) => ({ language_code: l.language_code, language_name: l.language_name, supported: true })),
  voices: async (code) => {
    try {
      return listOf(await post("/api/language/voices", { language_code: code }), "voices").map((v) => ({
        language_voice_id: num(v.language_voice_id), language_code: v.language_code, region_code: v.region_code ?? "", voice_provider: v.voice_provider ?? "", voice_name: v.voice_name ?? "",
      }));
    } catch (e) { if (e instanceof ApiError && e.status === 404) return []; throw e; }
  },
  business: () => businessLanguages(),
  add: async (language_code) => { await bpost("/api/business/language", { language_code }); return { language_code, is_default: false, language_voice_id: null }; },
  update: async (code, b) => { await bpost("/api/business/update_language", { language_code: code, ...b }); return { language_code: code, is_default: !!b.is_default, language_voice_id: b.language_voice_id ?? null }; },
  remove: async (code) => { await http.del("/api/business/language", { business_id: businessId(), language_code: code }); },
};

// ---------- phones ----------
const listPhones = async () => listOf(await bpost("/api/business/phones"), "phones").map(toPhone);
async function phoneSid(phone: string): Promise<string> {
  const r = await http.get<Row>("/api/twilio/purchased-numbers", { contains: digits(phone).slice(-7) });
  const n = listOf(r, "numbers").find((x) => digits(String(x.phone_number)) === digits(phone));
  if (!n?.sid) throw new ApiError(404, `Couldn't find ${phone} in the Twilio account.`);
  return n.sid;
}
export const phonesApi: typeof M.phonesApi = {
  list: () => listPhones(),
  update: async (id, b) => {
    const cur = (await listPhones()).find((p) => p.business_phone_id === id);
    if (!cur) throw new ApiError(404, "Phone number not found");
    if (b.language_code && b.language_code !== cur.language_code) await http.put("/api/business/phone/language", { business_phone_id: id, language_code: b.language_code });
    if (b.friendly_name !== undefined && (b.friendly_name || null) !== cur.friendly_name && b.friendly_name)
      await post("/api/twilio/update-friendly-name", { phone_sid: await phoneSid(cur.business_phone), friendly_name: b.friendly_name });
    const blocked = [
      b.is_primary !== undefined && !!b.is_primary !== cur.is_primary && "primary number",
      b.forwarding_to !== undefined && (b.forwarding_to || null) !== (cur.forwarding_to ?? null) && "call forwarding",
    ].filter(Boolean);
    if (blocked.length) throw new ApiError(501, `Other changes saved, but ${blocked.join(" and ")} can't be changed on the PolyDial API yet.`);
    return { ...cur, ...b };
  },
  remove: async (id) => {
    const cur = (await listPhones()).find((p) => p.business_phone_id === id);
    if (!cur) throw new ApiError(404, "Phone number not found");
    await http.del("/api/twilio/delete-phone", { business_id: businessId(), phone_sid: await phoneSid(cur.business_phone) });
  },
  search: async (q) => listOf(await post("/api/twilio/available-numbers", { region: q.region || undefined, area_code: q.area_code || undefined, contains: q.contains || undefined }), "numbers").map((n) => ({
    phone_number: n.phone_number, friendly_name: n.friendly_name ?? n.phone_number, region: n.region ?? "", locality: n.locality ?? "", monthly_fee: num(n.price ?? n.monthly_fee),
  })),
  purchase: async (b) => {
    const r = await bpost("/api/twilio/purchase-and-configure", { phone_number: b.phone_number, friendly_name: b.phone_number });
    return toPhone(oneOf(r));
  },
};
export const premiumApi: typeof M.premiumApi = {
  list: async () => listOf(await http.get("/api/premium-numbers")).map((n) => ({ _id: num(n._id), phone_number: n.phone_number, price: num(n.price), taken: bool(n.taken) })),
  purchase: async (id) => {
    const n = (await premiumApi.list()).find((x) => x._id === id);
    if (!n) throw new ApiError(404, "That premium number is no longer available.");
    const r = await bpost("/api/premium-numbers/reserve", { phone_number: n.phone_number });
    return toPhone({ business_phone: n.phone_number, ...oneOf(r) });
  },
};

// ---------- hours ----------
const listHours = async () => listOf(await bpost("/api/business-hours/get"));
export const hoursApi: typeof M.hoursApi = {
  list: async () => (await listHours()).map(toHours),
  update: async (day, b) => {
    const row = (await listHours()).find((h) => dayFromApi(h.day_of_week) === day);
    if (!row?.business_hours_id) throw new ApiError(404, "No business hours row for that day.");
    const r = await bpost("/api/business-hours/update", { business_hours_id: row.business_hours_id, is_closed: b.is_closed, open_time: b.open_time, close_time: b.close_time });
    return { ...toHours({ ...b, ...oneOf(r) }), day_of_week: day };
  },
};

// ---------- team / translations ----------
export const usersApi: typeof M.usersApi = {
  list: () => unsupported("Team management"), get: () => unsupported("Team management"), create: () => unsupported("Inviting team members"),
  update: () => unsupported("Editing team members"), remove: () => unsupported("Removing team members"),
};
// GET /api/translations/all returns { phrase: { lang: text } } with no ids; ids here are positional.
async function listTranslations(): Promise<T.Translation[]> {
  const all = (await http.get<Record<string, Record<string, string>>>("/api/translations/all")) ?? {};
  let i = 0; const out: T.Translation[] = [];
  for (const [phrase, langs] of Object.entries(all)) for (const [language_code, translated_phrase] of Object.entries(langs ?? {})) out.push({ translation_id: ++i, phrase, language_code, translated_phrase, updated_at: "" });
  return out;
}
export const translationsApi: typeof M.translationsApi = {
  list: async (q) => {
    const s = String(q?.search ?? "").toLowerCase(); const lang = q?.language ? String(q.language) : "";
    return (await listTranslations()).filter((t) => (!lang || t.language_code === lang) && (!s || t.phrase.toLowerCase().includes(s) || t.translated_phrase.toLowerCase().includes(s)));
  },
  get: async (id) => { const t = (await listTranslations()).find((x) => x.translation_id === Number(id)); if (!t) throw new ApiError(404, "Translation not found"); return t; },
  // The API machine-translates the phrase itself; a typed translated_phrase is not stored.
  create: async (b) => {
    const r = await post("/api/translations", { phrase: b.phrase, language: b.language_code });
    return { translation_id: 0, phrase: r.phrase ?? b.phrase ?? "", language_code: r.language ?? b.language_code ?? "", translated_phrase: r.translated_phrase ?? "", updated_at: "" };
  },
  update: () => unsupported("Editing translations"),
  remove: () => unsupported("Deleting translations"),
};

// ---------- analytics / reports / admin ----------
export const analyticsApi: typeof M.analyticsApi = {
  // Built from /api/business/dashboard-metrics + the last 14 days of /api/call-meta/list.
  overview: async () => {
    const now = new Date(); const from = new Date(now); from.setDate(from.getDate() - 13);
    const [m, calls] = await Promise.all([bpost("/api/business/dashboard-metrics").catch(() => ({} as Row)), listCalls({ start_date_from: ymd(from) })]);
    const byDay = new Map<string, number>();
    for (let d = new Date(from); d <= now; d.setDate(d.getDate() + 1)) byDay.set(ymd(d), 0);
    calls.forEach((c) => { const k = String(c.call_start ?? "").slice(0, 10); if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1); });
    const done = calls.filter((c) => /complete/i.test(c.call_status)).length;
    return {
      calls_today: byDay.get(ymd(now)) ?? 0,
      calls_week: m.calls_this_week !== undefined ? num(m.calls_this_week) : [...byDay.values()].slice(-7).reduce((a, b) => a + b, 0),
      avg_duration: m.average_call_duration !== undefined ? Math.round(num(m.average_call_duration)) : (calls.length ? Math.round(calls.reduce((a, c) => a + c.call_duration, 0) / calls.length) : 0),
      resolution_rate: calls.length ? Math.round((done / calls.length) * 100) : 0,
      volume: [...byDay.entries()].map(([day, n]) => ({ day, calls: n, ai: n })),
    };
  },
  voice: () => unsupported("Voice analytics"),
  insights: () => unsupported("Call insights"),
  sentiment: () => unsupported("Sentiment analysis"),
};
export const reportsApi: typeof M.reportsApi = {
  list: () => unsupported("Reports"), generate: () => unsupported("Report generation"), schedules: () => unsupported("Report schedules"),
  createSchedule: () => unsupported("Report schedules"), removeSchedule: () => unsupported("Report schedules"),
};
export const dbApi: typeof M.dbApi = { tables: () => unsupported("The database browser"), rows: () => unsupported("The database browser") };
export const supportApi: typeof M.supportApi = { contact: () => unsupported("The contact form") };

// ---------- restaurant ----------
const R = "/api/restaurants";
const toMenu = (m: Row): T.Menu => ({ menu_id: num(m.menu_id), name: m.name ?? m.menu_name ?? "", description: m.description ?? null, is_active: m.is_active === undefined ? true : bool(m.is_active), availability_ids: [...new Set(ids(m.availability, "availability_id"))] });
const listMenus = async () => listOf(await bpost(`${R}/list_menus`), "menus").map(toMenu);
const findMenu = async (id: T.ID | string) => { const m = (await listMenus()).find((x) => x.menu_id === Number(id)); if (!m) throw new ApiError(404, "Menu not found"); return m; };
async function setMenuAvailabilities(menu_id: T.ID, next: T.ID[]) {
  const cur = ids(listOf(await post(`${R}/list_menu_availability`, { menu_id }), "availabilities", "availability"), "availability_id");
  await syncSet(cur, next, (a) => post(`${R}/assign_availability_to_menu`, { menu_id, availability_id: a }), (a) => post(`${R}/delete_availability_from_menu`, { menu_id, availability_id: a }));
}
export const menusApi: typeof M.menusApi = {
  list: () => listMenus(),
  get: (id) => findMenu(id),
  create: async (b) => {
    const m = toMenu(oneOf(await bpost(`${R}/create_menu`, { is_active: true, ...pick(b as Row, ["name", "description", "is_active"]) }), "menu"));
    if (b.availability_ids?.length) await setMenuAvailabilities(m.menu_id, b.availability_ids);
    return findMenu(m.menu_id).catch(() => m);
  },
  update: async (id, b) => {
    const fields = pick(b as Row, ["name", "description", "is_active"]);
    if (Object.keys(fields).length) await post(`${R}/update_menu`, { menu_id: Number(id), ...fields });
    if (b.availability_ids) await setMenuAvailabilities(Number(id), b.availability_ids);
    return findMenu(id);
  },
  remove: async (id) => { await post(`${R}/delete_menu`, { menu_id: Number(id) }); },
  setAvailabilities: async (id, availability_ids) => { await setMenuAvailabilities(id, availability_ids); return findMenu(id); },
};

const sectionItemIds = async (menu_section_id: T.ID) => ids(listOf(await post(`${R}/list_items_in_menu_section`, { menu_section_id }), "items"), "item_id");
const toSection = (s: Row, menu_id: T.ID, item_ids: T.ID[]): T.MenuSection => ({ menu_section_id: num(s.menu_section_id), menu_id: num(s.menu_id ?? menu_id), name: s.name ?? s.section_name ?? "", description: s.description ?? null, display_order: num(s.display_order), item_ids });
async function syncSectionItems(menu_section_id: T.ID, next?: T.ID[]) {
  if (!next) return;
  await syncSet(await sectionItemIds(menu_section_id), next, (item_id) => post(`${R}/add_item_to_menu_section`, { menu_section_id, item_id }), (item_id) => post(`${R}/delete_item_from_menu_section`, { menu_section_id, item_id }));
}
export const sectionsApi: typeof M.sectionsApi = {
  list: async (menu_id) => {
    const rows = listOf(await post(`${R}/list_menu_sections`, { menu_id }), "sections");
    return Promise.all(rows.map(async (s) => toSection(s, menu_id, await sectionItemIds(num(s.menu_section_id)).catch(() => []))));
  },
  create: async (menu_id, b) => {
    const s = oneOf(await post(`${R}/create_menu_section`, { menu_id, description: "", display_order: 0, ...pick(b as Row, ["name", "description", "display_order"]) }), "section", "menu_section");
    const id = num(s.menu_section_id);
    await syncSectionItems(id, b.item_ids);
    return toSection(s, menu_id, b.item_ids ?? []);
  },
  update: async (id, b) => {
    const fields = pick(b as Row, ["name", "description", "display_order"]);
    const r = Object.keys(fields).length ? oneOf(await post(`${R}/update_menu_section`, { menu_section_id: id, ...fields }), "section", "menu_section") : {};
    await syncSectionItems(id, b.item_ids);
    return toSection({ ...b, ...r, menu_section_id: id }, num(b.menu_id), b.item_ids ?? await sectionItemIds(id));
  },
  remove: async (id) => { await post(`${R}/delete_menu_section`, { menu_section_id: id }); },
};

const availabilityDetails = async (availability_id: T.ID) => listOf(await post(`${R}/list_availability_details`, { availability_id }), "details");
async function findAvailability(id: T.ID | string): Promise<T.Availability> {
  const row = listOf(await bpost(`${R}/list_availabilities`), "availabilities").find((a) => num(a.availability_id) === Number(id));
  if (!row) throw new ApiError(404, "Availability not found");
  return { availability_id: num(row.availability_id), name: row.name ?? "", details: (await availabilityDetails(num(row.availability_id))).map(toHours) };
}
async function saveAvailabilityDetails(availability_id: T.ID, next?: T.BusinessHours[]) {
  if (!next) return;
  const cur = await availabilityDetails(availability_id);
  for (const d of next) {
    const row = cur.find((c) => dayFromApi(c.day_of_week) === d.day_of_week);
    if (!row) continue;
    const c = toHours(row);
    if (c.is_closed === d.is_closed && c.open_time === hhmm(d.open_time) && c.close_time === hhmm(d.close_time)) continue;
    await post(`${R}/update_availability_detail`, { availability_detail_id: row.availability_detail_id ?? row.detail_id, day_of_week: dayToApi(d.day_of_week), is_closed: d.is_closed, open_time: d.open_time, close_time: d.close_time });
  }
}
export const availabilityApi: typeof M.availabilityApi = {
  list: async () => {
    const rows = listOf(await bpost(`${R}/list_availabilities`), "availabilities");
    return Promise.all(rows.map(async (a) => ({ availability_id: num(a.availability_id), name: a.name ?? "", details: (await availabilityDetails(num(a.availability_id)).catch(() => [])).map(toHours) })));
  },
  get: (id) => findAvailability(id),
  // create_availability seeds one detail row per day from business hours; we then apply the requested times.
  create: async (b) => {
    const id = num(oneOf(await bpost(`${R}/create_availability`, { name: b.name ?? "" }), "availability").availability_id);
    await saveAvailabilityDetails(id, b.details);
    return findAvailability(id);
  },
  update: async (id, b) => {
    if (b.name !== undefined) await post(`${R}/update_availability`, { availability_id: Number(id), name: b.name });
    await saveAvailabilityDetails(Number(id), b.details);
    return findAvailability(id);
  },
  remove: async (id) => { await post(`${R}/delete_availability`, { availability_id: Number(id) }); },
};

// Items: list_items has calories/is_combo, list_items_detailed has the relations; merge both.
const ITEM_FIELDS = ["name", "description", "base_price", "calories", "preparation_time", "is_combo", "is_active", "image_url"];
function toItem(i: Row): T.RestaurantItem {
  return {
    item_id: num(i.item_id), name: i.name ?? "", description: i.description ?? null, base_price: num(i.base_price ?? i.price),
    calories: i.calories ?? null, preparation_time: i.preparation_time ?? null, is_combo: bool(i.is_combo), is_active: i.is_active === undefined ? true : bool(i.is_active),
    image_url: i.image_url ?? null,
    category_ids: i.category_ids ?? ids(i.categories, "category_id", "item_category_id"),
    option_group_ids: i.option_group_ids ?? ids(i.option_groups, "option_group_id"),
    modifier_group_ids: i.modifier_group_ids ?? ids(i.modifier_groups, "modifier_group_id"),
    tag_ids: i.tag_ids ?? ids(i.tags, "tag_id"),
  };
}
async function getItem(id: T.ID | string): Promise<T.RestaurantItem> {
  return toItem(oneOf(await post(`${R}/get_item_details`, { item_id: Number(id) }), "item"));
}
async function syncItemRelations(item_id: T.ID, b: Partial<T.RestaurantItem>) {
  if (!b.category_ids && !b.option_group_ids && !b.modifier_group_ids && !b.tag_ids) return;
  const cur = await getItem(item_id);
  await syncSet(cur.category_ids, b.category_ids, (x) => post(`${R}/create_item_category_map`, { item_id, item_category_id: x }), (x) => post(`${R}/delete_item_category_map`, { item_id, item_category_id: x }));
  await syncSet(cur.option_group_ids, b.option_group_ids, (x) => post(`${R}/create_item_option_group`, { item_id, option_group_id: x }), (x) => post(`${R}/delete_item_option_group`, { item_id, option_group_id: x }));
  await syncSet(cur.modifier_group_ids, b.modifier_group_ids, (x) => post(`${R}/add_item_modifier_group`, { item_id, modifier_group_id: x }), (x) => post(`${R}/delete_item_modifier_group`, { item_id, modifier_group_id: x }));
  await syncSet(cur.tag_ids, b.tag_ids, (x) => post(`${R}/create_item_tag`, { item_id, tag_id: x }), (x) => post(`${R}/delete_item_tag`, { item_id, tag_id: x }));
}
export const itemsApi: typeof M.itemsApi = {
  list: async () => {
    const [basic, detailed] = await Promise.all([bpost(`${R}/list_items`), bpost(`${R}/list_items_detailed`)]);
    const extra = new Map(listOf(basic, "items").map((i) => [num(i.item_id), i]));
    return listOf(detailed, "items").map((i) => toItem({ ...extra.get(num(i.item_id)), ...i }));
  },
  get: (id) => getItem(id),
  create: async (b) => {
    const r = oneOf(await bpost(`${R}/create_item`, { is_active: true, is_combo: false, ...pick(b as Row, ITEM_FIELDS) }), "item");
    const id = num(r.item_id);
    await syncItemRelations(id, b);
    return getItem(id).catch(() => toItem({ ...b, ...r }));
  },
  update: async (id, b) => {
    const fields = pick(b as Row, ITEM_FIELDS);
    if (Object.keys(fields).length) await post(`${R}/update_item`, { item_id: Number(id), ...fields });
    await syncItemRelations(Number(id), b);
    return getItem(id);
  },
  remove: async (id) => { await post(`${R}/delete_item`, { item_id: Number(id) }); },
};

/** CRUD over the "/list_x, /create_x, /update_x, /delete_x" RPC routes. */
function rpc<Row_, K extends keyof Row_ & string>(o: {
  key: K; list: string; create: string; update: string; remove: string; listKeys?: string[]; scope?: string;
  map: (r: Row) => Row_; toApi?: (b: Row) => Row;
}): { list: (q?: Q) => Promise<Row_[]>; get: (id: Row_[K] | string) => Promise<Row_>; create: (b: Partial<Row_>) => Promise<Row_>; update: (id: Row_[K] | string, b: Partial<Row_>) => Promise<Row_>; remove: (id: Row_[K] | string) => Promise<void> } {
  const toApi = o.toApi ?? ((b: Row) => b);
  const list = async (q?: Q) => {
    if (o.scope) { const s = q?.[o.scope]; if (s === undefined || s === null || s === "") return []; return listOf(await post(`${R}/${o.list}`, { [o.scope]: Number(s) }), ...(o.listKeys ?? [])).map((r) => o.map({ [o.scope!]: Number(s), ...r })); }
    return listOf(await bpost(`${R}/${o.list}`), ...(o.listKeys ?? [])).map(o.map);
  };
  return {
    list,
    get: () => unsupported("Loading this record on its own"),
    create: async (b) => o.map({ ...b, ...oneOf(await (o.scope ? post : bpost)(`${R}/${o.create}`, toApi(b as Row))) }),
    update: async (id, b) => o.map({ ...b, [o.key]: id, ...oneOf(await post(`${R}/${o.update}`, { ...toApi(b as Row), [o.key]: Number(id) })) }),
    remove: async (id) => { await post(`${R}/${o.remove}`, { [o.key]: Number(id) }); },
  };
}
export const categoriesApi: typeof M.categoriesApi = rpc<T.ItemCategory, "item_category_id">({
  key: "item_category_id", list: "list_item_categories", create: "create_item_category", update: "update_item_category", remove: "delete_item_category", listKeys: ["categories"],
  map: (c) => ({ item_category_id: num(c.item_category_id ?? c.category_id), name: c.name ?? c.category_name ?? "", description: c.description ?? null }),
});
export const optionGroupsApi: typeof M.optionGroupsApi = rpc<T.OptionGroup, "option_group_id">({
  key: "option_group_id", list: "list_option_groups", create: "create_option_group", update: "update_option_group", remove: "delete_option_group", listKeys: ["option_groups"],
  map: (g) => ({ option_group_id: num(g.option_group_id), name: g.name ?? "", is_required: bool(g.is_required), min_select: num(g.min_select), max_select: num(g.max_select, 1), display_order: num(g.display_order) }),
});
export const modifierGroupsApi: typeof M.modifierGroupsApi = rpc<T.ModifierGroup, "modifier_group_id">({
  key: "modifier_group_id", list: "list_modifier_groups", create: "create_modifier_group", update: "update_modifier_group", remove: "delete_modifier_group", listKeys: ["modifier_groups"],
  map: (g) => ({ modifier_group_id: num(g.modifier_group_id), name: g.name ?? "", is_required: bool(g.is_required), min_select: num(g.min_select), max_select: num(g.max_select, 1) }),
});
export const optionsApi: typeof M.optionsApi = rpc<T.Option, "option_id">({
  key: "option_id", scope: "option_group_id", list: "list_option", create: "create_option", update: "update_option", remove: "delete_option", listKeys: ["options"],
  map: (o) => ({ option_id: num(o.option_id), option_group_id: num(o.option_group_id), name: o.name ?? "", price_delta: num(o.price_delta ?? o.price), is_default: bool(o.is_default), display_order: num(o.display_order) }),
  // create_option takes "price"; update_option takes "price_delta".
  toApi: (b) => ({ ...b, ...(b.price_delta !== undefined ? { price: b.price_delta } : {}) }),
});
export const modifiersApi: typeof M.modifiersApi = rpc<T.Modifier, "modifier_id">({
  key: "modifier_id", scope: "modifier_group_id", list: "list_modifiers", create: "create_modifier", update: "update_modifier", remove: "delete_modifier", listKeys: ["modifiers"],
  map: (m) => ({ modifier_id: num(m.modifier_id), modifier_group_id: num(m.modifier_group_id), name: m.name ?? "", price_delta: num(m.price_delta), is_active: m.is_active === undefined ? true : bool(m.is_active), display_order: num(m.display_order) }),
});
export const tagsApi: typeof M.tagsApi = rpc<T.Tag, "tag_id">({
  key: "tag_id", list: "list_tags", create: "create_tag", update: "update_tag", remove: "delete_tag", listKeys: ["tags"],
  map: (t) => ({ tag_id: num(t.tag_id), name: t.name ?? t.tag_name ?? "" }),
});
export const comboGroupsApi: typeof M.comboGroupsApi = rpc<T.ComboGroup, "combo_group_id">({
  key: "combo_group_id", scope: "item_id", list: "list_combo_groups", create: "create_combo_group", update: "update_combo_group", remove: "delete_combo_group", listKeys: ["combo_groups", "groups"],
  map: (g) => ({ combo_group_id: num(g.combo_group_id), item_id: num(g.item_id), name: g.name ?? "", min_select: num(g.min_select, 1), max_select: num(g.max_select, 1), display_order: num(g.display_order) }),
  // create_combo_group requires all of these.
  toApi: (b) => ({ display_order: 0, min_select: 1, max_select: 1, ...b }),
});
export const comboItemsApi: typeof M.comboItemsApi = rpc<T.ComboGroupItem, "combo_group_item_id">({
  key: "combo_group_item_id", scope: "combo_group_id", list: "list_combo_group_items", create: "create_combo_group_item", update: "update_combo_group_item", remove: "delete_combo_group_item", listKeys: ["items", "combo_group_items"],
  map: (c) => ({ combo_group_item_id: num(c.combo_group_item_id), combo_group_id: num(c.combo_group_id), item_id: num(c.item_id), price_delta: num(c.price_delta) }),
});

const ACTIVE: T.OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"];
const HISTORY: T.OrderStatus[] = ["delivered", "cancelled"];
function toOrder(o: Row): T.RestaurantOrder {
  return {
    order_id: num(o.order_id), customer_id: num(o.customer_id), customer_name: (o.customer_name ?? "").trim() || "Guest", customer_phone: o.customer_phone ?? "",
    order_status: (o.order_status ?? o.status) as T.OrderStatus, order_time: naive(o.order_time), scheduled_time: o.scheduled_time ? naive(o.scheduled_time) : null,
    total_price: num(o.total_price ?? o.total ?? o.total_amount), notes: o.notes ?? null,
    items: (o.items ?? []).map((l: Row, i: number) => ({
      order_item_id: num(l.order_item_id, i + 1), item_id: num(l.item_id), name: l.name ?? l.item_name ?? "", quantity: num(l.quantity, 1),
      total_price: num(l.total_price ?? l.price), options: (l.options ?? []).map((x: Row) => x.name ?? x.option_name).filter(Boolean),
      modifiers: (l.modifiers ?? []).map((x: Row) => x.name ?? x.modifier_name).filter(Boolean),
    })),
  };
}
export const ordersApi: typeof M.ordersApi = {
  list: async (scope) => {
    const r = await bpost(`${R}/list_orders`, { status: scope === "active" ? ACTIVE : HISTORY, order_mode: ["order_time:desc"], per_page: 100 });
    return listOf(r, "orders").map(toOrder);
  },
  setStatus: async (id, order_status) => toOrder({ order_id: id, order_status, ...oneOf(await post(`${R}/update_order`, { order_id: id, order_status })), status: undefined }),
};
export const cloverApi: typeof M.cloverApi = {
  sync: async () => {
    const t = Date.now();
    const s = oneOf(await bpost("/api/clover/sync"));
    return { items: num(s.items_synced), categories: num(s.categories_synced), modifier_groups: num(s.modifiers_synced), duration_ms: Date.now() - t };
  },
};

// Drop the cached user whenever the session is cleared.
if (typeof window !== "undefined") window.addEventListener("pd:unauthorized", () => saveUser(null));
