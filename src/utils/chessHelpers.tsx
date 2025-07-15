import type { Dests, Key } from "chessground/types";
import { Chess } from "../../chessops/src/chess.ts";
import { makeSquare, parseSquare } from "../../chessops/src/util.ts";
import { parseFen, makeFen } from "../../chessops/src/fen.ts";
import '../App.css';

export function playSound(type: "move" | "capture" | "check") {
  const src = {
    move: "../public/sounds/move.mp3",
    capture: "../public/sounds/capture.mp3",
    check: "../public/sounds/check.mp3",
  }[type];
  const audio = new Audio(src);
  audio.play().catch((err) => {
    console.warn("Sound playback failed:", err);
  });
}

// Converts chess context legal moves to Chessground dests Map
export function calculateDests(chess: Chess): Dests {
  const ctx = chess.ctx();
  const dests: Dests = new Map();
  for (const [from, targets] of chess.allDests(ctx)) {
    const fromStr: Key = makeSquare(from);
    const targetStrs: Key[] = [...targets].map(t => makeSquare(t));
    dests.set(fromStr, targetStrs);
  }
  return dests;
}

// Creates a new Chess instance from fen or default
export function createChessInstance(fen: string): Chess {
  if (fen === "start") {
    return Chess.default();
  }
  const setupResult = parseFen(fen);
  return Chess.fromSetup(setupResult.unwrap()).unwrap();
}

export function getCheckHighlights(chess: Chess): Map<Key, string> {
  const highlights = new Map<Key, string>();
  if (chess.isCheck()) {
    const king = chess.board.kingOf(chess.turn);
    if (king) highlights.set(makeSquare(king), "check");
  }
  return highlights;
}