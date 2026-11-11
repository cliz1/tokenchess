// src/pages/LobbyPage.tsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import puzzlesData from "../assets/puzzles.json";
import MiniBoard from "../components/MiniBoard";
import { DraftRows, draftRows } from "../components/DraftPreview";
import { card, cardHead, cardTitle, cardLink, muted, primaryBtn } from "../components/homeCards";
import { apiFetch } from "../api";
import { JoinForm } from "./JoinRoomPage";
import { useAuth } from "../AuthContext";

type DraftSummary = { id: string; name: string; isActive: boolean; slot: number; data?: { fen?: string } };

export default function LobbyPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [minutes, setMinutes] = useState(10); // default 10 min
  const [increment, setIncrement] = useState(0); // default 0 sec increment
  const [isPrivate, setIsPrivate] = useState(false); // default to public
  const [anythingGoes, setAnythingGoes] = useState(false); // default horde restrictions on
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // a random puzzle for the preview (fixed for the life of the page)
  const [puzzleIndex] = useState(() => Math.floor(Math.random() * (puzzlesData as unknown[]).length));
  const puzzle = (puzzlesData as { initialFen: string; label?: string; orientation?: "white" | "black" }[])[puzzleIndex];
  const puzzleSide: "white" | "black" =
    puzzle?.orientation ?? ((puzzle?.initialFen.split(" ")[1] ?? "w") === "b" ? "black" : "white");

  // the vs Computer card shows the active draft and lets you swap it
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [swapping, setSwapping] = useState(false);
  useEffect(() => {
    if (!user) { setDrafts(null); return; }
    let alive = true;
    apiFetch("/drafts").then((ds: DraftSummary[]) => alive && setDrafts(ds)).catch(() => alive && setDrafts([]));
    return () => { alive = false; };
  }, [user]);
  const activeDraft = drafts?.find((d) => d.isActive) ?? null;

  async function makeActive(id: string) {
    setSwapping(true);
    try {
      await apiFetch(`/drafts/${id}`, { method: "PUT", body: JSON.stringify({ isActive: true }) });
      setDrafts((ds) => ds?.map((d) => ({ ...d, isActive: d.id === id })) ?? ds);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSwapping(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    const res = await apiFetch("/lobby");
    setRooms(res);
  }

  async function createGame() {
    const res = await apiFetch("/rooms", {
      method: "POST",
      body: JSON.stringify({
        length: minutes,
        increment, // seconds
        isPrivate,
        anythingGoes,
      }),
    });
    navigate(`/game?room=${res.roomId}`);
  }

  const rows = draftRows(activeDraft?.data?.fen);

  return (
    <div className="app-container" style={{ padding: 28, maxWidth: 1400, margin: "0 auto", textAlign: "left" }}>
      <style>{PLAY_CSS}</style>

      {!user && !authLoading && (
        <div
          style={{
            maxWidth: 700, margin: "0 auto 20px", padding: "8px 12px", borderRadius: 8, fontSize: 13,
            background: "#2a2418", border: "1px solid #6b5a2a", color: "#e8d9a8", textAlign: "center",
          }}
        >
          You're not signed in. You can watch games and play the computer, but creating or joining a game as a player needs an account.{" "}
          <Link to="/login" style={{ color: "inherit", textDecoration: "underline" }}>Log in</Link>
          {" or "}
          <Link to="/register" style={{ color: "inherit", textDecoration: "underline" }}>sign up</Link>.
        </div>
      )}

      <div className="play-grid">
        <div className="play-main">
        {/* Lobby: create a game + open/active rooms */}
        <section style={card} className="play-lobby">
          <div style={cardHead}>
            <h2 style={cardTitle}>Lobby</h2>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", marginBottom: 14, fontSize: 14, color: "#ccc" }}>
            <label>
              Minutes:
              <select value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value))} style={{ width: 70, marginLeft: 5 }}>
                {[1, 2, 3, 5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Increment (sec):
              <input
                type="number" min={0} max={10} step={1} value={increment}
                onChange={(e) => setIncrement(parseInt(e.target.value) || 0)}
                style={{ width: 60, marginLeft: 5 }} placeholder="e.g. 5"
              />
            </label>
            <label>
              Private:
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} style={{ marginLeft: 5 }} />
            </label>
            <label title="Disables piece quantity (horde) limits for both players' drafts. Token budget still applies.">
              Anything Goes:
              <input type="checkbox" checked={anythingGoes} onChange={(e) => setAnythingGoes(e.target.checked)} style={{ marginLeft: 5 }} />
            </label>
            <button onClick={createGame} style={{ ...primaryBtn, background: "transparent", cursor: "pointer" }}>Create game</button>
          </div>
          {increment < 0 || increment > 10 ? (
            <div style={{ color: "red", fontSize: 12, marginBottom: 8 }}>Please enter a value between 0 and 10.</div>
          ) : null}

          <div className="play-lobby-list">
          {rooms.length === 0 ? (
            <div style={muted}>No open games right now. Be the first to start one.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {rooms.map((r) => {
                const tc = r.timeControl ? `${r.timeControl.length}+${r.timeControl.increment}` : "—";
                return (
                  <li key={r.roomId} onClick={() => navigate(`/game?room=${r.roomId}`)} className="lobby-card">
                    <div style={{ fontWeight: 600 }}>
                      {r.status === "open" ? r.owner : r.players?.length === 2 ? `${r.players[0]} vs ${r.players[1]}` : "In progress"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: "#aaa", whiteSpace: "nowrap" }}>
                      <span>{tc}</span>
                      {r.anythingGoes && (
                        <>
                          <span>·</span>
                          <span style={{ color: "#e0c060" }} title="Horde piece limits are disabled in this game">Anything Goes</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{r.status === "open" ? "Waiting for opponent" : "In progress"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
        </section>

        {/* Active draft (logged-in only, like the Home page) with a quick swap */}
        {user && (
          <section style={card}>
            <div style={cardHead}>
              <h2 style={cardTitle}>Drafts</h2>
              <Link to="/drafts" style={cardLink}>Create / edit →</Link>
            </div>
            {drafts === null ? (
              <div style={muted}>Loading…</div>
            ) : drafts.length === 0 ? (
              <div style={muted}>
                No drafts yet. <Link to="/drafts" style={{ color: "inherit", textDecoration: "underline" }}>Make one</Link> to choose your starting setup.
              </div>
            ) : (
              <>
                <label style={{ ...muted, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  Active:
                  <select value={activeDraft?.id ?? ""} disabled={swapping} onChange={(e) => makeActive(e.target.value)} style={{ flex: 1, minWidth: 0, maxWidth: 260 }}>
                    {!activeDraft && <option value="" disabled>Choose a draft…</option>}
                    {drafts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                {rows ? <DraftRows rows={rows} maxIcon={50} /> : null}
              </>
            )}
          </section>
        )}
        </div>

        <div className="play-side">
          {/* Fairy-Stockfish: just the way in */}
          <section style={card}>
            <div style={{ ...cardHead, marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>
              <h2 style={cardTitle}>Fairy Stockfish</h2>
              <Link to="/play/computer" style={cardLink}>Play computer →</Link>
            </div>
          </section>

          {/* Join room */}
          <section style={card}>
            <div style={cardHead}>
              <h2 style={cardTitle}>Join Room</h2>
            </div>
            <JoinForm compact />
          </section>

          {/* Puzzle preview */}
          <section style={card}>
            <div style={cardHead}>
              <h2 style={cardTitle}>Puzzles</h2>
              <Link to="/puzzles" state={{ index: puzzleIndex }} style={cardLink}>Solve →</Link>
            </div>
            {puzzle && (
              <Link to="/puzzles" state={{ index: puzzleIndex }} className="play-portal" aria-label="Open this puzzle">
                <MiniBoard fen={puzzle.initialFen} orientation={puzzleSide} size={260} />
                <span className="play-portal-cta">Solve →</span>
              </Link>
            )}
            <div style={{ ...muted, marginTop: 8 }}>
              {puzzle?.label?.trim() ? puzzle.label : puzzleSide === "black" ? "Black to move" : "White to move"}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const PLAY_CSS = `
.play-grid { display: grid; gap: 20px; grid-template-columns: 1fr; align-items: start; max-width: 680px; margin: 0 auto; }
.play-main, .play-side { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.play-lobby-list { height: 300px; overflow-y: auto; padding-right: 4px; }
@media (min-width: 1060px) {
  .play-grid { grid-template-columns: minmax(0, 680px) 340px; max-width: 1040px; }
}
.play-portal {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: #141414;
  text-decoration: none; cursor: pointer; transition: border-color .15s ease, background-color .15s ease;
}
.play-portal:hover { border-color: rgba(212,175,55,0.6); background: #191919; }
.play-portal-cta {
  position: absolute; right: 10px; bottom: 8px; padding: 3px 10px; border-radius: 6px; font-size: 13px;
  color: #d4af37; background: rgba(0,0,0,0.65); opacity: 0; transition: opacity .15s ease;
}
.play-portal:hover .play-portal-cta, .play-portal:focus-visible .play-portal-cta { opacity: 1; }
`;
