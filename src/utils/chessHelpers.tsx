import type { Dests, Key } from "chessground/types";
import { Chess } from "chessops/chess";
import { makeSquare, parseSquare } from "chessops/util";
import { parseFen, makeFen } from "chessops/fen";
import '../App.css';

export function playSound(type: "move" | "capture" | "check") {
  const src = {
    move: "/sounds/move.mp3",
    capture: "/sounds/capture.mp3",
    check: "/sounds/check.mp3",
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

// highlights the king when its in check
export function getCheckHighlights(chess: Chess): Map<Key, string> {
  const highlights = new Map<Key, string>();
  if (chess.isCheck()) {
    const king = chess.board.kingOf(chess.turn);
    if (king) highlights.set(makeSquare(king), "check");
  }
  return highlights;
}

export function moveToUci(m: any) {
  const fromStr = makeSquare(m.from);
  const toStr = makeSquare(m.to);
  // map standard promotions to uci suffix; unknown roles skip suffix
  const promoMap: Record<string, string> = { queen: "q", rook: "r", bishop: "b", knight: "n" };
  const suffix = m.promotion && promoMap[m.promotion] ? promoMap[m.promotion] : "";
  return `${fromStr}${toStr}${suffix}`;
}
export function movesEqual(a: any, b: any) {
  return a?.from === b?.from && a?.to === b?.to && (a?.promotion ?? null) === (b?.promotion ?? null);
}
