// src/pages/GamePage.tsx
import { useEffect, useRef, useState } from "react";
import { useSearchParams} from "react-router-dom";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { calculateDests } from "../utils/chessHelpers";
import { useGameSocket } from "../hooks/useGameSocket";
import type { GameUpdate } from "../hooks/useGameSocket";
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
const [searchParams] = useSearchParams();
const roomId = searchParams.get("room") ?? "test-room";
const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const [fen, setFen] = useState<string>(startFen);
const [lastMove, setLastMove] = useState<[string,string] | null>(null);

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
    console.log("Received update:", update);
    setFen(update.fen);
    if (update.lastMove) setLastMove(update.lastMove);
  });

// --- initialize Chessground ---
useEffect(() => {
  if (!containerRef.current) return;

  //console.log("Initializing Chessground with FEN:", fen);

  // try parsing FEN with chessops first
  try {
    const parsed = parseFen(fen);
    if (parsed.isErr) {
      console.error("parseFen failed:", parsed.error);
    } else {
      //console.log("parseFen successful:", parsed.unwrap());
    }
  } catch (err) {
    console.error("Exception during parseFen:", err);
  }

  const config: Config = {
    fen,
    orientation: playerColor ?? "white",
    highlight: { lastMove: true, check: true },
    movable: {
      color: playerColor ?? chessRef.current.turn,
      free: false,
      showDests: true,
      dests: calculateDests(chessRef.current),
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
  };

  groundRef.current = Chessground(containerRef.current, config);

  return () => {
    groundRef.current?.destroy();
  };
}, [fen, sendMove, playerColor, role]);


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
        color: playerColor ?? newChess.turn,
        showDests: true,
        dests: calculateDests(newChess),
      },
    });
  }, [fen, playerColor]);

  useEffect(() => {
  if (!groundRef.current || !lastMove) return;

  groundRef.current.set({ lastMove });
}, [lastMove]);

  return (
    <div style={{ padding: 20 }}>
      <div
        ref={containerRef}
        className="cg-wrap"
        style={{ width: 600, height: 600 }}
      />
      <div style={{ marginTop: 10, fontFamily: "monospace" }}>
        Synced FEN: {fen} — role: {role} {playerColor ? `(${playerColor})` : ""} Room: {roomId}
      </div>
    </div>
  );
}