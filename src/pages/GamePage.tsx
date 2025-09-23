// src/pages/GamePage.tsx
import { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { calculateDests } from "../utils/chessHelpers";
import { useGameSocket } from "../hooks/useGameSocket";
import { parseSquare, makeSquare  } from "chessops/util";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<any>(null);
  const chessRef = useRef<Chess>(Chess.default());

  // --- roomId & FEN state ---
  const roomId = "test-room"; // replace with dynamic ID if needed
const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const [fen, setFen] = useState<string>(startFen);

  // --- connect to WS ---
  const { sendFen } = useGameSocket(roomId, (newFen) => {
    setFen(newFen);
  });

// --- initialize Chessground ---
useEffect(() => {
  if (!containerRef.current) return;

  console.log("Initializing Chessground with FEN:", fen);

  // try parsing FEN with chessops first
  try {
    const parsed = parseFen(fen);
    if (parsed.isErr) {
      console.error("parseFen failed:", parsed.error);
    } else {
      console.log("parseFen successful:", parsed.unwrap());
    }
  } catch (err) {
    console.error("Exception during parseFen:", err);
  }

  const config: Config = {
    fen,
    orientation: "white",
    highlight: { lastMove: true, check: true },
    movable: {
      color: "white",
      free: false,
      showDests: true,
      dests: calculateDests(chessRef.current),
      events: {
        after: (from: string, to: string) => {
          const fromSquare = parseSquare(from);
          const toSquare = parseSquare(to);
          console.log("Move attempt:", { from, to, fromSquare, toSquare });

          if (fromSquare === undefined || toSquare === undefined) {
            console.warn("Invalid move: parseSquare returned undefined");
            return;
          }

          const move = { from: fromSquare, to: toSquare };
          if (chessRef.current.isLegal(move)) {
            chessRef.current.play(move);
            const newFen = makeFen(chessRef.current.toSetup());
            console.log("Move applied, new FEN:", newFen);

            groundRef.current.set({
              fen: newFen,
              turnColor: chessRef.current.turn,
              movable: { dests: calculateDests(chessRef.current) },
            });

            sendFen(newFen);
          } else {
            console.warn("Move is not legal:", move);
          }
        },
      },
    },
  };

  groundRef.current = Chessground(containerRef.current, config);

  return () => {
    groundRef.current?.destroy();
  };
}, [fen, sendFen]);


  // --- apply incoming FEN updates from server ---
  useEffect(() => {
    if (!fen || !groundRef.current) return;

    const setup = parseFen(fen).unwrap();
    const newChess = Chess.fromSetup(setup).unwrap();
    chessRef.current = newChess;

    groundRef.current.set({
      fen,
      turnColor: newChess.turn,
      movable: {
        color: newChess.turn,
        showDests: true,
        dests: calculateDests(newChess),
      },
    });
  }, [fen]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Multiplayer Game</h2>
      <div
        ref={containerRef}
        className="cg-wrap"
        style={{ width: 600, height: 600 }}
      />
      <div style={{ marginTop: 10, fontFamily: "monospace" }}>
        Synced FEN: {fen}
      </div>
    </div>
  );
}
