import type { Dests, Key } from "chessground/types";
import { Chess } from "chessops/chess";
import { makeSquare, parseSquare } from "chessops/util";
import { parseFen } from "chessops/fen";
import '../App.css';

export function playSound(type: "move" | "capture" | "check" | "paint" | "wizard" | "archer" | "x_capture" | "snare" | "win" | "lose" | "draw") {
  const src = {
    move: "/sounds/move.mp3",
    capture: "/sounds/capture.mp3",
    check: "/sounds/check.mp3",
    paint: "/sounds/paint.mp3",
    wizard: "/sounds/wizard.mp3",
    archer: "/sounds/arrow.mp3",
    x_capture: "/sounds/x_capture.mp3",
    snare: "/sounds/snare.mp3",
    win: "/sounds/victory.mp3",
    lose: "/sounds/defeat.mp3",
    draw:"/sounds/draw.mp3"
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

export function playResultSound(result: string){
  if (result == 'win'){
    playSound('win');
  }
  else if (result == 'lose'){
    playSound('lose');
  }
  else if (result == 'draw'){
    playSound('draw');
  }

}

export function playMoveSound(
  chess: Chess,
  move: { from: number; to: number },
  from: string,
  to: string,
  preCaptured?: { color: string; role?: string } | null
) {
  const fromIdx = parseSquare(from)!;
  const toIdx = parseSquare(to)!;

  // moving piece: prefer fromIdx, fall back to toIdx
  const movingPiece = chess.board.get(fromIdx) ?? chess.board.get(toIdx);
  if (!movingPiece) return;

  const isPreMoveState = chess.board.get(fromIdx) !== undefined;

  // If caller provided the captured piece (best for remote updates), use it.
  // Otherwise, detect it from the pre-move board (when we have a pre-move chess).
  let capturedPiece: any | null = null;
  if (typeof preCaptured !== "undefined") {
    capturedPiece = preCaptured;
  } else {
    // Build a pre-move clone and inspect toIdx (works when the passed chess is pre-move).
    const preChess = Chess.fromSetup(chess.toSetup()).unwrap();
    capturedPiece = preChess.board.get(toIdx) ?? null;
  }

  // Build after-state (clone+play if caller passed a pre-move board)
  const afterChess = isPreMoveState ? Chess.fromSetup(chess.toSetup()).unwrap() : chess;
  if (isPreMoveState) {
    try {
      afterChess.play(move);
    } catch {
      // ignore
    }
  }

  const toFile = toIdx % 8;
  const toRankIdx = Math.floor(toIdx / 8);
  const fromRank = Math.floor(fromIdx / 8);

  const leftIdx = toFile > 0 ? toIdx - 1 : undefined;
  const rightIdx = toFile < 7 ? toIdx + 1 : undefined;
  const frontIdx = toRankIdx < 7 ? toIdx + 8 : undefined;
  const behindIdx = toRankIdx > 0 ? toIdx - 8 : undefined;

  const relIdxs =
    movingPiece.color === "white"
      ? [leftIdx, rightIdx, frontIdx]
      : [leftIdx, rightIdx, behindIdx];

  const neighbors = relIdxs.map((idx) =>
    idx !== undefined ? afterChess.board.get(idx) ?? null : null
  );

  const hasEnemyAdjacent = neighbors.some((n) => n !== null && n.color !== movingPiece.color);
  const hasEnemySnareAdjacent = neighbors.some(
    (n) => n !== null && n.color !== movingPiece.color && (n.role === "snare" || n.role === "rollingsnare")
  );

  const isSnaredMove =
    ((movingPiece.role === "snare" || movingPiece.role === "rollingsnare") && hasEnemyAdjacent) || hasEnemySnareAdjacent;

  const isCastleMove = 
    ((capturedPiece) && (capturedPiece.color === movingPiece.color));

  const isPawnCapture = 
    ((movingPiece.role === "pawn") && ((fromIdx % 8) !== (toIdx % 8)))
  // --- play sounds ---
  if (isPawnCapture){
    playSound("capture");
  }
  else if (capturedPiece) {
    if (movingPiece.role === "painter" || movingPiece.role === "royalpainter") playSound("paint");
    else if (movingPiece.role === "wizard" && capturedPiece.color === movingPiece.color)
      playSound("wizard");
    else if (movingPiece.role === "archer" && Math.abs(toRankIdx - fromRank) > 1) {
      playSound("archer");
      playSound("x_capture");
    } 
    else if (isCastleMove){
      playSound("move");
    }
    else playSound("capture");

    if (afterChess.isCheck()) playSound("check");
    if (isSnaredMove) playSound("snare");
  } else {
    if (afterChess.isCheck()) playSound("check");
    playSound("move");
    if (isSnaredMove) playSound("snare");
  }
}


