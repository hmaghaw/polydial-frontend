export const money = (n: number | string | null | undefined, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(n ?? 0));
export const cents = (c: number) => money(c / 100);
export const dateTime = (s?: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
export const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");
export const time = (s?: string | null) => (s ? new Date(s).toLocaleTimeString(undefined, { timeStyle: "short" }) : "—");
export const duration = (sec?: number | null) => {
  if (!sec) return "0s";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
};
export const hhmm = (t?: string | null) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const d = new Date(); d.setHours(h, m);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const fullName = (p: { first_name?: string | null; last_name?: string | null }) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown caller";
