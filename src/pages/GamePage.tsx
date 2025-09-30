// src/pages/GamePage.tsx
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { calculateDests } from "../utils/chessHelpers";
import { useGameSocket } from "../hooks/useGameSocket";
import type { GameUpdate } from "../hooks/useGameSocket";
import { parseSquare } from "chessops/util";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<any>(null);
  const chessRef = useRef<Chess>(Chess.default());

  // --- roomId & FEN state ---
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room") ?? "test-room";
  const startFen =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const [fen, setFen] = useState<string>(startFen);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);

  // player metadata from server
  const [role, setRole] = useState<"player" | "spectator">("spectator");
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null);

  // --- connect to WS ---
  const { sendMove } = useGameSocket(roomId, (update: GameUpdate) => {
    if (update.role) setRole(update.role);
    if (update.color) setPlayerColor(update.color);
    if (update.fen === fen) return;

    const setup = parseFen(update.fen).unwrap();
    chessRef.current = Chess.fromSetup(setup).unwrap();

    setFen(update.fen);
    if (update.lastMove) setLastMove(update.lastMove);
  });

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
      animation: {enabled: true, duration: 300},
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

            // optimistic local apply
            chessRef.current.play(move);
            const newFen = makeFen(chessRef.current.toSetup());
            setFen(newFen);
            setLastMove([from, to]);

            // send only lastMove; server will validate & broadcast canonical FEN
            sendMove([from, to]);
          },
        },
      },
      lastMove: lastMove ?? undefined, // include together with fen for animation
    });
  }, [fen, lastMove, playerColor, role, sendMove]);

  return (
    <div style={{ padding: 20 }}>
      <div
        ref={containerRef}
        className="cg-wrap"
        style={{ width: 600, height: 600 }}
      />
      <div style={{ marginTop: 10, fontFamily: "monospace" }}>
        Synced FEN: {fen} — role: {role}{" "}
        color: {playerColor ? `(${playerColor})` : ""} Room: {roomId}
      </div>
    </div>
  );
}
