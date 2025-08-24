import { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseSquare, makeSquare } from "chessops/util";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";
import { playSound } from "../utils/chessHelpers";
import type { Dests, Key } from "chessground/types";
import { createChessInstance, calculateDests, getCheckHighlights } from "../utils/chessHelpers";
import { defaultGame, Node, ChildNode, extend, makePgn } from 'chessops/pgn';
import type { PgnNodeData, Game } from 'chessops/pgn';
import { makeSan } from 'chessops/san';
import '../App.css';
 


type KnookProps = {
  initialFen?: string;
  orientation?: "white" | "black";
  onMove?: (from: string, to: string) => void;
};

export default function Knook({
  initialFen = "start",
  orientation = "white",
  onMove,
}: KnookProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<any>(null);
  const [fen, setFen] = useState(initialFen);
  const [chess, setChess] = useState<Chess | null>(null);
  const pgnRef = useRef<Game<PgnNodeData>>( defaultGame<PgnNodeData>() );
  const currentNodeRef = useRef<Node<PgnNodeData>>(pgnRef.current.moves);
  const [currentOrientation, setCurrentOrientation] = useState<"white" | "black">(orientation);
  const [pendingPromotion, setPendingPromotion] = useState<{
  from: string;
  to: string;
  color: "white" | "black";
} | null>(null);

// Handle move
const handleMove = (from: string, to: string) => {
  if (!chess) return;

  const fromSquare = parseSquare(from);
  const toSquare = parseSquare(to);
  if (fromSquare === undefined || toSquare === undefined) return;

  const move: any = { from: fromSquare, to: toSquare };
  const fromPiece = chess.board.get(fromSquare);
  const toRank = Math.floor(toSquare / 8);

  // INTERCEPT promotion
  if (fromPiece?.role === "pawn" && (toRank === 0 || toRank === 7)) {
    setPendingPromotion({ from, to, color: chess.turn });
    return; // wait for modal
  }

  playMove(move, from, to);
};

// Play a move helper
const playMove = (move: any, from: string, to: string) => {
  if (!chess) return;

  if (!chess.isLegal(move)) {
    groundRef.current?.set({ fen: makeFen(chess.toSetup()) });
    return;
  }

  const captured = chess.board.get(parseSquare(to)!);

  // PGN
  const san = makeSan(chess, move);
  if (!currentNodeRef.current.children.some(child => child.data.san === san)) {
    currentNodeRef.current = extend(currentNodeRef.current, [{ san }]);
  }

  chess.play(move);
  const newFen = makeFen(chess.toSetup());
  setFen(newFen);
  onMove?.(from, to);

  // Sounds
  if (chess.isCheck()) {
    if (captured) playSound("capture");
    else playSound("move");
    playSound("check");
  } else if (captured) {
    playSound("capture");
  } else {
    playSound("move");
  }

  // Update Chessground
  const newDests = calculateDests(chess);
  groundRef.current?.set({
    fen: newFen,
    movable: { color: chess.turn, dests: newDests, events: { after: handleMove }, free: false, showDests: true },
    lastMove: [from, to],
    highlight: { check: true, custom: getCheckHighlights(chess) }
  });
};

// Called from modal when piece is picked
const promotePawn = (role: "queen" | "rook" | "bishop" | "knight") => {
  if (!pendingPromotion || !chess) return;

  const { from, to } = pendingPromotion;
  const move: any = { from: parseSquare(from), to: parseSquare(to), promotion: role };

  playMove(move, from, to);
  setPendingPromotion(null);
};


  // Initialize chessops Chess instance
  useEffect(() => {
    let newChess: Chess;
    if (initialFen === "start") {
      newChess = Chess.default();
    } else {
      const setup = parseFen(initialFen).unwrap(); // parseFen() returns Result<Setup, FenError>
      newChess = Chess.fromSetup(setup).unwrap();
    }
    setChess(newChess);
    setFen(makeFen(newChess.toSetup()));
  }, [initialFen]);

  //initialize chessground instance
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
      turnColor: chess.turn,
      orientation: currentOrientation,
      highlight: {
        lastMove: true,
        check: true,
      },
      movable: {
        color: chess.turn, 
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
    console.log("FEN passed to Chessground:", makeFen(chess.toSetup()));
    console.log("movable.color:", chess.turn);
    console.log("dests keys:", [...calculateDests(chess).keys()]);

    return () => {
      // clean up on unmount
      groundRef.current?.destroy();
      groundRef.current = null;
    };
  }, [currentOrientation, chess]);

const resetBoard = () => {
  if (!chess) return;

  // Create a fresh Chess instance (your custom starting FEN)
  const newChess = createChessInstance("1k6/6P1/8/8/8/8/5p2/1K6 w - - 0 1");
  setChess(newChess);

  const newFen = makeFen(newChess.toSetup());
  setFen(newFen);

  if (!groundRef.current) return;

  const dests = calculateDests(newChess);

  groundRef.current.set({
    fen: newFen,
    lastMove: undefined,
    orientation: currentOrientation, // preserve current board orientation
    movable: {
      color: newChess.turn, // use the new chess instance's turn
      free: false,
      dests,
      showDests: true,
      events: { after: handleMove! },
    },
  });

  // Reset PGN tracking
  pgnRef.current = defaultGame<PgnNodeData>();
  currentNodeRef.current = pgnRef.current.moves;
};

  const flipBoard = () => {
  if (!groundRef.current) return;

  const newOrientation = currentOrientation === "white" ? "black" : "white";
  setCurrentOrientation(newOrientation);

  // Update chessground with new orientation
  groundRef.current.set({ orientation: newOrientation });
};

  return (
   <div style={{ position: "relative" }}>
  <div
    ref={containerRef}
    className="cg-wrap"
    style={{ width: 600, height: 600 }}
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
    <button onClick={resetBoard} style={{ marginRight: 10 }}>
      Reset Board
    </button>
    <button onClick={flipBoard} style={{ marginRight: 10 }}>
      Flip Board
    </button>
  </div>

  {/* Promotion modal */}
{pendingPromotion && (
  <div
onClick={() => {
  if (chess && groundRef.current) {
    // Stop any ongoing move/drag inside Chessground
    groundRef.current.stop?.();

    const newFen = makeFen(chess.toSetup());
    const dests = calculateDests(chess);

    // Fully reset Chessground state
    groundRef.current.set({
      fen: newFen,
      turnColor: chess.turn,
      lastMove: undefined,
      movable: {
        color: chess.turn,
        free: false,
        showDests: true,
        dests,
        events: { after: handleMove },
      },
      highlight: { check: true, custom: getCheckHighlights(chess) },
    });
  }

  // Clear pending promotion state
  setPendingPromotion(null);
}}

    style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 900, backgroundColor: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
      style={{
        backgroundColor: "white",
        border: "2px solid black",
        borderRadius: "8px",
        padding: 10,
        zIndex: 1000,
        display: "flex",
        gap: 10,
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
      }}
    >
      {["queen", "rook", "bishop", "knight", "knook", "knishop"].map(role => (
        <button
          key={role}
          onClick={() => promotePawn(role as any)}
          style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
        >
          <div
            className={`cg-piece ${role} ${pendingPromotion.color}`}
            style={{ width: 45, height: 45 }}
          />
        </button>
      ))}
    </div>
  </div>
)}

</div>

  );
}
