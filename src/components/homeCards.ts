// Card styling shared by the Home and Play pages
import type { CSSProperties } from "react";

export const card: CSSProperties = { display: "flex", flexDirection: "column", padding: 16, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 };
export const cardHead: CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(212,175,55,0.25)" };
export const cardTitle: CSSProperties = { margin: 0, fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, color: "#e8dcc0" };
export const cardLink: CSSProperties = { color: "#d4af37", fontSize: 13, textDecoration: "none" };
export const muted: CSSProperties = { color: "#888", fontSize: 13 };
export const list: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };
export const ghostBtn: CSSProperties = { padding: "9px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)", color: "#ddd", fontSize: 14, textDecoration: "none" };
export const primaryBtn: CSSProperties = { ...ghostBtn, color: "#d4af37" };
