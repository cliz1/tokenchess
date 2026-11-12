import type { Dests, Key } from "chessground/types";
import { Chess } from "chessops/chess";
import { makeSquare, parseSquare } from "chessops/util";
import { parseFen } from "chessops/fen";
import '../App.css';
import { playSound, packHasSound } from "./sounds";

// An archer that STEPS (doesn't shoot) onto its far rank auto-promotes to a centaur.
// Mirrors the rule in chessops' isLegal, which rejects the move without promotion: "centaur".
export function archerAutoPromotion(
  piece: { role: string; color: string } | undefined | null,
  fromSq: number,
  toSq: number,
): "centaur" | null {
  if (piece?.role !== "archer") return null;
  const fd = Math.abs((toSq & 7) - (fromSq & 7));
  const rd = Math.abs((toSq >> 3) - (fromSq >> 3));
  const isShot = Math.max(fd, rd) > 1 && fd === rd;
  return !isShot && (toSq >> 3) === (piece.color === "white" ? 7 : 0) ? "centaur" : null;
}

// Front-end display names for piece roles whose displayed name differs from
// their internal role slug (which stays as-is to avoid touching fen/chessops/chessground).
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  mann: "Baker",
  royalpainter: "Royal Painter",
  rollingsnare: "Rolling Snare",
};

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

// highlights the royal piece (king or general) when it's in check
export function getCheckHighlights(chess: Chess): Map<Key, string> {
  const highlights = new Map<Key, string>();
  if (chess.isCheck()) {
    const king = chess.board.royalOf(chess.turn);
    if (king !== undefined) highlights.set(makeSquare(king), "check");
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

export function playResultSound(result: string) {
  if (result === "win" || result === "lose" || result === "draw") playSound("result");
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

  const fromPiece = chess.board.get(fromIdx)
  const toPiece = chess.board.get(toIdx)

  // Determine moving piece robustly for both pre-move (local) and post-move (remote) states.
  let movingPiece: any | null = null;
  // If fromPiece exists and its color matches chess.turn, we are probably in pre-move (mover still at "from").
  if (fromPiece && fromPiece.color === chess.turn) {
    movingPiece = fromPiece;
  }
  // Otherwise, if toPiece exists and its color is NOT chess.turn, we are likely in post-move (mover now at "to").
  else if (toPiece && toPiece.color !== chess.turn) {
    movingPiece = toPiece;
  }
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
  const fromFile = fromIdx % 8;
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
  
  const relIdxsRS = [leftIdx, rightIdx, frontIdx, behindIdx] // rolling snares snare in all 4 directions orthogonally
  const RSneighbors = relIdxsRS.map((idx) => 
    idx !== undefined ? afterChess.board.get(idx) ?? null : null 
  );

  const neighbors = relIdxs.map((idx) =>
    idx !== undefined ? afterChess.board.get(idx) ?? null : null
  );

  const hasEnemyAdjacent = neighbors.some((n) => n !== null && n.color !== movingPiece.color);
  const hasEnemySnareAdjacent = neighbors.some(
    (n) => n !== null && n.color !== movingPiece.color && (n.role === "snare")
  );

  const RShasEnemyAdjacent = RSneighbors.some((n) => n !== null && n.color !== movingPiece.color);
  const hasEnemyRSAdjacent = RSneighbors.some(
    (n) => n !== null && n.color !== movingPiece.color && (n.role === "rollingsnare")
  );
  const isSnaredMove =
    (((movingPiece.role === "snare" && hasEnemyAdjacent) || hasEnemySnareAdjacent) || ((movingPiece.role === "rollingsnare" && RShasEnemyAdjacent) || hasEnemyRSAdjacent));

  const isCastleMove = 
    ((capturedPiece) && (capturedPiece.color === movingPiece.color && movingPiece.role !== "wizard"));

  const isPawnCapture = 
    ((movingPiece.role === "pawn") && ((fromIdx % 8) !== (toIdx % 8)))
  // --- play sounds ---
  // Special-mechanic effects only exist in some packs; others fall back to a plain sound.
  const role = movingPiece.role as string;
  const special = (ev: "paint" | "wizard" | "archer", fallback: "move" | "capture" | "castle") =>
    playSound(packHasSound(ev) ? ev : fallback, { role });

  if (isPawnCapture) {
    playSound("capture", { role });
  } else if (capturedPiece) {
    if (role === "painter" || role === "royalpainter") special("paint", "capture");
    else if (role === "wizard" && capturedPiece.color === movingPiece.color)
      special("wizard", "castle");
    else if (role === "archer" && Math.abs(toRankIdx - fromRank) > 1) special("archer", "capture");
    else if (role === "centaur" && Math.abs(toFile - fromFile) === Math.abs(toRankIdx - fromRank)) {
      // centaur's ranged diagonal shot (its knight-move deltas never satisfy file===rank distance)
      special("archer", "capture");
    }
    else if (isCastleMove) playSound("castle", { role });
    else playSound("capture", { role });

    if (isSnaredMove) playSound("snare");
  } else {
    playSound("move", { role });
    if (isSnaredMove) playSound("snare");
  }
}


