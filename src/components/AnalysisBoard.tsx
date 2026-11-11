import { useEffect, useRef, useState, type ReactNode } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseSquare, makeSquare, parseUci, charToRole } from "chessops/util";
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
import { useNavigate } from "react-router-dom";
 
const EMPTY_MOVES: string[] = []; // stable identity so the replay effect only reruns on real changes

type MyNodeData = PgnNodeData & { move: any; color: "white" | "black";};

type AnalysisBoardProps = {
  initialFen?: string;
  orientation?: "white" | "black";
  onMove?: (from: string, to: string) => void;
  initialMoves?: string[]; // SAN strings e.g. ["e4", "e5", "Nf3"]
  initialUci?: string[]; // exact UCI moves (preferred over initialMoves when present)
  // optional slots used when reviewing a saved game
  players?: { white: ReactNode; black: ReactNode }; // shown above/below the board, following the board orientation
  movesFooter?: ReactNode;   // shown under the move list (e.g. the result)
  extraActions?: ReactNode;  // extra buttons in the toolbar
};

export default function AnalysisBoard({
  initialFen = "start",
  orientation = "white",
  onMove,
  initialMoves = EMPTY_MOVES,
  initialUci = EMPTY_MOVES,
  players,
  movesFooter,
  extraActions,
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

  const navigate = useNavigate();

  const [, forceUpdate] = useState(0);


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
    if (fromPiece?.role === "painter" && (toRank === 0 || toRank === 7) || (fromPiece?.role === "wizard" && fromPiece?.color === 'white' && toPiece?.role === 'painter' && fromRank === 7) || ((fromPiece?.role === "wizard" && fromPiece?.color === 'black' && toPiece?.role === 'painter' && fromRank === 0))) {
      promotionRole = "royalpainter";
    }
    // Snare auto-promotes to RollingSnare
    else if (fromPiece?.role === "snare" && (toRank === 0 || toRank === 7) || (fromPiece?.role === "wizard" && fromPiece?.color === 'white' && toPiece?.role === 'snare' && fromRank === 7) || ((fromPiece?.role === "wizard" && fromPiece?.color === 'black' && toPiece?.role === 'snare' && fromRank === 0))) {
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
      if ((fromPiece.color === 'white' && fromRank === 0) || (fromPiece.color === 'black' && fromRank === 7)){
        ;
      }
      else{
      setPendingPromotion({ from, to, color: chess.turn });
      return; // wait for modal
      }
    }

    playMove(move, from, to);
  };

  const playMove = (move: any, from: string, to: string) => {
    if (!chess) return;

    if (!chess.isLegal(move)) {
      //console.log("move not legal. move: ", move);
      groundRef.current?.set({ fen: makeFen(chess.toSetup()) });
      return;
    }
// final boolean


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

    //console.log("calling chess.play(). move: ", move);

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

  useEffect(() => {
  if (initialMoves.length === 0 && initialUci.length === 0) return;

  // replay each move into the pgn tree
  const replayChess = initialFen === "start"
    ? Chess.default()
    : Chess.fromSetup(parseFen(initialFen).unwrap()).unwrap();

  // reset pgn tree
  pgnRef.current = defaultGame<MyNodeData>();
  currentNodeRef.current = pgnRef.current.moves;
  pathRef.current = [pgnRef.current.moves];

  // Resolve the next move. Prefer exact UCI (unambiguous, carries the promotion role);
  // fall back to matching SAN for games saved before UCI was stored.
  const resolve = (i: number): { move: any; san: string } | null => {
    if (initialUci.length > 0) {
      const mv: any = parseUci(initialUci[i]);
      if (!mv || !replayChess.isLegal(mv)) return null;
      let san: string;
      try { san = makeSan(replayChess, mv); } catch { san = initialUci[i]; }
      return { move: mv, san };
    }
    const san = initialMoves[i];
    // the SAN names the promotion piece ("e8=O"), including fairy promotions
    const promoChar = san.match(/=([A-Za-z])/)?.[1]?.toLowerCase();
    const promotion = promoChar ? charToRole(promoChar) : undefined;
    const ctx = replayChess.ctx();
    for (const [from, targets] of replayChess.allDests(ctx)) {
      for (const to of targets) {
        const candidate: any = promotion ? { from, to, promotion } : { from, to };
        try {
          if (makeSan(replayChess, candidate) === san) return { move: candidate, san };
        } catch {}
      }
    }
    return null;
  };

  const total = initialUci.length > 0 ? initialUci.length : initialMoves.length;
  for (let i = 0; i < total; i++) {
    const r = resolve(i);
    if (!r) break; // unrecognized move, stop replaying

    const color = replayChess.turn;
    extend(currentNodeRef.current, [{ san: r.san, move: r.move, color } as any]);
    const nextNode = currentNodeRef.current.children.find(
      (c) => c.data.san === r.san
    )!;
    currentNodeRef.current = nextNode;
    pathRef.current = [...pathRef.current, nextNode];
    replayChess.play(r.move);
  }

  // after replaying, go back to the start position for analysis
  // (user can navigate forward with arrow keys / move list)
  const startChess = initialFen === "start"
    ? Chess.default()
    : Chess.fromSetup(parseFen(initialFen).unwrap()).unwrap();
  currentNodeRef.current = pgnRef.current.moves;
  pathRef.current = [pgnRef.current.moves];
  lastMoveRef.current = undefined;
  forceUpdate(n => n + 1); // trigger move list re-render
  setChess(startChess);

}, [initialMoves, initialUci]);


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

  function goToPath(path: Array<PNode<MyNodeData> | CNode<MyNodeData>>, playSound = false) {
    // rebuild from start position
    const newChess =
      initialFen === "start"
        ? Chess.default()
        : Chess.fromSetup(parseFen(initialFen).unwrap()).unwrap();

      let lastPreCapture: any = null;
      let lastMv: any = null;

      for (const n of path.slice(1)) {
        const mv = (n as CNode<MyNodeData>).data.move;
        lastPreCapture = newChess.board.get(mv.to) ?? null;
        lastMv = mv;
        newChess.play(mv);
      }

      // only play sound for forward navigation (caller's responsibility — see goToNext)
      if (playSound && lastMv && path.length > 1) {
        const fromStr = makeSquare(lastMv.from);
        const toStr = makeSquare(lastMv.to);
        playMoveSound(newChess, lastMv, fromStr, toStr, lastPreCapture);
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
    //console.log("lastMove", lastMove);
    groundRef.current?.set({
      fen: newFen,
      turnColor: newChess.turn,
      movable: { color: newChess.turn, dests, events: { after: handleMove }, free: false, showDests: true },
      lastMove,
      highlight: { check: true, custom: getCheckHighlights(newChess) },
    });
  }

  function goToNode(node: CNode<MyNodeData>, path: Array<PNode<MyNodeData> | CNode<MyNodeData>>, playSound = false) {
    node;
    goToPath(path, playSound);
  }

  function goToNext() {
    const curr = currentNodeRef.current;
    const child = curr.children[0];
    if (child) {
      goToNode(child, [...pathRef.current, child], true); // <-- pass true
    }
  }

  function goToPrev() {
    //console.log(pathRef.current.length)
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

/** A clickable move "button". `small` is used inside variations. */
function moveButton(node: CNode<MyNodeData>, path: Array<PNode<MyNodeData> | CNode<MyNodeData>>, small = false) {
  const current = node === currentNodeRef.current;
  return (
    <button
      key={`m-${path.length}-${getSan(node)}`}
      className={`ab-move${small ? " ab-vmove" : ""}${current ? " ab-move-current" : ""}`}
      onClick={() => goToNode(node, path)}
    >
      {getSan(node)}
    </button>
  );
}

/**
 * One variation as a run of clickable moves with its own numbering ("2. Nf3 Nc6 3. Bb5"),
 * followed by any sub-variations nested one level deeper.
 */
function renderVariation(startNode: CNode<MyNodeData>, startPath: Array<PNode<MyNodeData> | CNode<MyNodeData>>, depth: number, key: string): ReactNode {
  const tokens: ReactNode[] = [];
  const subs: ReactNode[] = [];
  let node: CNode<MyNodeData> | undefined = startNode;
  let path = startPath;
  let first = true;
  while (node) {
    const ply = path.length - 1; // 1-based ply of this move
    const white = ply % 2 === 1;
    const num = Math.ceil(ply / 2);
    if (white) tokens.push(<span key={`n-${ply}`} className="ab-vnum">{num}.</span>);
    else if (first) tokens.push(<span key={`n-${ply}`} className="ab-vnum">{num}…</span>);
    tokens.push(moveButton(node, path, true));
    if (!first) {
      // alternatives to this ply (siblings of a non-first move in the line)
      const parent = path[path.length - 2] as PNode<MyNodeData> | CNode<MyNodeData>;
      parent.children.slice(1).forEach((sib, i) => {
        subs.push(renderVariation(sib, [...path.slice(0, -1), sib], depth + 1, `${key}-${ply}-${i}`));
      });
    }
    first = false;
    const next: CNode<MyNodeData> | undefined = node.children[0];
    if (!next) break;
    node = next;
    path = [...path, next];
  }
  return (
    <div key={key} className="ab-var" style={{ marginLeft: depth > 0 ? 10 : 0 }}>
      <div className="ab-var-line">{tokens}</div>
      {subs}
    </div>
  );
}

/** Render the whole move list: shaded full-move rows, variations nested right under their row */
function renderMoveList() {
  const rows = buildMainlineRows();
  if (rows.length === 0) return <div className="ab-empty">No moves yet. Drag a piece to start analysing.</div>;
  return (
    <div>
      {rows.map((row) => (
        <div key={`row-${row.moveNum}`} className={`ab-fullmove ${row.moveNum % 2 === 1 ? "ab-odd" : "ab-even"}`}>
          <div className="ab-row">
            <div className="ab-num">{row.moveNum}</div>
            {moveButton(row.whiteNode, row.whitePath)}
            {row.blackNode ? moveButton(row.blackNode, row.blackPath) : <div />}
          </div>
          {[...row.whiteVariations, ...row.blackVariations].map((v: any, idx: number) =>
            renderVariation(v.node, v.path, 0, `v-${row.moveNum}-${idx}`)
          )}
        </div>
      ))}
    </div>
  );
}

  const [analysisOn, setAnalysisOn] = useState(false);
  const [fenCopied, setFenCopied] = useState(false);

  // keep the current move visible inside the list (scroll the list only, never the page)
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(".ab-move-current");
    if (!list) return;
    if (!el) { list.scrollTop = 0; return; }
    const top = el.offsetTop - list.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (top + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + el.offsetHeight - list.clientHeight + 8;
  });

  const topSide = currentOrientation === "white" ? "black" : "white";
  const bottomSide = currentOrientation;
  const status = chess
    ? chess.isCheckmate() ? "Checkmate"
      : chess.isStalemate() ? "Stalemate"
      : chess.isInsufficientMaterial() ? "Insufficient material"
      : chess.isCheck() ? "Check"
      : null
    : null;

  return (
<div className="ab-page">
  <style>{AB_CSS}</style>
  <div className="ab-layout">
    {/* Board column: player strip, board, player strip (strips follow the board orientation) */}
    <div className="ab-board-col">
      {players && <div className="ab-strip">{players[topSide]}</div>}
      <div
        ref={containerRef}
        className="cg-wrap"
        style={{ width: 600, height: 600, boxShadow: "0 6px 18px rgba(0,0,0,0.35)", borderRadius: 8, overflow: "hidden" }}
      />
      {players && <div className="ab-strip">{players[bottomSide]}</div>}
    </div>

    {/* Side panel: exactly as tall as the board column (the inner box is absolutely sized to it) */}
    <div className="ab-panel">
      <div className="ab-panel-inner">
        <div className="ab-top">
          <button
            className={`ab-toggle${analysisOn ? " on" : ""}`}
            role="switch"
            aria-checked={analysisOn}
            onClick={() => setAnalysisOn((v) => !v)}
            title="Engine analysis (Fairy-Stockfish)"
          >
            <span className="ab-switch"><span className="ab-knob" /></span>
            Analysis
          </button>
          {chess && (
            <span className="ab-turn">
              {status ? <b>{status} · </b> : null}
              {chess.turn === "white" ? "White" : "Black"} to move
            </span>
          )}
        </div>
        {analysisOn && <div className="ab-engine">Fairy-Stockfish analysis is coming soon.</div>}

        <div className="pgn-tree ab-list" ref={listRef}>{renderMoveList()}</div>
        {movesFooter && <div className="ab-footer">{movesFooter}</div>}

        <div className="ab-nav">
          <button onClick={() => goToFirst()} title="First move" aria-label="First move">«</button>
          <button onClick={() => goToPrev()} title="Previous move (←)" aria-label="Previous move">‹</button>
          <button onClick={() => goToNext()} title="Next move (→)" aria-label="Next move">›</button>
          <button onClick={() => goToLast()} title="Last move" aria-label="Last move">»</button>
        </div>

        <div className="ab-tools">
          <button onClick={flipBoard} title="Flip board" aria-label="Flip board" className="ab-icon-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          <button onClick={resetBoard} title="Clear all moves and start over" aria-label="Reset" className="ab-icon-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          <button onClick={() => navigate("/editor", { state: { initialFen: fen } })} title="Edit this position in the board editor" aria-label="Edit board" className="ab-icon-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <button
            onClick={() => { navigator.clipboard?.writeText(fen).then(() => { setFenCopied(true); setTimeout(() => setFenCopied(false), 1200); }).catch(() => {}); }}
            title={fenCopied ? "FEN copied" : `Copy FEN: ${fen}`}
            aria-label="Copy FEN"
            className="ab-icon-btn"
            style={fenCopied ? { color: "#7be0a3" } : undefined}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          {extraActions}
        </div>
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
        {["queen", "rook", "bishop", "knight"].map(
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
</div>
  );
}

const AB_CSS = `
.ab-page { min-height: 100%; display: flex; justify-content: center; padding: 20px 16px 32px; }
.ab-layout { position: relative; display: flex; gap: 20px; align-items: stretch; flex-wrap: wrap; justify-content: center; }
.ab-board-col { width: 600px; max-width: 100%; display: flex; flex-direction: column; }
.ab-strip { height: 40px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 4px; font-size: 15px; min-width: 0; }
.ab-panel { width: 340px; max-width: 100%; position: relative; min-height: 440px; }
.ab-panel-inner { position: absolute; inset: 0; display: flex; flex-direction: column; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; overflow: hidden; }
.ab-top { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #2a2a2a; flex: 0 0 auto; }
.ab-toggle { display: inline-flex; align-items: center; gap: 9px; background: none; border: none; color: #ddd; font-size: 14px; font-weight: 600; cursor: pointer; padding: 0; }
.ab-switch { width: 34px; height: 19px; border-radius: 10px; background: #3a3a3a; position: relative; transition: background .15s; }
.ab-knob { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: #bbb; transition: left .15s; }
.ab-toggle.on .ab-switch { background: #5b9a3c; }
.ab-toggle.on .ab-knob { left: 17px; background: #fff; }
.ab-turn { font-size: 12px; color: #888; }
.ab-turn b { color: #e8b04a; font-weight: 600; }
.ab-engine { padding: 8px 12px; font-size: 12px; color: #999; background: #151515; border-bottom: 1px solid #2a2a2a; flex: 0 0 auto; }
.ab-list { flex: 1 1 0; min-height: 0; overflow-y: auto; position: relative; }
.ab-fullmove.ab-odd { background: #1c1c1c; }
.ab-fullmove.ab-even { background: #262626; }
.ab-row { display: grid; grid-template-columns: 38px 1fr 1fr; align-items: center; padding: 1px 6px 1px 0; }
.ab-num { text-align: center; color: #777; font-size: 13px; }
.ab-move { font: inherit; font-size: 16px; text-align: left; background: transparent; color: #ddd; border: none; border-radius: 4px; padding: 6px 8px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ab-move:hover { background: rgba(255,255,255,0.08); }
.ab-move-current, .ab-move-current:hover { background: #6a6a6a; color: #fff; font-weight: 600; }
.ab-var { margin: 0 6px 6px 38px; padding: 2px 0 2px 8px; border-left: 2px solid #444; }
.ab-var .ab-var { margin: 2px 0 2px 4px; }
.ab-var-line { display: flex; flex-wrap: wrap; align-items: center; gap: 1px 2px; }
.ab-vnum { color: #777; font-size: 12px; padding: 0 1px 0 4px; }
.ab-vmove { font-size: 14px; padding: 2px 5px; color: #bbb; }
.ab-empty { color: #777; font-size: 13px; padding: 16px 12px; text-align: center; }
.ab-footer { padding: 10px 14px; border-top: 1px solid #2a2a2a; background: #161616; font-size: 14px; flex: 0 0 auto; }
.ab-nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 6px; border-top: 1px solid #2a2a2a; flex: 0 0 auto; }
.ab-nav button { font-size: 26px; line-height: 1; padding: 8px 0 10px; background: #2c2c2c; color: #ddd; border: none; border-radius: 6px; cursor: pointer; }
.ab-nav button:hover { background: #3a3a3a; }
.ab-nav button:active { background: #444; }
.ab-tools { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 4px 6px 8px; flex: 0 0 auto; }
.ab-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 28px; padding: 0; background: transparent; color: #999; border: none; border-radius: 5px; cursor: pointer; }
.ab-icon-btn:hover { background: #2c2c2c; color: #fff; }
`;
