import { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseSquare, makeSquare  } from "chessops/util";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";
import type { Dests } from "chessground/types";
import { calculateDests, getCheckHighlights, moveToUci, movesEqual, playMoveSound } from "../utils/chessHelpers";
import { defaultGame, extend } from 'chessops/pgn';
import type { PgnNodeData, Game, Node as PNode, ChildNode as CNode } from 'chessops/pgn';
import { makeSan } from 'chessops/san';
import '../App.css';
 
type MyNodeData = PgnNodeData & { move: any; color: "white" | "black";};

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
  const pgnRef = useRef<Game<MyNodeData>>( defaultGame<MyNodeData>() );
  const currentNodeRef = useRef<PNode<MyNodeData>>(pgnRef.current.moves);
  const pathRef = useRef<Array<PNode<MyNodeData> | CNode<MyNodeData>>>([pgnRef.current.moves]);
  const [currentOrientation, setCurrentOrientation] = useState<"white" | "black">(orientation);
  const [pendingPromotion, setPendingPromotion] = useState<{from: string;to: string;color: "white" | "black";} | null>(null);
  const lastMoveRef = useRef<[string, string] | undefined>(undefined);
  const chessRef = useRef<Chess | null>(null); // for quick access without re-renders

  // Handle move
  const handleMove = (from: string, to: string) => {
    if (!chess) return;

    const fromSquare = parseSquare(from);
    const toSquare = parseSquare(to);
    if (fromSquare === undefined || toSquare === undefined) return;

    const move: any = { from: fromSquare, to: toSquare };
    const fromPiece = chess.board.get(fromSquare);
    const toPiece = chess.board.get(toSquare);
    const toRank = Math.floor(toSquare / 8);
    const fromRank = Math.floor(fromSquare / 8);

        // --- AUTO-PROMOTION RULES ---
    let promotionRole: string | null = null;

    // Painter auto-promotes to RoyalPainter
    if (fromPiece?.role === "painter" && (toRank === 0 || toRank === 7)) {
      promotionRole = "royalpainter";
    }
    // Snare auto-promotes to RollingSnare
    else if (fromPiece?.role === "snare" && (toRank === 0 || toRank === 7)) {
      promotionRole = "rollingsnare";
    }

    // If it’s one of those, skip modal entirely
    if (promotionRole) {
      const moveWithPromotion = { from: fromSquare, to: toSquare, promotion: promotionRole };
      playMove(moveWithPromotion, from, to);
      return;
    }


    // Intercept promotion
    if ((fromPiece?.role === "pawn") && (toRank === 0 || toRank === 7) || (fromPiece?.role==="wizard" && toPiece?.role==="pawn" && (fromRank === 0 || fromRank === 7))) {
      setPendingPromotion({ from, to, color: chess.turn });
      return; // wait for modal
    }

    playMove(move, from, to);
  };

  const playMove = (move: any, from: string, to: string) => {
    if (!chess) return;

    if (!chess.isLegal(move)) {
      groundRef.current?.set({ fen: makeFen(chess.toSetup()) });
      return;
    }

    const captured = chess.board.get(parseSquare(to)!);
    const piece = chess.board.get(move.from)!;
    const toRank = Math.floor(move.to / 8);
    const fromRank = Math.floor(move.from / 8);
// call this after you compute `toIdx` (or replace your existing neighbor logic)
const toIdx = parseSquare(to)!;
const toFile = toIdx % 8;
const toRankIdx = Math.floor(toIdx / 8);

const leftIdx = toFile > 0 ? toIdx - 1 : undefined;
const rightIdx = toFile < 7 ? toIdx + 1 : undefined;
const frontIdx = toRankIdx < 7 ? toIdx + 8 : undefined;
const behindIdx = toRankIdx > 0 ? toIdx - 8 : undefined;

// chosen neighbors relative to white perspective
const relIdxs = piece.color === "white"
  ? [leftIdx, rightIdx, frontIdx]
  : [leftIdx, rightIdx, behindIdx];

// map to pieces (null if off-board/empty)
const neighbors = relIdxs.map((idx) => (idx !== undefined ? chess.board.get(idx) ?? null : null));

// did the move place a snare next to an enemy piece?
const hasEnemyAdjacent = neighbors.some((n) => n !== null && n.color !== piece.color);

// did the move put the moved piece next to an enemy snare?
const hasEnemySnareAdjacent = neighbors.some((n) => n !== null && n.color !== piece.color && n.role === "snare");

// final boolean
const isSnaredMove = (piece.role === "snare" && hasEnemyAdjacent) || hasEnemySnareAdjacent;


    // PGN: store SAN and the raw move object for replay
    let san = "";
    try {
      san = makeSan(chess, move);
    } catch {
      san = moveToUci(move); // fallback if SAN can’t be made
    }
    const color = chess.turn;
    // find or create the next node
    let nextNode = currentNodeRef.current.children.find(
      (child) => child.data.san === san && movesEqual(child.data.move, move)
    );
    if (!nextNode) {
      // chessops/pgn extend mutates the parent; get the new child
      extend(currentNodeRef.current, [{ san, move, color } as any]);
      nextNode = currentNodeRef.current.children.find(
        (child) => child.data.san === san && movesEqual(child.data.move, move)
      )!;
    }
    currentNodeRef.current = nextNode;
    pathRef.current = [...pathRef.current, nextNode];

    const preCaptured = chess.board.get(parseSquare(to)!) ?? null;
    playMoveSound(chess, move, from, to, preCaptured);

    chess.play(move);
    const newFen = makeFen(chess.toSetup());
    setFen(newFen);
    onMove?.(from, to);

    lastMoveRef.current = [from, to];
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
      const setup = parseFen(initialFen).unwrap();
      newChess = Chess.fromSetup(setup).unwrap();
    }
    setChess(newChess);
    setFen(makeFen(newChess.toSetup()));
  }, [initialFen]);

    // 1) create Chessground 
  useEffect(() => {
    if (!containerRef.current) return;
    const initialConfig: Config = {
      fen: makeFen(Chess.default().toSetup()), // safe default
      orientation: currentOrientation,
      highlight: { lastMove: true, check: true },
      movable: { color: "white", free: false, showDests: true, dests: new Map(), events: { after: handleMove } },
      animation: { enabled: true, duration: 300 },
      drawable: { enabled: true },
      draggable: { enabled: true },
    };
    groundRef.current = Chessground(containerRef.current, initialConfig);

    return () => {
      groundRef.current?.destroy();
      groundRef.current = null;
    };
  }, []);

  // 2) update Chessground 
  useEffect(() => {
    if (!groundRef.current || !chess) return;

    // ref copy for quick access in handlers
    chessRef.current = chess;

    // compute dests the same as you did before
    const dests: Dests = new Map();
    const ctx = chess.ctx();
    for (const [from, targets] of chess.allDests(ctx)) {
      dests.set(makeSquare(from), [...targets].map((t) => makeSquare(t)));
    }

    // apply lastMove we've stored earlier (playMove / goToPath should set lastMoveRef.current)
    const lastMove = lastMoveRef.current;

    groundRef.current.set({
      fen: makeFen(chess.toSetup()),
      turnColor: chess.turn,
      orientation: currentOrientation,
      movable: {
        color: chess.turn,
        free: false,
        showDests: true,
        dests,
        events: { after: handleMove },
      },
      lastMove,
      highlight: { check: true, custom: getCheckHighlights(chess) },
    });
  }, [chess, currentOrientation]);

  // Arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goToNext, goToPrev]);


  const resetBoard = () => {
    if (!chess) return;

    const newChess = initialFen === "start" ? Chess.default(): Chess.fromSetup(parseFen(initialFen).unwrap()).unwrap();

    //const newChess = createChessInstance("rnbqkbnr/ppppyppp/8/8/8/8/PPSPPPPP/RNBQKBNR w KQkq - 0 1");
    setChess(newChess);

    const newFen = makeFen(newChess.toSetup());
    setFen(newFen);

    if (!groundRef.current) return;

    const dests = calculateDests(newChess);

    lastMoveRef.current = undefined;

    groundRef.current.set({
      fen: newFen,
      lastMove: undefined,
      orientation: currentOrientation,
      movable: {
        color: newChess.turn,
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

  function goToPath(path: Array<PNode<MyNodeData> | CNode<MyNodeData>>) {
    // rebuild from start position
    const newChess =
      initialFen === "start"
        ? Chess.default()
        : Chess.fromSetup(parseFen(initialFen).unwrap()).unwrap();

    for (const n of path.slice(1)) {
      const mv = (n as CNode<MyNodeData>).data.move;
      newChess.play(mv);
    }

    let lastMove: [string, string] | undefined = undefined;
    if (path.length > 1) {
      const lastNode = path[path.length - 1] as CNode<MyNodeData>;
      if (lastNode?.data?.move) {
        const m = lastNode.data.move;
        try {
          lastMove = [makeSquare(m.from), makeSquare(m.to)];
        } catch {
          lastMove = undefined;
        }
      }
    }
    if (lastMove) lastMoveRef.current = lastMove;
    setChess(newChess);
    const newFen = makeFen(newChess.toSetup());
    setFen(newFen);
    currentNodeRef.current = path[path.length - 1] as any;
    pathRef.current = path;

    const dests = calculateDests(newChess);
    console.log("lastMove", lastMove);
    groundRef.current?.set({
      fen: newFen,
      turnColor: newChess.turn,
      movable: { color: newChess.turn, dests, events: { after: handleMove }, free: false, showDests: true },
      lastMove,
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
    console.log(pathRef.current.length)
    if (pathRef.current.length === 2){
      lastMoveRef.current = undefined;
      groundRef.current?.set({ lastMove: undefined });
    }
    if (pathRef.current.length > 1) {
      const newPath = pathRef.current.slice(0, -1);
      goToPath(newPath);
    } 
  }

  function goToFirst() {
    if (pathRef.current.length === 1) {
      lastMoveRef.current = undefined;
      groundRef.current?.set({ lastMove: undefined });
      return;
    }

    // reset the highlight (no previous move)
    lastMoveRef.current = undefined;
    groundRef.current?.set({ lastMove: undefined });

    // first node is the root, so path is just [root]
    const rootNode = pathRef.current[0];
    goToPath([rootNode]);
  }

  function goToLast() {
    const curr = currentNodeRef.current;

    // Traverse down to the last child
    let lastNode = curr;
    const newPath = [...pathRef.current];

    while (lastNode.children.length > 0) {
      const child = lastNode.children[0];
      newPath.push(child);
      lastNode = child;
    }

    goToPath(newPath);
  }



// PGN rendering helpers
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

  let parent = root;
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

/** Render a single variation line */
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

            {/* Variations for the white ply (small) */}
            <div style={{ display: "flex", gap: 8, marginLeft: 36, flexWrap: "wrap" }}>
              {row.whiteVariations.map((v: any, idx: number) => renderVariation(v, `w-${row.moveNum}-${idx}`))}
            </div>

            {/* Variations for the black ply (small) */}
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
       <button onClick={() => goToFirst()} style={{ marginRight: 10 }}>&lt;&lt;</button>
      <button onClick={() => goToPrev()} style={{ marginRight: 10 }}>&lt;</button>
      <button onClick={() => goToNext()}>&gt;</button>
      <button onClick={() => goToLast()} style={{ marginRight: 10 }}>&gt;&gt;</button>
  </div>
      <div style={{ marginTop: 10 }}>
      <button onClick={resetBoard} style={{ marginTop: 10, marginRight: 10, }}>
        Reset
      </button>
      <button onClick={flipBoard} style={{ marginRight: 10 }}>
        Flip
      </button>
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
        {["queen", "rook", "bishop", "knight", "champion", "princess"].map(
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
