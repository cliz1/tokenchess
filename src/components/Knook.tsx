import { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "../../chessops/src/chess.ts";
import { parseFen, makeFen } from "../../chessops/src/fen.ts";
import { parseSquare, makeSquare } from "../../chessops/src/util.ts";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";
import { playSound } from "../utils/chessHelpers";
import type { Dests, Key } from "chessground/types";
import { createChessInstance, calculateDests, getCheckHighlights } from "../utils/chessHelpers";
import { defaultGame, Node, ChildNode, extend, makePgn } from '../../chessops/src/pgn';
import type { PgnNodeData, Game } from '../../chessops/src/pgn';
import { makeSan } from '../../chessops/src/san';
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
   //move handling function
  const handleMove = (from: string, to: string) => {
     if (!chess) return;
    console.log(`Move attempted: ${from} to ${to}`);
    const fromSquare = parseSquare(from);
    const toSquare = parseSquare(to);
    if (fromSquare !== undefined && toSquare !== undefined) {
      const move = { from: fromSquare, to: toSquare };
      if (chess?.isLegal(move)) {
        const captured = chess.board.get(toSquare);
        // TEST: BEFORE PLAYING MOVE
        //// PGN HANDLING
        // 1. make a san of the move
        const san = makeSan(chess, move); 
        // BEFORE ADDING NODE, CHECK IF IT IS THE MAIN LINE FOR THIS MOVE, OR, AN EXISTING SIDELINE
        const moveAlreadyExists = currentNodeRef.current.children.some(
        (child) => child.data.san == san
        );
        // 2. append the san to PGN
        if (!moveAlreadyExists){
        currentNodeRef.current = extend(currentNodeRef.current, [{san}]);}
        // 3. print the new PGN, stripping the header
        const pgnText = makePgn(pgnRef.current)
        console.log(pgnText)
        // END TEST
        chess.play(move);
        const newFen = makeFen(chess.toSetup());
        setFen(newFen);
        onMove?.(from, to); // notifies App.tsx that a move was made so it can log to console
        // Play sound
         if (chess.isCheck()) {
          if (captured) {playSound("capture");} 
          else {playSound("move");}
          playSound("check");
        } 
        else if (captured){
          playSound("capture");
        }
        else {
          playSound("move");
        }
        const newDests = calculateDests(chess);
        groundRef.current?.set({
          fen: newFen,
          movable: { color: chess.turn, dests:newDests, events: { after: handleMove }, free: false, showDests: true },
          lastMove: [from, to],
          highlight: {check: true, custom : getCheckHighlights(chess)}
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
      orientation,
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
  }, [orientation, chess]);

/*   // Update fen externally (if needed)
  useEffect(() => {
    if (groundRef.current && chess) {
      const currentFen = makeFen(chess.toSetup());
      groundRef.current.set({ fen: currentFen });
    }
  }, [fen, chess]); */

  const resetBoard = () => {
  if (!chess) return;
  const newChess = createChessInstance("4k2r/5ppp/8/8/8/8/5PPP/H3K2H w KQkq - 0 1");
  setChess(newChess);
  setFen(makeFen(newChess.toSetup()));
  if (!groundRef.current) return;
  const dests = calculateDests(newChess);
  groundRef.current.set({
    fen: makeFen(newChess.toSetup()),
    lastMove: undefined,
    movable: {
      color: chess.turn,
      free: false,
      dests,
      showDests: true,
      events: { after: handleMove! },
      },
    });
    pgnRef.current = defaultGame<PgnNodeData>();
    currentNodeRef.current = pgnRef.current.moves; // reset node for PGN 
  };


  return (
    <div>
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
