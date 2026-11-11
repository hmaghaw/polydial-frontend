export interface RuntimeEnv {
  API_BASE_URL: string;
  USE_MOCKS: boolean;
  APP_NAME: string;
  CLOVER_LOGIN_ENABLED?: boolean;
}
declare global {
  interface Window { __ENV__?: Partial<Record<string, string | boolean>> }
}
const raw = (typeof window !== "undefined" && window.__ENV__) || {};
const bool = (v: unknown, d: boolean) => (v === undefined || v === "" ? d : v === true || v === "true" || v === "1");
export const env: RuntimeEnv = {
  API_BASE_URL: String(raw.API_BASE_URL ?? "https://api.polydial.com").replace(/\/$/, ""),
  USE_MOCKS: bool(raw.USE_MOCKS, true),
  APP_NAME: String(raw.APP_NAME ?? "PolyDial"),
};
