// src/pages/ProfilePage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import GameCard from "../components/GameCard";
import { FavoritePiece, NameLine, PieceIcon, Record } from "../components/ProfileBadge";
import { COUNTRIES, FAVORITE_PIECES, FLAIRS, pieceLabel, type Profile, type ProfileGame } from "../utils/profile";

const PAGE = 50;

const field: React.CSSProperties = { background: "#111", color: "#ddd", border: "1px solid #333", borderRadius: 6, padding: "8px 10px", font: "inherit", width: "100%", boxSizing: "border-box" };
const label: React.CSSProperties = { fontSize: 12, color: "#888", letterSpacing: "0.06em", marginBottom: 6, display: "block" };
const smallBtn: React.CSSProperties = { background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "#ddd", borderRadius: 6, padding: "6px 12px", cursor: "pointer", font: "inherit", fontSize: 13 };

export default function ProfilePage() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [games, setGames] = useState<ProfileGame[] | null>(null); // null = showing only the recent few
  const [more, setMore] = useState(false);
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    setProfile(null);
    setError(null);
    setEditing(false);
    setGames(null);
    apiFetch(`/users/${encodeURIComponent(username)}/profile`).then(setProfile).catch((e) => setError(e.message));
  }, [username]);

  const isMe = !!user && !!profile && user.id === profile.id;

  async function loadGames(skip: number) {
    setLoadingGames(true);
    try {
      const batch: ProfileGame[] = await apiFetch(`/users/${encodeURIComponent(username)}/games?skip=${skip}&take=${PAGE}`);
      setGames((prev) => (skip === 0 ? batch : [...(prev ?? []), ...batch]));
      setMore(batch.length === PAGE);
    } finally {
      setLoadingGames(false);
    }
  }

  if (error) return <div style={{ textAlign: "center", padding: "60px 20px", color: "#aaa" }}>{error === "User not found" ? `No player named “${username}”.` : error}</div>;
  if (!profile) return <div style={{ padding: 24, color: "#888", textAlign: "center" }}>Loading…</div>;

  const shown = games ?? profile.recentGames;
  const canSeeAll = games === null && profile.stats.total > profile.recentGames.length;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      {!editing ? (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <NameLine p={profile} size={26} />
              <span style={{ fontSize: 14, color: "#aaa" }}>
                Joined {new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            </div>
            {isMe && <button style={smallBtn} onClick={() => setEditing(true)}>Edit profile</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 20 }}>
            <div style={{ minWidth: 0 }}>
              {profile.bio && <div style={{ color: "#ccc", overflowWrap: "anywhere" }}>{profile.bio}</div>}
              {isMe && !profile.bio && !profile.flair && !profile.country && !profile.favoritePiece && (
                <div style={{ fontSize: 13, color: "#777" }}>Add a bio, flair, country flag or favorite piece with “Edit profile”.</div>
              )}
            </div>
            <div style={{ gridColumn: 2, transform: "translateX(12px)" }}>{profile.favoritePiece && <FavoritePiece role={profile.favoritePiece} />}</div>
            <div style={{ gridColumn: 3, justifySelf: "end", marginRight: 28 }}><Record stats={profile.stats} /></div>
          </div>
        </div>
      ) : (
        <ProfileEditor
          profile={profile}
          onCancel={() => setEditing(false)}
          onSaved={(p) => { setProfile({ ...profile, ...p }); setEditing(false); }}
        />
      )}

      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#ddd" }}>{games ? "All games" : "Recent games"}</h3>
        {shown.length === 0 ? (
          <div style={{ color: "#888", padding: "20px 0" }}>No games recorded yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((g) => <GameCard key={g.id} game={g} perspectiveId={profile.id} />)}
          </div>
        )}
        {canSeeAll && (
          <button style={{ ...smallBtn, marginTop: 14 }} disabled={loadingGames} onClick={() => loadGames(0)}>
            {loadingGames ? "Loading…" : `See all games (${profile.stats.total})`}
          </button>
        )}
        {games && more && (
          <button style={{ ...smallBtn, marginTop: 14 }} disabled={loadingGames} onClick={() => loadGames(games.length)}>
            {loadingGames ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileEditor({ profile, onCancel, onSaved }: {
  profile: Profile;
  onCancel: () => void;
  onSaved: (p: Pick<Profile, "bio" | "flair" | "country" | "favoritePiece">) => void;
}) {
  const [bio, setBio] = useState(profile.bio ?? "");
  const [flair, setFlair] = useState(profile.flair ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [piece, setPiece] = useState(profile.favoritePiece ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const saved = await apiFetch("/me/profile", {
        method: "PUT",
        body: JSON.stringify({ bio, flair, country, favoritePiece: piece }),
      });
      onSaved(saved);
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  }

  const chip = (active: boolean): React.CSSProperties => ({
    minWidth: 40, minHeight: 40, borderRadius: 8, cursor: "pointer", fontSize: 20,
    background: active ? "rgba(216,169,74,0.18)" : "transparent",
    border: `1px solid ${active ? "rgba(216,169,74,0.7)" : "rgba(255,255,255,0.1)"}`,
  });

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span style={label}>BIO ({bio.length}/120)</span>
        <textarea value={bio} maxLength={120} rows={3} onChange={(e) => setBio(e.target.value)} placeholder="Say something about yourself" style={{ ...field, resize: "vertical" }} />
      </div>

      <div>
        <span style={label}>FLAIR</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" style={{ ...chip(flair === ""), fontSize: 12, padding: "0 10px", color: "#aaa" }} onClick={() => setFlair("")}>None</button>
          {FLAIRS.map((f) => (
            <button key={f} type="button" style={chip(flair === f)} onClick={() => setFlair(f)} aria-label={`Flair ${f}`}>{f}</button>
          ))}
        </div>
      </div>

      <div>
        <span style={label}>COUNTRY</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={field}>
          <option value="">Not shown</option>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <span style={label}>FAVORITE PIECE</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" style={{ ...chip(piece === ""), fontSize: 12, padding: "0 10px", color: "#aaa" }} onClick={() => setPiece("")}>None</button>
          {FAVORITE_PIECES.map((r) => (
            <button key={r} type="button" title={pieceLabel(r)} aria-label={pieceLabel(r)} style={{ ...chip(piece === r), display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }} onClick={() => setPiece(r)}>
              <PieceIcon role={r} size={32} />
            </button>
          ))}
        </div>
      </div>

      {err && <div style={{ color: "#c98a8a", fontSize: 13 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...smallBtn, background: "#d8a94a", color: "#1a1408", border: "none", fontWeight: 600 }} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
        <button style={smallBtn} disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
