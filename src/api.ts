// src/api.ts
// src/api.ts
const API_BASE =
  (import.meta as any).env.VITE_API_BASE ?? "http://localhost:4000/api";


export async function apiFetch(path: string, opts: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const headers: Record<string,string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  opts.headers = { ...(opts.headers ?? {}), ...headers };
  const res = await fetch(url, opts);
  let data: any = {};
  try { data = await res.json(); } catch { /* no json */ }
  if (!res.ok) {
    const err = data?.error || data?.message || res.statusText || "API error";
    throw new Error(err);
  }
  return data;
}
