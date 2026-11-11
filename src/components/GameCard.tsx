// src/components/GameCard.tsx — one finished game, seen from `perspectiveId`'s side
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProfileGame } from "../utils/profile";

type Outcome = "win" | "loss" | "draw";

function outcomeFor(result: string, perspectiveId: string, whiteId: string): Outcome {
  const isWhite = perspectiveId === whiteId;
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

function outcomeScore(result: string): string {
  if (result.endsWith("1-0")) return "1-0";
  if (result.endsWith("0-1")) return "0-1";
  return "½-½";
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function extractMoves(pgn: string): string[] {
  const moveSection = pgn.split("\n\n")[1] ?? "";
  return moveSection.trim().split(/\s+/).filter((t) => t && !/^\d+\./.test(t) && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));
}

const outcomeColor = (o: Outcome) => (o === "win" ? "#2a9d5c" : o === "loss" ? "#c0392b" : "#7f8c8d");

export default function GameCard({ game, perspectiveId }: { game: ProfileGame; perspectiveId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const outcome = outcomeFor(game.result, perspectiveId, game.whiteId);

  return (
    <div
      style={{ display: "flex", background: "#1a1a1a", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a2a", cursor: "pointer" }}
      onClick={() =>
        navigate("/analysis", {
          state: {
            initialFen: game.startFen,
            initialMoves: extractMoves(game.pgn),
            initialUci: game.moves ? game.moves.split(" ").filter(Boolean) : undefined,
            orientation: game.whiteId === perspectiveId ? "white" : "black",
          },
        })
      }
    >
      <div style={{ width: 4, flexShrink: 0, background: outcomeColor(outcome) }} />
      <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 14, flexWrap: "wrap" }}>
            <span style={game.whiteId === perspectiveId ? { color: "#fff", fontWeight: 600 } : { color: "#aaa" }}>♔ {game.whiteUsername}</span>
            <span style={{ color: "#555", fontSize: 12 }}>vs</span>
            <span style={game.blackId === perspectiveId ? { color: "#fff", fontWeight: 600 } : { color: "#aaa" }}>♚ {game.blackUsername}</span>
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 13, color: "#888", flexShrink: 0 }}>{outcomeScore(game.result)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#666", flexWrap: "wrap" }}>
          <span>{resultLabel(game.result)}</span>
          <span style={{ color: "#444" }}>·</span>
          <span>{Math.ceil(game.moveCount / 2)} moves</span>
          <span style={{ color: "#444" }}>·</span>
          <span>⏱ {game.timeControl}</span>
          <span style={{ color: "#444" }}>·</span>
          <span>{formatDate(game.playedAt)}</span>
          <button
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#555", fontSize: 11, cursor: "pointer", padding: "2px 6px" }}
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          >
            {open ? "Hide PGN ▲" : "PGN ▼"}
          </button>
        </div>

        {open && (
          <div style={{ marginTop: 8, background: "#111", borderRadius: 6, padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
            <pre style={{ margin: 0, fontSize: 12, color: "#aaa", whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.6 }}>{game.pgn}</pre>
            <button
              style={{ marginTop: 10, background: "#2a2a2a", border: "1px solid #3a3a3a", color: "#aaa", fontSize: 11, padding: "4px 10px", borderRadius: 4, cursor: "pointer" }}
              onClick={() => navigator.clipboard.writeText(game.pgn)}
            >
              Copy PGN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
