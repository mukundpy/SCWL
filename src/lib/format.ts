// MySQL DATETIME strings ("YYYY-MM-DD HH:mm:ss") -> local Date
export const toDate = (s: string) => new Date(s.replace(" ", "T"));

export const fmtDateTime = (s?: string | null) =>
  s ? toDate(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

export const fmtDate = (s?: string | null) =>
  s ? toDate(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);
