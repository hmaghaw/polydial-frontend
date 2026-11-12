// Mock-mode API surface (USE_MOCKS=true). mocks/router.ts implements these paths in the browser.
// The real backend is wired in endpoints.flask.ts; endpoints.ts picks one at startup.
import { http } from "./client";
import type * as T from "./types";

type Partial2<X> = Partial<X>;
const crud = <Row, IdKey extends keyof Row>(base: string, _id: IdKey) => ({
  list: (q?: Record<string, string | number | boolean | undefined>) => http.get<Row[]>(base, q),
  get: (id: Row[IdKey] | string) => http.get<Row>(`${base}/${id}`),
  create: (body: Partial2<Row>) => http.post<Row>(base, body),
  update: (id: Row[IdKey] | string, body: Partial2<Row>) => http.put<Row>(`${base}/${id}`, body),
  remove: (id: Row[IdKey] | string) => http.del(`${base}/${id}`),
});

export const authApi = {
  login: (email: string, password: string) => http.post<T.Session>("/auth/login", { email, password }),
  signup: (body: { first_name: string; last_name: string; email: string; business_name: string; phone: string; password: string }) =>
    http.post<{ message: string }>("/auth/signup", body),
  me: () => http.get<Omit<T.Session, "token">>("/auth/me"),
  logout: () => http.post<void>("/auth/logout"),
  forgotPassword: (email: string) => http.post<{ message: string }>("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) => http.post<{ message: string }>("/auth/reset-password", { token, password }),
  verifyEmail: (token: string) => http.post<{ message: string }>("/auth/verify-email", { token }),
  resendVerification: (email: string) => http.post<{ message: string }>("/auth/resend-verification", { email }),
  oauthCallback: (provider: string, code: string, state?: string) => http.post<T.Session>(`/auth/oauth/${provider}/callback`, { code, state }),
  cloverLogin: (token: string) => http.post<T.Session>("/auth/clover", { token }),
};

export const businessApi = {
  get: () => http.get<T.Business>("/business"),
  update: (b: Partial<T.Business>) => http.put<T.Business>("/business", b),
};

export const servicesApi = {
  ...crud<T.Service, "service_id">("/services", "service_id"),
  translate: (id: T.ID, lang: string, body: { name: string; description: string | null }) =>
    http.put<T.Service>(`/services/${id}/translations/${lang}`, body),
};
export const customersApi = { ...crud<T.Customer, "customer_id">("/customers", "customer_id"), calls: (id: T.ID) => http.get<T.CallMeta[]>(`/customers/${id}/calls`) };
export const appointmentsApi = crud<T.Appointment, "appointment_id">("/appointments", "appointment_id");

export const callsApi = {
  list: (q: { search?: string; from?: string; to?: string; channel?: string; direction?: string }) => http.get<T.CallMeta[]>("/calls", q),
  conversation: (sid: string) => http.get<T.ConversationTurn[]>(`/calls/${sid}/conversation`),
};

export const billingApi = {
  summary: () => http.get<Pick<T.Business, "balance_cents" | "is_auto_recharge" | "recharge_threshold" | "recharge_amount">>("/billing"),
  ledger: () => http.get<T.LedgerEntry[]>("/billing/ledger"),
  updateAutoRecharge: (b: { is_auto_recharge: boolean; recharge_threshold: number; recharge_amount: number }) => http.put("/billing/auto-recharge", b),
  /** Returns a Stripe Checkout URL in production; mocks credit the balance immediately. */
  topUp: (amount_cents: number) => http.post<{ checkout_url: string | null; balance_cents: number }>("/billing/top-up", { amount_cents }),
};

export const languagesApi = {
  catalog: () => http.get<T.Language[]>("/languages"),
  voices: (code: string) => http.get<T.LanguageVoice[]>(`/languages/${code}/voices`),
  business: () => http.get<T.BusinessLanguage[]>("/business/languages"),
  add: (language_code: string) => http.post<T.BusinessLanguage>("/business/languages", { language_code }),
  update: (code: string, b: { language_voice_id?: T.ID | null; is_default?: boolean }) => http.put<T.BusinessLanguage>(`/business/languages/${code}`, b),
  remove: (code: string) => http.del(`/business/languages/${code}`),
};

export const phonesApi = {
  list: () => http.get<T.BusinessPhone[]>("/phones"),
  update: (id: T.ID, b: Partial<T.BusinessPhone>) => http.put<T.BusinessPhone>(`/phones/${id}`, b),
  remove: (id: T.ID) => http.del(`/phones/${id}`),
  search: (q: { region?: string; area_code?: string; contains?: string }) => http.get<T.AvailableNumber[]>("/phones/available", q),
  purchase: (b: { phone_number: string; enable_auto_recharge: boolean }) => http.post<T.BusinessPhone>("/phones/purchase", b),
};
export const premiumApi = {
  list: () => http.get<T.PremiumNumber[]>("/premium-numbers"),
  purchase: (id: T.ID) => http.post<T.BusinessPhone>(`/premium-numbers/${id}/purchase`),
};
export const hoursApi = {
  list: () => http.get<T.BusinessHours[]>("/business-hours"),
  update: (day: number, b: Omit<T.BusinessHours, "day_of_week">) => http.put<T.BusinessHours>(`/business-hours/${day}`, b),
};
export const usersApi = crud<T.User, "id">("/users", "id");
export const translationsApi = crud<T.Translation, "translation_id">("/translations", "translation_id");

export const analyticsApi = {
  overview: () => http.get<{ calls_today: number; calls_week: number; avg_duration: number; resolution_rate: number; volume: { day: string; calls: number; ai: number }[] }>("/analytics/overview"),
  voice: () => http.get<{ stt_accuracy: number; latency_ms: number; emotions: { name: string; value: number }[]; quality: { name: string; value: number }[]; by_language: { language: string; accuracy: number }[] }>("/analytics/voice"),
  insights: (range: string) => http.get<{ regions: { region: string; calls: number }[]; heatmap: number[][]; leaderboard: { name: string; calls: number; resolution: number; csat: number }[] }>("/analytics/insights", { range }),
  sentiment: () => http.get<{ overall: number; positive: number; neutral: number; negative: number; trend: { day: string; positive: number; neutral: number; negative: number }[]; alerts: T.CallMeta[]; topics: { topic: string; positive: number; negative: number; mentions: number }[] }>("/analytics/sentiment"),
};
export const reportsApi = {
  list: () => http.get<T.Report[]>("/reports"),
  generate: (b: { template: string; from: string; to: string }) => http.post<T.Report>("/reports/generate", b),
  schedules: () => http.get<T.ReportSchedule[]>("/reports/schedules"),
  createSchedule: (b: Omit<T.ReportSchedule, "id">) => http.post<T.ReportSchedule>("/reports/schedules", b),
  removeSchedule: (id: string) => http.del(`/reports/schedules/${id}`),
};
export const dbApi = {
  tables: () => http.get<{ name: string; rows: number }[]>("/admin/db/tables"),
  rows: (name: string, page: number) => http.get<{ columns: string[]; rows: Record<string, unknown>[]; total: number }>(`/admin/db/tables/${name}`, { page }),
};
export const supportApi = { contact: (b: { subject: string; message: string; email: string }) => http.post<{ message: string }>("/support/contact", b) };

// ---------- Restaurant ----------
const R = "/restaurant";
export const menusApi = {
  ...crud<T.Menu, "menu_id">(`${R}/menus`, "menu_id"),
  setAvailabilities: (id: T.ID, availability_ids: T.ID[]) => http.put<T.Menu>(`${R}/menus/${id}/availabilities`, { availability_ids }),
};
export const sectionsApi = {
  list: (menu_id: T.ID) => http.get<T.MenuSection[]>(`${R}/menus/${menu_id}/sections`),
  create: (menu_id: T.ID, b: Partial<T.MenuSection>) => http.post<T.MenuSection>(`${R}/menus/${menu_id}/sections`, b),
  update: (id: T.ID, b: Partial<T.MenuSection>) => http.put<T.MenuSection>(`${R}/sections/${id}`, b),
  remove: (id: T.ID) => http.del(`${R}/sections/${id}`),
};
export const availabilityApi = crud<T.Availability, "availability_id">(`${R}/availabilities`, "availability_id");
export const itemsApi = crud<T.RestaurantItem, "item_id">(`${R}/items`, "item_id");
export const categoriesApi = crud<T.ItemCategory, "item_category_id">(`${R}/categories`, "item_category_id");
export const optionGroupsApi = crud<T.OptionGroup, "option_group_id">(`${R}/option-groups`, "option_group_id");
export const optionsApi = crud<T.Option, "option_id">(`${R}/options`, "option_id");
export const modifierGroupsApi = crud<T.ModifierGroup, "modifier_group_id">(`${R}/modifier-groups`, "modifier_group_id");
export const modifiersApi = crud<T.Modifier, "modifier_id">(`${R}/modifiers`, "modifier_id");
export const tagsApi = crud<T.Tag, "tag_id">(`${R}/tags`, "tag_id");
export const comboGroupsApi = crud<T.ComboGroup, "combo_group_id">(`${R}/combo-groups`, "combo_group_id");
export const comboItemsApi = crud<T.ComboGroupItem, "combo_group_item_id">(`${R}/combo-group-items`, "combo_group_item_id");
export const ordersApi = {
  list: (scope: "active" | "history") => http.get<T.RestaurantOrder[]>(`${R}/orders`, { scope }),
  setStatus: (id: T.ID, order_status: T.OrderStatus) => http.patch<T.RestaurantOrder>(`${R}/orders/${id}/status`, { order_status }),
};
export const cloverApi = {
  sync: () => http.post<{ items: number; categories: number; modifier_groups: number; duration_ms: number }>(`${R}/clover/sync`),
};
