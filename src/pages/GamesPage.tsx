// src/pages/GamesPage.tsx
import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

type Game = {
  id: string;
  whiteId: string;
  blackId: string;
  whiteUsername: string;
  blackUsername: string;
  result: string;
  pgn: string;
  startFen: string;
  timeControl: string;
  playedAt: string;
  moveCount: number;
};

function parseResult(result: string, userId: string, whiteId: string): "win" | "loss" | "draw" {
  const isWhite = userId === whiteId;
  if (result.endsWith("1/2-1/2")) return "draw";
  if (result.endsWith("1-0")) return isWhite ? "win" : "loss";
  if (result.endsWith("0-1")) return isWhite ? "loss" : "win";
  return "draw";
}

function resultLabel(result: string): string {
  if (result.startsWith("Checkmate")) return "Checkmate";
  if (result.startsWith("Stalemate")) return "Stalemate";
  if (result.startsWith("Black Resigns") || result.startsWith("White Resigns")) return "Resignation";
  if (result.startsWith("Agreement")) return "Draw agreed";
  if (result.startsWith("Insufficient")) return "Insufficient material";
  if (result.includes("flagged")) return "Time";
  return result;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function outcomeScore(result: string): string {
  if (result.endsWith("1-0")) return "1-0";
  if (result.endsWith("0-1")) return "0-1";
  return "½-½";
}

export default function GamesPage() {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const myUsername = games.length > 0
  ? (games[0].whiteId === user.id ? games[0].whiteUsername : games[0].blackUsername)
  : user?.username ?? ""; // fallback if no games yet
  const navigate = useNavigate();

  useEffect(() => {
    if (user) load();
    else setGames([]);
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const res: Game[] = await apiFetch("/games");
      setGames(res);
    } catch (err: any) {
      console.error("Failed to load games", err);
    } finally {
      setLoading(false);
    }
  }

  function togglePgn(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function extractMoves(pgn: string): string[] {
  const moveSection = pgn.split("\n\n")[1] ?? "";
  return moveSection
    .trim()
    .split(/\s+/)
    .filter((t) => t && !/^\d+\./.test(t)); // strip move numbers
}

  if (!user) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyIcon}>♟</span>
        <p>Sign in to view your game history.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>{myUsername}'s Game History</h2>
        <span style={styles.subtitle}>{games.length} game{games.length !== 1 ? "s" : ""} played</span>
      </div>

      {loading && <div style={styles.loading}>Loading…</div>}

      {!loading && games.length === 0 && (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>♙</span>
          <p style={{ color: "#888" }}>No games recorded yet. Play a game to get started.</p>
        </div>
      )}

      {!loading && games.length > 0 && (
        <div style={styles.list}>
          {games.map((game) => {
            const outcome = parseResult(game.result, user.id, game.whiteId);
            const isOpen = expanded === game.id;

            return (
              <div key={game.id} style={{ ...styles.card, cursor: "pointer" }} 
              onClick={() => {
                const moves = extractMoves(game.pgn);
                navigate("/analysis", {
                    state: {
                    initialFen: game.startFen,
                    initialMoves: moves,
                    orientation: game.whiteId === user?.id ? "white" : "black",
                    }
                });
                }}>
                {/* Color bar */}
                <div style={{ ...styles.colorBar, background: outcomeColor(outcome) }} />

                <div style={styles.cardBody}>
                  {/* Top row: outcome badge + players */}
                  <div style={styles.topRow}>
                    <span style={{ ...styles.outcomeBadge, background: outcomeColor(outcome) }}>
                      {outcome.toUpperCase()}
                    </span>

                    <div style={styles.players}>
                      <span style={game.whiteId === user.id ? styles.youLabel : styles.opponentLabel}>
                        ♔ {game.whiteUsername}
                      </span>
                      <span style={styles.vs}>vs</span>
                      <span style={game.blackId === user.id ? styles.youLabel : styles.opponentLabel}>
                        ♚ {game.blackUsername}
                      </span>
                    </div>

                    <span style={styles.score}>{outcomeScore(game.result)}</span>
                  </div>

                  {/* Bottom row: meta info */}
                  <div style={styles.metaRow}>
                    <span style={styles.meta}>{resultLabel(game.result)}</span>
                    <span style={styles.metaDot}>·</span>
                    <span style={styles.meta}>{Math.ceil(game.moveCount / 2)} moves</span>
                    <span style={styles.metaDot}>·</span>
                    <span style={styles.meta}>⏱ {game.timeControl}</span>
                    <span style={styles.metaDot}>·</span>
                    <span style={styles.meta}>{formatDate(game.playedAt)}</span>

                    <button
                      style={styles.pgnToggle}
                      onClick={(e) => { e.stopPropagation(); togglePgn(game.id); }}
                    >
                      {isOpen ? "Hide PGN ▲" : "PGN ▼"}
                    </button>
                  </div>

                  {/* PGN drawer */}
                  {isOpen && (
                    <div style={styles.pgnBox}>
                      <pre style={styles.pgnText}>{game.pgn}</pre>
                      <button
                        style={styles.copyBtn}
                        onClick={(e) => {e.stopPropagation(); navigator.clipboard.writeText(game.pgn)}}
                      >
                        Copy PGN
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function outcomeColor(outcome: "win" | "loss" | "draw"): string {
  if (outcome === "win") return "#2a9d5c";
  if (outcome === "loss") return "#c0392b";
  return "#7f8c8d";
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "24px 20px",
    maxWidth: 720,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 14,
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "#fff",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
  },
  loading: {
    color: "#888",
    padding: "20px 0",
  },
  empty: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#aaa",
  },
  emptyIcon: {
    fontSize: 40,
    display: "block",
    marginBottom: 12,
    opacity: 0.3,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  card: {
    display: "flex",
    background: "#1a1a1a",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #2a2a2a",
  },
  colorBar: {
    width: 4,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  outcomeBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    padding: "2px 7px",
    borderRadius: 3,
    color: "#fff",
    flexShrink: 0,
  },
  players: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  },
  youLabel: {
    color: "#fff",
    fontWeight: 600,
  },
  opponentLabel: {
    color: "#aaa",
  },
  vs: {
    color: "#555",
    fontSize: 12,
  },
  score: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#888",
    flexShrink: 0,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#666",
    flexWrap: "wrap",
  },
  meta: {
    color: "#666",
  },
  metaDot: {
    color: "#444",
  },
  pgnToggle: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "#555",
    fontSize: 11,
    cursor: "pointer",
    padding: "2px 6px",
  },
  pgnBox: {
    marginTop: 8,
    background: "#111",
    borderRadius: 6,
    padding: "12px 14px",
    position: "relative",
  },
  pgnText: {
    margin: 0,
    fontSize: 12,
    color: "#aaa",
    whiteSpace: "pre-wrap",
    fontFamily: "monospace",
    lineHeight: 1.6,
  },
  copyBtn: {
    marginTop: 10,
    background: "#2a2a2a",
    border: "1px solid #3a3a3a",
    color: "#aaa",
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 4,
    cursor: "pointer",
  },
};