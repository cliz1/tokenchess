// src/components/ProfileBadge.tsx — flair / flag / favorite piece / W-D-L shared by the popup and the profile page
import { countryName, pieceLabel, type Profile } from "../utils/profile";

export function PieceIcon({ role, size = 28 }: { role: string; size?: number }) {
  return (
    <div
      className={`cg-piece ${role} white`}
      style={{ width: size, height: size, flex: "0 0 auto", position: "static", backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: `${size}px ${size}px` }}
    />
  );
}

export function NameLine({ p, size = 22 }: { p: Pick<Profile, "username" | "flair" | "country">; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: size, fontWeight: 700, color: "#fff", flexWrap: "wrap" }}>
      {p.flair && <span>{p.flair}</span>}
      <span>{p.username}</span>
      {p.country && (
        <span
          className={`fi fi-${p.country.toLowerCase()}`}
          title={countryName(p.country)}
          role="img"
          aria-label={countryName(p.country)}
          style={{ fontSize: "0.85em", borderRadius: 2 }}
        />
      )}
    </div>
  );
}

export function Record({ stats }: { stats: Profile["stats"] }) {
  return (
    <div style={{ fontSize: 20, fontWeight: 600, color: "#888", fontVariantNumeric: "tabular-nums" }}>
      <span style={{ color: "#2a9d5c" }}>{stats.wins} W</span> / <span style={{ color: "#9aa5a6" }}>{stats.draws} D</span> / <span style={{ color: "#c0392b" }}>{stats.losses} L</span>
    </div>
  );
}

export function FavoritePiece({ role }: { role: string }) {
  return (
    <div title={`Favorite piece: ${pieceLabel(role)}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 16px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.08em", color: "#8a8171" }}>FAVORITE PIECE</div>
      <PieceIcon role={role} size={64} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "#ece4d6" }}>{pieceLabel(role)}</div>
    </div>
  );
}
