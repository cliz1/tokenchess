// src/pages/GamePage.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { calculateDests } from "../utils/chessHelpers";
import { useGameSocket } from "../hooks/useGameSocket";
import type { GameUpdate } from "../hooks/useGameSocket";
import { parseSquare } from "chessops/util";
import { getCheckHighlights, playMoveSound } from "../utils/chessHelpers";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<any>(null);
  const chessRef = useRef<Chess>(Chess.default());
  const navigate = useNavigate();

  // --- roomId & FEN state ---
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room") ?? "test-room";
  const startFen =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const [fen, setFen] = useState<string>(startFen);
  const fenRef = useRef<string>(startFen); // <- synchronous reference
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const lastMoveRef = useRef<[string, string] | null>(null); // <- synchronous reference

  const [gameResult, setGameResult] = useState<null | "1-0" | "0-1" | "1/2-1/2" | "ongoing">(null);

  // player metadata from server
  const [role, setRole] = useState<"player" | "spectator">("spectator");
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null);

  // --- stable WS callback that uses refs to detect duplicates ---
const onGameUpdate = useCallback((update: GameUpdate) => {
  if (update.role) setRole(update.role);
  if (update.color) setPlayerColor(update.color);
  // quick refs for current known state
  const prevFen = fenRef.current;
  const prevLast = lastMoveRef.current;
  // duplicate/echo detection
  const sameFen = update.fen === prevFen;
  const sameLastMove =
    update.lastMove &&
    prevLast &&
    update.lastMove[0] === prevLast[0] &&
    update.lastMove[1] === prevLast[1];
  if (sameFen && sameLastMove && !update.result) {
    // echo of our own move — ignore entirely
    return;
  }
  // build the AFTER-state chess from update.fen (if fen changed),
  // but compute pre-move captured piece from prevFen if possible
  let newChess = chessRef.current;
  // Parse squares early
  let fromStr: string | undefined;
  let toStr: string | undefined;
  if (update.lastMove) {
    fromStr = update.lastMove[0];
    toStr = update.lastMove[1];
  }
  // Pre-captured detection: attempt to read from previous fen (prevFen)
  let preCaptured: any | null = null;
  if (update.lastMove && prevFen) {
    try {
      const prevSetup = parseFen(prevFen).unwrap();
      const preChess = Chess.fromSetup(prevSetup).unwrap();
      const toSq = parseSquare(toStr!);
      if (toSq !== undefined) preCaptured = preChess.board.get(toSq) ?? null;
    } catch (e) {
      // fail silently, leave preCaptured null
      preCaptured = null;
    }
  }
  // Build AFTER-state chess (from the incoming fen) if fen changed
  if (update.fen !== prevFen) {
    try {
      const setup = parseFen(update.fen).unwrap();
      newChess = Chess.fromSetup(setup).unwrap();
    } catch (e) {
      // if parsing fails, fallback to current chessRef
      newChess = chessRef.current;
    }
  }
  // update local chessRef and fen state if fen changed
  if (update.fen !== prevFen) {
    chessRef.current = newChess;
    setFen(update.fen);
    fenRef.current = update.fen;
  }
  if (update.lastMove) {
    const [from, to] = update.lastMove;
    const fromSq = parseSquare(from);
    const toSq = parseSquare(to);
    if (fromSq !== undefined && toSq !== undefined) {
      const move = { from: fromSq, to: toSq };
      // Only play sound if this wasn't detected as our own move above
      if (!sameLastMove) {
        playMoveSound(newChess, move, from, to, preCaptured);
      }
      setLastMove(update.lastMove);
      lastMoveRef.current = update.lastMove;
    }
  }
  if (update.result) {
    setGameResult(update.result as "1-0" | "0-1" | "1/2-1/2" | "ongoing");
  } else {
    setGameResult(null);
  }
  if (update.fen === startFen) {
  setLastMove(null);
  lastMoveRef.current = null; // clear last game's move highlights
}
}, []); // uses refs; safe to keep empty deps

  // --- connect to WS (pass the stable callback) ---
  const { sendMove, sendLeave, sendRematch, sendResign, sendDraw } = useGameSocket(roomId, onGameUpdate);

  // --- initialize Chessground ---
  useEffect(() => {
    if (!containerRef.current) return;

    groundRef.current = Chessground(containerRef.current, {
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true },
    } as Config);

    return () => {
      groundRef.current?.destroy();
    };
  }, []);

  // --- update Chessground ---
  useEffect(() => {
    if (!groundRef.current) return;

    const setup = parseFen(fen).unwrap();
    const newChess = Chess.fromSetup(setup).unwrap();
    chessRef.current = newChess;

    groundRef.current.set({
      fen,
      turnColor: newChess.turn,
      animation: { enabled: true, duration: 300 },
      orientation: playerColor ?? "white",
      highlight: { check: true, custom: getCheckHighlights(newChess) },
      movable: {
        color: playerColor ?? newChess.turn,
        dests: calculateDests(newChess),
        showDests: true,
        events: {
          after: (from: string, to: string) => {
          if (role !== "player") return; // spectators cannot move
          const fromSq = parseSquare(from);
          const toSq = parseSquare(to);
          if (!fromSq || !toSq) return;
          const move = { from: fromSq, to: toSq };
          if (!chessRef.current.isLegal(move)) return;
          // --- compute preCaptured from the current (pre-move) local board ---
          const preCaptured = chessRef.current.board.get(toSq) ?? null;
          playMoveSound(chessRef.current, move, from, to, preCaptured);
          // Optimistically apply the move locally
          chessRef.current.play(move);
          // Build and set FEN 
          const newFen = makeFen(chessRef.current.toSetup());
          setFen(newFen);
          fenRef.current = newFen;
          // update lastMove and its ref (synchronous marker for duplicate detection)
          setLastMove([from, to]);
          lastMoveRef.current = [from, to];
          sendMove([from, to]);
        }
        },
      },
      lastMove: lastMove ?? undefined,
    });
  }, [fen, lastMove, role, playerColor, sendMove]);

const handleLeave = () => {
  sendLeave(); 
  navigate("/");  
};

return (
  <div style={{ padding: 20 }}>
       <div style={{ marginTop: 10, fontFamily: "monospace" }}>
     Room: {roomId}
    </div>
    <div ref={containerRef} className="cg-wrap" style={{ width: 600, height: 600 }} />
       {role === "player" && !gameResult && (
    <div style={{ marginTop: 20 }}>
    <button onClick={sendResign}>Resign</button>
    <button onClick={sendDraw}>Draw</button>
      </div>
  )}
    {gameResult && role === "player" && (
      <div style={{ marginTop: 20 }}>
        <div>Game Over: {gameResult}</div>
        <button onClick={() => sendRematch()}>Rematch</button>
        <button onClick={handleLeave}>Leave</button>
      </div>
    )}
  </div>
);
}