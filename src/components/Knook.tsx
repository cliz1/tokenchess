import { useEffect, useRef, useState } from "react";
import type { JSX } from 'react'
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
import { createChessInstance, calculateDests, getCheckHighlights, moveToUci, movesEqual } from "../utils/chessHelpers";
import { defaultGame, extend, makePgn } from 'chessops/pgn';
import type { PgnNodeData, Game, Node as PNode, ChildNode as CNode } from 'chessops/pgn';
import { makeSan } from 'chessops/san';
import '../App.css';
 
type MyNodeData = PgnNodeData & { move: any; color: "white" | "black";};

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
  const pgnRef = useRef<Game<MyNodeData>>( defaultGame<MyNodeData>() );
  const currentNodeRef = useRef<PNode<MyNodeData>>(pgnRef.current.moves);
  const pathRef = useRef<Array<PNode<MyNodeData> | CNode<MyNodeData>>>([pgnRef.current.moves]);
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
  if ((fromPiece?.role === "pawn" || fromPiece?.role === "painter") && (toRank === 0 || toRank === 7)) {
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

  // PGN: store SAN (if available) and the raw move object for replay
  let san = "";
  try {
    san = makeSan(chess, move);
  } catch {
    san = moveToUci(move); // fallback if SAN can’t be made (custom pieces, etc.)
  }
  const color = chess.turn;
  // find or create the next node
  let nextNode = currentNodeRef.current.children.find(
    (child) => child.data.san === san && movesEqual(child.data.move, move)
  );
  if (!nextNode) {
    // chessops/pgn extend mutates the parent; then we grab the new child
    extend(currentNodeRef.current, [{ san, move, color } as any]);
    nextNode = currentNodeRef.current.children.find(
      (child) => child.data.san === san && movesEqual(child.data.move, move)
    )!;
  }
  currentNodeRef.current = nextNode;
  pathRef.current = [...pathRef.current, nextNode];

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
          //console.log("Chessground move event:", from, to);
        },
        select: (key: string) => {
          //console.log("Chessground select event:", key);
        },
      },
    };
    // create Chessground instance
    groundRef.current = Chessground(containerRef.current, config);

    return () => {
      // clean up on unmount
      groundRef.current?.destroy();
      groundRef.current = null;
    };
  }, [currentOrientation, chess]);

const resetBoard = () => {
  if (!chess) return;

  // Create a fresh Chess instance (your custom starting FEN)
  const newChess = createChessInstance("start");
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
  pgnRef.current = defaultGame<MyNodeData>();
  currentNodeRef.current = pgnRef.current.moves;
  pathRef.current = [pgnRef.current.moves];
};

  const flipBoard = () => {
  if (!groundRef.current) return;

  const newOrientation = currentOrientation === "white" ? "black" : "white";
  setCurrentOrientation(newOrientation);

  // Update chessground with new orientation
  groundRef.current.set({ orientation: newOrientation });
};

function renderPgn(
  node: PNode<MyNodeData> | CNode<MyNodeData>,
  depth = 0,
  path: Array<PNode<MyNodeData> | CNode<MyNodeData>> = []
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  node.children.forEach((child, idx) => {
    const label = child.data.san ?? moveToUci(child.data.move);
    const newPath = [...path, child];
    elements.push(
      <span
        key={`${path.length}-${idx}-${label}`}
        onClick={() => goToNode(child, newPath)}
        style={{
          marginLeft: depth * 12,
          cursor: "pointer",
          fontWeight: child === currentNodeRef.current ? "bold" : "normal",
          display: "inline-block",
          marginRight: 6,
        }}
      >
        {label}
      </span>
    );
    elements.push(...renderPgn(child, depth + 1, newPath));
  });
  return elements;
}


function goToPath(path: Array<PNode<MyNodeData> | CNode<MyNodeData>>) {
  // rebuild from the same start position you used initially
  const newChess =
    initialFen === "start"
      ? Chess.default()
      : Chess.fromSetup(parseFen(initialFen).unwrap()).unwrap();

  for (const n of path.slice(1)) {
    const mv = (n as CNode<MyNodeData>).data.move;
    newChess.play(mv);
  }

  setChess(newChess);
  const newFen = makeFen(newChess.toSetup());
  setFen(newFen);
  currentNodeRef.current = path[path.length - 1] as any;
  pathRef.current = path;

  const dests = calculateDests(newChess);
  groundRef.current?.set({
    fen: newFen,
    movable: { color: newChess.turn, dests, events: { after: handleMove }, free: false, showDests: true },
    highlight: { check: true, custom: getCheckHighlights(newChess) },
  });
}

function goToNode(node: CNode<MyNodeData>, path: Array<PNode<MyNodeData> | CNode<MyNodeData>>) {
  goToPath(path);
}

function goToNext() {
  const curr = currentNodeRef.current;
  const child = curr.children[0];
  if (child) {
    goToNode(child, [...pathRef.current, child]);
  }
}

function goToPrev() {
  if (pathRef.current.length > 1) {
    const newPath = pathRef.current.slice(0, -1);
    goToPath(newPath);
  }
}

// --- Replace renderPgn + call site with the following ---

function getSan(node: PNode<MyNodeData> | CNode<MyNodeData>): string {
  if ("data" in node) {
    return node.data.san ?? moveToUci(node.data.move);
  }
  return ""; // root node has no SAN
}


/**
 * Build the mainline as an array of rows, where each row is a full move:
 * { moveNum, whiteNode, whitePath, blackNode?, blackPath?, whiteVariations[], blackVariations[] }
 */
function buildMainlineRows() {
  const root = pgnRef.current.moves;
  const rows: Array<any> = [];

  let parent = root; // start at root
  let parentPath: Array<PNode<MyNodeData> | CNode<MyNodeData>> = [root];
  let moveNum = 1;

  while (true) {
    const whiteNode = parent.children[0];
    if (!whiteNode) break;

    const whitePath = [...parentPath, whiteNode];

    // Variations that start at this ply (excluding the mainline child)
    const whiteVariations = parent.children.slice(1).map((v) => ({
      node: v,
      path: [...parentPath, v],
    }));

    // See if there is a black reply on the mainline
    const blackNode = whiteNode.children[0] ?? null;
    const blackPath = blackNode ? [...whitePath, blackNode] : null;

    // Black-side variations (siblings of blackNode under whiteNode)
    const blackVariations: Array<any> = [];
    if (whiteNode.children.length > 1) {
      // variations that branch from the black ply (i.e., children[1..])
      for (const v of whiteNode.children.slice(1)) {
        blackVariations.push({ node: v, path: [...whitePath, v] });
      }
    }

    rows.push({
      moveNum,
      whiteNode,
      whitePath,
      whiteVariations,
      blackNode,
      blackPath,
      blackVariations,
    });

    // advance parent to either blackNode (if exists) or whiteNode (if no black reply)
    parent = blackNode ?? whiteNode;
    parentPath = blackPath ?? whitePath;
    moveNum += 1;
  }

  return rows;
}

/** produce condensed text for a variation by following first-child chain */
function variationText(startNode: CNode<MyNodeData> | PNode<MyNodeData>, maxPly = 8) {
  const parts: string[] = [];
  let node: any = startNode;
  let count = 0;
  while (node && count < maxPly) {
    parts.push(getSan(node));
    node = node.children[0];
    count++;
  }
  return parts.join(" ");
}

/** Render a single variation line (small text, clickable) */
function renderVariation(v: { node: CNode<MyNodeData> | PNode<MyNodeData>; path: Array<any> }, keySuffix: string) {
  const text = variationText(v.node, 10);
  return (
    <div
      key={`var-${keySuffix}-${text}`}
      onClick={() => goToNode(v.node as any, v.path)}
      style={{
        fontSize: 12,
        color: "#cfcfcf",
        marginLeft: 8,
        marginTop: 2,
        cursor: "pointer",
      }}
      title={text}
    >
      ({text})
    </div>
  );
}

/** Render the whole move list as lines */
function renderMoveList() {
  const rows = buildMainlineRows();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((row) => {
        const whiteLabel = getSan(row.whiteNode);
        const blackLabel = row.blackNode ? getSan(row.blackNode) : null;

        return (
          <div key={`row-${row.moveNum}`} style={{ display: "flex", flexDirection: "column" }}>
            {/* Mainline row: "1. e4 e5" */}
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                lineHeight: "1.4",
                fontSize: 14,
              }}
            >
              <div style={{ minWidth: 28, textAlign: "right", color: "#ddd" }}>
                {row.moveNum}.
              </div>

              <div
                onClick={() => goToNode(row.whiteNode, row.whitePath)}
                style={{ cursor: "pointer", fontWeight: row.whiteNode === currentNodeRef.current ? "bold" : "normal" }}
                title={whiteLabel}
              >
                {whiteLabel}
              </div>

              {blackLabel ? (
                <div
                  onClick={() => row.blackNode && goToNode(row.blackNode, row.blackPath)}
                  style={{ cursor: "pointer", fontWeight: row.blackNode === currentNodeRef.current ? "bold" : "normal" }}
                  title={blackLabel}
                >
                  {blackLabel}
                </div>
              ) : (
                <div style={{ color: "#777" }} />
              )}
            </div>

            {/* Variations for the white ply (small, beneath the mainline row) */}
            <div style={{ display: "flex", gap: 8, marginLeft: 36, flexWrap: "wrap" }}>
              {row.whiteVariations.map((v: any, idx: number) => renderVariation(v, `w-${row.moveNum}-${idx}`))}
            </div>

            {/* Variations for the black ply (small, beneath the mainline row) */}
            <div style={{ display: "flex", gap: 8, marginLeft: 36, marginTop: 2, flexWrap: "wrap" }}>
              {row.blackVariations.map((v: any, idx: number) => renderVariation(v, `b-${row.moveNum}-${idx}`))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

  return (
<div style={{ position: "relative", display: "flex", gap: "20px" }}>
  {/* Board Section */}
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
      <button onClick={flipBoard} style={{ marginRight: 10 }}>
        Flip Board
      </button>
    </div>
  </div>

  {/* PGN & Controls Section */}
  <div style={{ width: 320, fontFamily: "monospace" }}>
    <div style={{ marginBottom: 8, fontWeight: "bold" }}>Move List:</div>
    <div
      className="pgn-tree"
      style={{
        padding: 8,
        border: "1px solid #ccc",
        borderRadius: 6,
        maxHeight: 500,
        overflowY: "auto",
        fontSize: 14,
        backgroundColor: "#151515ff",
        whiteSpace: "normal",
      }}
    >
      {renderMoveList()}
    </div>
    <div style={{ marginTop: 10 }}>
      <button onClick={() => goToPrev()} style={{ marginRight: 10 }}>
        Prev
      </button>
      <button onClick={() => goToNext()}>Next</button>
    </div>
  </div>

  {/* Promotion Modal */}
  {pendingPromotion && (
    <div
      onClick={() => {
        if (chess && groundRef.current) {
          groundRef.current.stop?.();

          const newFen = makeFen(chess.toSetup());
          const dests = calculateDests(chess);

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

        setPendingPromotion(null);
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 900,
        backgroundColor: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "white",
          border: "2px solid black",
          borderRadius: "8px",
          padding: 10,
          zIndex: 1000,
          display: "flex",
          gap: 10,
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
        }}
      >
        {["queen", "rook", "bishop", "knight", "knook", "knishop"].map(
          (role) => (
            <button
              key={role}
              onClick={() => promotePawn(role as any)}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
              }}
            >
              <div
                className={`cg-piece ${role} ${pendingPromotion.color}`}
                style={{ width: 45, height: 45 }}
              />
            </button>
          )
        )}
      </div>
    </div>
  )}
</div>

  );
}
