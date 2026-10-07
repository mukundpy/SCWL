export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error?.message ?? "Request failed", body?.error?.code ?? "ERROR", res.status);
  return body as T;
}

export const api = {
  get: <T,>(p: string) => req<T>(p),
  post: <T,>(p: string, b?: unknown) => req<T>(p, { method: "POST", body: JSON.stringify(b ?? {}) }),
  put: <T,>(p: string, b?: unknown) => req<T>(p, { method: "PUT", body: JSON.stringify(b ?? {}) }),
  del: <T,>(p: string) => req<T>(p, { method: "DELETE" }),
};

export const qs = (o: Record<string, string | number | undefined | null | false>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : "";
};
