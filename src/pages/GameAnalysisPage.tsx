// src/pages/GameAnalysisPage.tsx — /analysis/:gameId, a saved game opened by link (public)
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import AnalysisBoard from "../components/AnalysisBoard";
import Flair from "../components/Flair";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import { summarizeResult, type SharedGame } from "../utils/profile";

// movetext of a saved PGN as a list of SAN tokens (fallback for games saved before UCI was stored)
function sanFromPgn(pgn: string): string[] {
  const text = pgn.split("\n\n")[1] ?? "";
  return text.trim().split(/\s+/).filter((t) => t && !/^\d+\./.test(t) && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function GameAnalysisPage() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [game, setGame] = useState<SharedGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setGame(null);
    setError(null);
    apiFetch(`/games/${encodeURIComponent(gameId ?? "")}`).then(setGame).catch((e) => setError(e.message));
  }, [gameId]);

  const initialUci = useMemo(() => (game?.moves ? game.moves.split(" ").filter(Boolean) : undefined), [game]);
  const initialMoves = useMemo(() => (game ? sanFromPgn(game.pgn) : undefined), [game]);

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#aaa" }}>
        {error === "Game not found" ? "That game doesn't exist." : error}
      </div>
    );
  }
  if (!game) return <div style={{ padding: 24, color: "#888", textAlign: "center" }}>Loading…</div>;

  // the viewer's own colour if they played; otherwise the colour passed by the link they came from, else white
  const fromNav = (location.state as any)?.orientation as "white" | "black" | undefined;
  const orientation: "white" | "black" =
    user?.id === game.blackId ? "black" : user?.id === game.whiteId ? "white" : fromNav ?? "white";

  const outcome = summarizeResult(game.result);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/analysis/${game.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const player = (side: "white" | "black") => {
    const name = side === "white" ? game.whiteUsername : game.blackUsername;
    const flair = side === "white" ? game.whiteFlair : game.blackFlair;
    const won = outcome.winner === side;
    const score = outcome.winner === null ? "½" : won ? "1" : "0";
    return (
      <>
        <span style={{ width: 14, height: 14, borderRadius: 3, background: side === "white" ? "#f2f2f2" : "#111", border: "1px solid #666", flex: "0 0 auto" }} />
        <Link to={`/profile/${encodeURIComponent(name)}`} style={{ color: "#fff", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {flair && <Flair emoji={flair} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </Link>
        <span
          style={{
            marginLeft: "auto", fontFamily: "monospace", fontSize: 13, padding: "2px 8px", borderRadius: 4,
            background: won ? "#1f4d33" : "#242424", color: won ? "#7be0a3" : "#999",
          }}
        >
          {score}
        </span>
      </>
    );
  };

  const resultFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontWeight: 600, color: "#fff" }}>
        {outcome.headline} <span style={{ fontFamily: "monospace", color: "#888", fontWeight: 400 }}>· {outcome.score === "1/2-1/2" ? "½-½" : outcome.score}</span>
      </div>
      <div style={{ color: "#aaa", fontSize: 13 }}>
        {outcome.reason} · {game.timeControl} · {formatDate(game.playedAt)}
      </div>
    </div>
  );

  const actions = (
    <button onClick={copyLink} title={copied ? "Link copied" : "Copy link to this game"} aria-label="Copy link" className="ab-icon-btn" style={copied ? { color: "#7be0a3" } : undefined}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </button>
  );

  return (
    <AnalysisBoard
      key={game.id}
      initialFen={game.startFen || "start"}
      initialUci={initialUci}
      initialMoves={initialMoves}
      orientation={orientation}
      players={{ white: player("white"), black: player("black") }}
      movesFooter={resultFooter}
      extraActions={actions}
    />
  );
}
