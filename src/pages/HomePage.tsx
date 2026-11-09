import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import { parseBoardFen } from "chessops/fen";
import chapters from "../assets/chapters.json";
import lessons from "../assets/lessons.json";
import "../assets/custom-pieces.css";

const UPDATE_KEY = "seenUpdateNovember2026";

const UPDATE_TITLE = "November 2026 Patch Notes";
const UPDATE_LINES = [
  "New king variant: the General, who brings Xiangqi's flying style into Token Chess.",
  "Game mode: Anything Goes. Look for the AG tag on your drafts.",
  "A new tutorial experience is now in beta. Feedback is welcome.",
];

type LobbyRoom = { roomId: string; owner: string; status: string; players?: string[]; timeControl?: { length: number; increment: number }; anythingGoes?: boolean };

type ActiveDraft = { id: string; name: string; isActive: boolean; data?: { fen?: string } };

// a draft's FEN holds white's home ranks at the bottom: returns [rank 2 (front), rank 1 (back)] as role names (null = empty)
function draftRows(fen?: string): (string | null)[][] | null {
  if (!fen) return null;
  try {
    const board = parseBoardFen(fen.split(" ")[0]).unwrap();
    return [1, 0].map((rank) =>
      Array.from({ length: 8 }, (_, file) => board.get(file + 8 * rank)?.role ?? null)
    );
  } catch {
    return null;
  }
}

const card: React.CSSProperties = { display: "flex", flexDirection: "column", padding: 16, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 };
const cardHead: React.CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(212,175,55,0.25)" };
const cardTitle: React.CSSProperties = { margin: 0, fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, color: "#e8dcc0" };
const cardLink: React.CSSProperties = { color: "#d4af37", fontSize: 13, textDecoration: "none" };
const muted: React.CSSProperties = { color: "#888", fontSize: 13 };
const list: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };
const primaryBtn: React.CSSProperties = { padding: "9px 16px", borderRadius: 6, background: "#d4af37", color: "#1a1408", fontWeight: 600, fontSize: 14, textDecoration: "none" };
const ghostBtn: React.CSSProperties = { padding: "9px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)", color: "#ddd", fontSize: 14, textDecoration: "none" };


const homeCss = `
/* narrow: columns dissolve into one stack ordered hero, about, play, drafts, leaderboard */
.home-grid { display: grid; gap: 20px; grid-template-columns: 1fr; }
.home-left, .home-right { display: contents; }
.home-hero { order: 0; text-align: center; padding: 8px 0; }
.home-play { order: 1; } .home-drafts { order: 2; } .home-board { order: 3; }
@media (min-width: 1040px) {
  .home-grid { grid-template-columns: minmax(0, 1fr) minmax(300px, 360px); align-items: stretch; }
  .home-left, .home-right { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .home-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
}
`;

// tutorial progress from the same localStorage key LearnPage writes
function learnProgress() {
  const track = (chapters as { lessons: string[] }[]).flatMap((c) => c.lessons);
  const all = lessons as unknown as Record<string, { title: string; steps: unknown[] }>;
  const keys = track.filter((k) => all[k]);
  const total = keys.reduce((n, k) => n + all[k].steps.length, 0);
  let furthest = 0;
  try {
    furthest = Number(localStorage.getItem("tokenchess.learn.furthest")) || 0;
  } catch { /* storage unavailable */ }
  let seen = 0;
  let lessonIdx = 0;
  for (let i = 0; i < keys.length; i++) {
    if (furthest < seen + all[keys[i]].steps.length) { lessonIdx = i; break; }
    seen += all[keys[i]].steps.length;
    lessonIdx = i;
  }
  const started = localStorage.getItem("tokenchess.learn.furthest") !== null;
  const pct = !started || total === 0 ? 0 : Math.min(100, Math.round(((furthest + 1) / total) * 100));
  return { pct, lessonNo: lessonIdx + 1, lessonCount: keys.length, lessonTitle: all[keys[lessonIdx]]?.title ?? "" };
}

export default function HomePage() {
  const standardPieces = ["pawn", "knight", "bishop", "rook", "queen", "king"];
  const customPieces = ["champion", "princess", "amazon", "mann", "painter", "snare", "wizard", "archer", "general", "royalpainter", "centaur", "rollingsnare"];

  // 18 pieces split into two even rows of 9
  const allPieces = [...standardPieces, ...customPieces];

  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null | undefined>(undefined);
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [board, setBoard] = useState<{ username: string; wins: number; games: number }[] | null>(null);
  const learn = learnProgress();

  useEffect(() => {
    let alive = true;
    const loadRooms = () => apiFetch("/lobby").then((r) => alive && setRooms(r)).catch(() => {});
    loadRooms();
    const id = setInterval(loadRooms, 5000);
    apiFetch("/leaderboard").then((r) => alive && setBoard(r)).catch(() => alive && setBoard([]));
    return () => { alive = false; clearInterval(id); };
  }, []);

  // logged-in users: load their active draft for the Drafts panel
  useEffect(() => {
    if (!user) { setActiveDraft(undefined); return; }
    let alive = true;
    apiFetch("/drafts")
      .then((ds: ActiveDraft[]) => alive && setActiveDraft(ds.find((d) => d.isActive) ?? null))
      .catch(() => alive && setActiveDraft(null));
    return () => { alive = false; };
  }, [user]);

  // lock page scroll only while everything fits the window; otherwise let it scroll so no panel is ever unreachable
  useEffect(() => {
    const apply = () => {
      document.body.style.overflow = "auto"; // measure unlocked
      const fits = document.documentElement.scrollHeight <= window.innerHeight + 1;
      document.body.style.overflow = fits ? "hidden" : "auto";
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(document.body);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      document.body.style.overflow = "auto";
    };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(UPDATE_KEY)) {
      setShowModal(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(UPDATE_KEY, "1");
    setShowModal(false);
  }

  const renderRow = (pieces: string[], color: "white" | "black") => (
    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
      {pieces.map((role) => (
        <div
          key={`${role}-${color}`}
          className={`cg-piece ${role} ${color}`}
          style={{ flex: "1 1 36px", maxWidth: 80, aspectRatio: "1", backgroundRepeat: "no-repeat", backgroundPosition: "center center", backgroundSize: "contain" }}
        />
      ))}
    </div>
  );

  return (
    <div className="app-container" style={{ padding: 28, maxWidth: 1400, margin: "0 auto", textAlign: "left" }}>

      {/* Update modal */}
      {showModal && (
        <div
          onClick={dismiss}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "32px 36px",
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              textAlign: "left",
              color: "#eee",
              fontFamily: "monospace",
            }}
          >
            <div style={{ fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              Update
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#fff" }}>
              {UPDATE_TITLE}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {UPDATE_LINES.map((line, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: "#ccc" }}>
                  {line}
                </li>
              ))}
            </ul>
            <Link
              to="/learn"
              onClick={dismiss}
              style={{
                display: "block",
                marginTop: 20,
                fontSize: 13,
                color: "#d4af37",
                textDecoration: "none",
              }}
            >
              Try the new tutorial (beta) →
            </Link>

            <button
              onClick={dismiss}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 0",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <style>{homeCss}</style>
      <div className="home-grid">
        <div className="home-left">
          <div className="home-hero">
            <h1 style={{ margin: "0 0 28px", fontSize: "4rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              token chess
              <img src="/images/coin-stack.svg" alt="Token" style={{ width: 58, height: 58 }} />
              <img src="/images/coin-stack.svg" alt="Token" style={{ width: 58, height: 58 }} />
            </h1>
            {renderRow(allPieces.slice(0, 9), "white")}
            {renderRow(allPieces.slice(9), "white")}
            {renderRow(allPieces.slice(0, 9), "black")}
            {renderRow(allPieces.slice(9), "black")}
            <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 6 }}>
              <Link to="/tutorials" style={{ ...cardLink, fontSize: 16 }}>What is it? →</Link>
              <Link to="/learn" style={{ ...cardLink, fontSize: 16 }}>
                Tutorial{learn.pct > 0 ? ` (${learn.pct}%)` : ""} →
              </Link>
            </div>
          </div>
        </div>

        <div className="home-right">
          {/* Game lobby */}
          <section className="home-play" style={card}>
            <div style={cardHead}>
              <h2 style={cardTitle}>Play</h2>
              <Link to="/lobby" style={cardLink}>Game lobby →</Link>
            </div>
            {rooms.length === 0 ? (
              <div style={muted}>No open games right now. Be the first to start one.</div>
            ) : (
              <ul style={list}>
                {rooms.slice(0, 3).map((r) => (
                  <li key={r.roomId} className="lobby-card" onClick={() => navigate(`/game?room=${r.roomId}`)}>
                    <span style={{ fontWeight: 600 }}>
                      {r.status === "open" ? r.owner : r.players?.length === 2 ? `${r.players[0]} vs ${r.players[1]}` : "In progress"}
                    </span>
                    <span style={{ color: "#aaa", fontSize: 14 }}>
                      {r.timeControl ? `${r.timeControl.length}+${r.timeControl.increment}` : "—"}
                      {r.anythingGoes ? " · AG" : ""} · {r.status === "open" ? "Join" : "Watch"}
                    </span>
                  </li>
                ))}
                {rooms.length > 3 && (
                  <li style={{ ...muted, textAlign: "center" }}>
                    <Link to="/lobby" style={{ color: "inherit" }}>+{rooms.length - 3} more in the lobby</Link>
                  </li>
                )}
              </ul>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 12, flexWrap: "wrap" }}>
              <Link to="/lobby" style={primaryBtn}>Create a game</Link>
              <Link to="/play/computer" style={ghostBtn}>vs Computer</Link>
            </div>
          </section>

          {/* Drafts (logged-in only) */}
          {user && (
            <section className="home-drafts" style={card}>
              <div style={cardHead}>
                <h2 style={cardTitle}>Drafts</h2>
                <Link to="/drafts" style={cardLink}>Create / edit →</Link>
              </div>
              {(() => {
                const rows = draftRows(activeDraft?.data?.fen);
                if (activeDraft === undefined) return <div style={muted}>Loading…</div>;
                if (!activeDraft || !rows) return <div style={muted}>No active draft yet.</div>;
                return (
                  <>
                    <div style={{ ...muted, marginBottom: 8 }}>Active: {activeDraft.name}</div>
                    {rows.map((row, r) => (
                      <div key={r} style={{ display: "flex" }}>
                        {row.map((role, f) => (
                          <div
                            key={f}
                            className={role ? `cg-piece ${role} white` : undefined}
                            style={{ flex: "1 1 0", aspectRatio: "1", maxWidth: 36, backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "contain" }}
                          />
                        ))}
                      </div>
                    ))}
                  </>
                );
              })()}
            </section>
          )}

          {/* Leaderboard */}
          <section className="home-board" style={card}>
            <div style={cardHead}>
              <h2 style={cardTitle}>Leaderboard</h2>
              <span style={muted}>by wins</span>
            </div>
            {board === null ? (
              <div style={muted}>Loading…</div>
            ) : board.length === 0 ? (
              <div style={muted}>No finished games yet.</div>
            ) : (
              <ol style={{ ...list, display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(5, auto)", columnGap: 20, rowGap: 6 }}>
                {board.map((p, i) => (
                  <li key={p.username} title={`${p.games} played`} style={{ display: "flex", gap: 8, alignItems: "baseline", minWidth: 0 }}>
                    <span style={{ width: 18, color: i === 0 ? "#d4af37" : "#777", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: i < 3 ? 600 : 400 }}>{p.username}</span>
                    <span style={{ ...muted, fontVariantNumeric: "tabular-nums" }}>{p.wins}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      {/* "What's new" button — fixed so it's always visible even with scroll disabled */}
      {!showModal && (
        <button
          onClick={() => setShowModal(true)}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "transparent",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: 6,
            color: "#d4af37",
            fontSize: 14,
            padding: "7px 16px",
            cursor: "pointer",
            letterSpacing: "0.03em",
          }}
        >
          What's new
        </button>
      )}
    </div>
  );
}
