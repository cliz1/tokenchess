import { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "../../chessops/src/chess.ts";
import { parseFen, makeFen } from "../../chessops/src/fen.ts";
import { parseSquare, makeSquare } from "../../chessops/src/util.ts";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import { playSound } from "../utils/chessHelpers";
import type { Dests, Key } from "chessground/types";


type AnalysisBoardProps = {
  initialFen?: string;
  orientation?: "white" | "black";
  onMove?: (from: string, to: string) => void;
};

export default function AnalysisBoard({
  initialFen = "start",
  orientation = "white",
  onMove,
}: AnalysisBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<any>(null);
  const [fen, setFen] = useState(initialFen);
  const [chess, setChess] = useState<Chess | null>(null);

   //move handling function
  const handleMove = (from: string, to: string) => {
    console.log("called")
     if (!chess) return;
    console.log(`Move attempted: ${from} to ${to}`);
    const fromSquare = parseSquare(from);
    const toSquare = parseSquare(to);
    if (fromSquare !== undefined && toSquare !== undefined) {
      const move = { from: fromSquare, to: toSquare };
      if (chess?.isLegal(move)) {
        const captured = chess.board.get(toSquare);
        chess.play(move);
        const newFen = makeFen(chess.toSetup());
        setFen(newFen);
        onMove?.(from, to);

        // Play sound
        if (chess.isCheck()) {
          playSound("check");
        } else if (captured) {
          playSound("capture");
        } else {
          playSound("move");
        }
        const ctx = chess.ctx();
        const newDests: Dests = new Map();
        for (const [from, targets] of chess.allDests(ctx)) {
          const fromStr: Key = makeSquare(from);
          const targetStrs: Key[] = [...targets].map(t => makeSquare(t));
          newDests.set(fromStr, targetStrs);
        }
        groundRef.current?.set({
          fen: newFen,
          movable: { color: chess.turn, dests:newDests },
          lastMove: [from, to],
        });
      } else {
        console.log("Move is not legal!");
        groundRef.current?.set({ fen: makeFen(chess.toSetup()) });
      }
    } else {
      console.log("Invalid squares:", { from, to, fromSquare, toSquare });
    }
  };

  // Initialize chessops Chess instance
  useEffect(() => {
    let newChess: Chess;
    if (initialFen === "start") {
      newChess = Chess.default();
    } else {
      const setup = parseFen(initialFen).unwrap();
      newChess = Chess.fromSetup(setup).unwrap();
    }
    setChess(newChess);
    setFen(makeFen(newChess.toSetup()));
  }, [initialFen]);

  useEffect(() => {
    if(!chess) return;
    const ctx = chess.ctx();
    const dests: Dests = new Map();
    for (const [from, targets] of chess.allDests(ctx)) {
      const fromStr = makeSquare(from);
      const targetStrs = [...targets].map(t => makeSquare(t));
      dests.set(fromStr, targetStrs);
    }

    if (!containerRef.current || !chess) return;

    const config: Config = {
      fen: makeFen(chess.toSetup()),
      orientation,
      highlight: {
        lastMove: true,
        check: true,
      },
      movable: {
        color: "both", 
        free: false, 
        showDests: true,
        dests,
        events: {
          after: handleMove
        }
      },
      animation: {
        enabled: true,
        duration: 300,
      },
      drawable: {
        enabled: true,
      },
      draggable:{
        enabled:true
      },
      events: {
        move: (from: string, to: string) => {
          console.log("Chessground move event:", from, to);
        },
        select: (key: string) => {
          console.log("Chessground select event:", key);
        },
      },
    };

    console.log("Creating chessground with config:", config);
    // create Chessground instance
    groundRef.current = Chessground(containerRef.current, config);
    console.log("Chessground instance created:", groundRef.current);

    return () => {
      // clean up on unmount
      groundRef.current?.destroy();
      groundRef.current = null;
    };
  }, [orientation, chess]);

  // Update fen externally (if needed)
  useEffect(() => {
    if (groundRef.current && chess) {
      const currentFen = makeFen(chess.toSetup());
      groundRef.current.set({ fen: currentFen });
    }
  }, [fen, chess]);


  return (
    <div>
      <div
        ref={containerRef}
        className="cg-wrap" 
        style={{ width: 600, height: 600 }}
        onClick={() => console.log("Board container clicked")}
      />
      <div style={{ marginTop: 10, fontFamily: "monospace" }}>
        Current FEN: {fen}
      </div>
      {chess && (
        <div style={{ marginTop: 5, fontFamily: "monospace" }}>
          Turn: {chess.turn === "white" ? "White" : "Black"}
          {chess.isCheck() && " (Check!)"}
          {chess.isCheckmate() && " (Checkmate!)"}
          {chess.isStalemate() && " (Stalemate!)"}
          {chess.isInsufficientMaterial() && " (Insufficient Material!)"}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <button 
          onClick={() => {
           const newChess = Chess.default(); // or fromSetup for a custom fen
setChess(newChess);
const newFen = makeFen(newChess.toSetup());
setFen(newFen);

const ctx = newChess.ctx();
const newDests: Dests = new Map();
for (const [from, targets] of newChess.allDests(ctx)) {
  const fromStr: Key = makeSquare(from);
  const targetStrs: Key[] = [...targets].map(t => makeSquare(t));
  newDests.set(fromStr, targetStrs);
}

if (groundRef.current) {
  groundRef.current.set({
    fen: newFen,
    lastMove: undefined,
    movable: {
      color: newChess.turn,
      free: false,
      dests: newDests,
      showDests: true,
      events: {
        after: handleMove,
      },
    },
  });
}
          }}
          style={{ marginRight: 10 }}
        >
          Reset Board
        </button>
        <button 
          onClick={() => {
            if (chess) {
              const ctx = chess.ctx();
              const allDests = chess.allDests(ctx);
              console.log("All legal moves:", allDests);
            }
          }}
        >
          Log Legal Moves
        </button>
      </div>
    </div>
  );
}
