import './App.css'
//import AnalysisBoard from "./components/AnalysisBoard"
import Knook from "./components/Knook";

function App() {
  return (
    <div>
      <Knook
        initialFen="3k4/8/1m1i4/Y7/8/4C1W1/8/4K3 w - - 0 1" 
        orientation="white"
        onMove={(from, to) => {
          console.log(`Moved from ${from} to ${to}`);
        }}
      />
    </div>
  );
}

export default App


// App.tsx
import ArmyBuilder from "./components/ArmyBuilder";

function App() {
  return (
    <div>
      <ArmyBuilder />
    </div>
  );
}
export default App;


// src/components/TutorialBoard.tsx
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
import type { Dests } from "chessground/types";
import { calculateDests, getCheckHighlights, movesEqual, moveToUci, playSound } from "../utils/chessHelpers";

type PromotionRole = "queen" | "rook" | "bishop" | "knight" | "knook" | "knishop";

/**
 * Challenge move format:
 *  { from: "e2", to: "e4", promotion?: "queen" }
 */
type UciMove = { from: string; to: string; promotion?: PromotionRole };

/**
 * challenge: initialFen and a sequence of steps; each step requires the white move, and optionally includes black reply
 * example:
 * {
 *   initialFen: "start",
 *   steps: [{ white: {from:"e2",to:"e4"}, black: {from:"e7",to:"e5"} }, ...]
 * }
 */
type Challenge = {
  initialFen?: string;
  steps: Array<{ white: UciMove; black?: UciMove }>;
};

type Props = {
  fen?: string;
  initialFen?: string;
  orientation?: "white" | "black";
  size?: number;
  onMove?: (from: string, to: string) => void;
  showControls?: boolean;
  challenge?: Challenge | null;
  challengeLabel?: string;
};

export default function TutorialBoard({
  fen: controlledFen,
  initialFen = "start",
  orientation = "white",
  size = 420,
  onMove,
  showControls = false,
  challenge = null,
  challengeLabel = "Challenge",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const groundRef = useRef<any>(null);

  const [chess, setChess] = useState<Chess | null>(null);
  const chessRef = useRef<Chess | null>(null);
  const [currentOrientation, setCurrentOrientation] = useState<"white" | "black">(orientation);
  const [internalFen, setInternalFen] = useState<string>(() =>
    controlledFen ?? (initialFen === "start" ? makeFen(Chess.default().toSetup()) : initialFen)
  );

  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: "white" | "black" } | null>(null);
  const [challengeIndex, setChallengeIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const blackMoveTimeoutRef = useRef<number | null>(null);
  const lastMoveRef = useRef<[string, string] | undefined>(undefined);
  const waitingForBlackRef = useRef<boolean>(false);

  // helpers
  const createChessFrom = (f: string) => {
    if (f === "start") return Chess.default();
    const setup = parseFen(f).unwrap();
    return Chess.fromSetup(setup).unwrap();
  };

  const makeDestsFromChess = (ch: Chess) => {
    // prefer your calculateDests util (returns Dests)
    try {
      return calculateDests(ch);
    } catch {
      // fallback
      const dests: Dests = new Map();
      const ctx = ch.ctx();
      for (const [from, targets] of ch.allDests(ctx)) {
        dests.set(makeSquare(from), [...targets].map((t) => makeSquare(t)));
      }
      return dests;
    }
  };

  const uciEqual = (expected: UciMove | undefined | null, from: string, to: string, promotion?: string | undefined) => {
    if (!expected) return false;
    if (expected.from !== from) return false;
    if (expected.to !== to) return false;
    // both undefined -> equal; otherwise exact match required
    const eProm = expected.promotion ?? undefined;
    const bProm = (promotion ?? undefined) as (string | undefined);
    return eProm === bProm;
  };

  // Reset challenge/board to challenge.initialFen OR controlledFen OR initialFen
  const resetChallengeAndBoard = (feedbackText: string | null = null) => {
    if (blackMoveTimeoutRef.current !== null) {
      clearTimeout(blackMoveTimeoutRef.current);
      blackMoveTimeoutRef.current = null;
    }

    const targetFen = (challenge && challenge.initialFen) ?? controlledFen ?? initialFen ?? "start";
    const newChess = createChessFrom(targetFen);
    setChess(newChess);
    chessRef.current = newChess;
    lastMoveRef.current = undefined;
    setInternalFen(makeFen(newChess.toSetup()));
    setChallengeIndex(0);
    setFeedback(feedbackText);

    if (groundRef.current) {
      const dests = makeDestsFromChess(newChess);
      groundRef.current.set({
        fen: makeFen(newChess.toSetup()),
        turnColor: newChess.turn,
        orientation: currentOrientation,
        movable: { color: newChess.turn, free: false, dests, events: { after: handleMove }, showDests: true },
        lastMove: undefined,
        highlight: { check: true, custom: getCheckHighlights(newChess) },
      });
    }
  };

  // init / when challenge or initial fen changes
  useEffect(() => {
    resetChallengeAndBoard(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledFen, initialFen, challenge]);

  // play move (shared for user and automated)
  const playMove = (move: any, fromAlg?: string, toAlg?: string, isAutomated = false) => {
    const ch = chessRef.current;
    if (!ch || !groundRef.current) return;

    if (!ch.isLegal(move)) {
      // reset displayed fen
      groundRef.current.set({ fen: makeFen(ch.toSetup()) });
      return;
    }

    const captured = ch.board.get(move.to);
    const piece = ch.board.get(move.from)!;

    // try to record SAN if desired (not necessary for tutorial)
    ch.play(move);
    const newFen = makeFen(ch.toSetup());
    setInternalFen(newFen);
    onMove?.(fromAlg ?? makeSquare(move.from), toAlg ?? makeSquare(move.to));

    // sound logic (borrowed from your Knook)
    if (captured) {
      if (piece.role === "painter") playSound("paint");
      else if (piece.role === "wizard" && captured.color === piece.color) playSound("wizard");
      else if (piece.role === "archer" && Math.abs(Math.floor(move.to / 8) - Math.floor(move.from / 8)) > 1) {
        playSound("archer");
        playSound("x_capture");
      } else playSound("capture");
      if (ch.isCheck()) playSound("check");
    } else {
      if (piece.role === "snare") playSound("move");
      if (ch.isCheck()) playSound("check");
      playSound("move");
    }

    lastMoveRef.current = [fromAlg ?? makeSquare(move.from), toAlg ?? makeSquare(move.to)];

    const dests = makeDestsFromChess(ch);
    groundRef.current.set({
      fen: newFen,
      turnColor: ch.turn,
      orientation: currentOrientation,
      movable: { color: ch.turn, free: false, dests, events: { after: handleMove }, showDests: true },
      lastMove: lastMoveRef.current,
      highlight: { check: true, custom: getCheckHighlights(ch) },
    });

    // don't run challenge matching for automated black replies (caller handles step advance)
    if (isAutomated) return;
  };

const handleMove = (from: string, to: string) => {
console.log("handleMove called:", from, to, "waiting:", waitingForBlackRef.current);
  // Block input while we're waiting for an automated black reply
  if (waitingForBlackRef.current) {
    console.debug("[tutorial] ignored move while waiting for black reply", { from, to, challengeIndex });
    return;
  }

  const ch = chessRef.current;
  if (!ch) return;

  // Important guard: only accept user moves when it's White's turn
  if (ch.turn !== "white") {
    console.debug("[tutorial] ignored move because not white's turn", { turn: ch.turn, from, to, challengeIndex });
    return;
  }

  const fromSq = parseSquare(from);
  const toSq = parseSquare(to);
  if (fromSq === undefined || toSq === undefined) {
    console.debug("[tutorial] parseSquare returned undefined", { from, to });
    return;
  }

  const move: any = { from: fromSq, to: toSq };

  const fromPiece = ch.board.get(fromSq);
  const toPiece = ch.board.get(toSq);
  const fromRank = Math.floor(fromSq / 8);
  const toRank = Math.floor(toSq / 8);

  // Promotion interception
  const isPromotionCandidate =
    ((fromPiece?.role === "pawn" || fromPiece?.role === "painter") && (toRank === 0 || toRank === 7)) ||
    (fromPiece?.role === "wizard" && toPiece?.role === "pawn" && (toRank === 0 || toRank === 7));

  if (isPromotionCandidate) {
    setPendingPromotion({ from, to, color: ch.turn });
    return;
  }

  if (!challenge) {
    playMove(move, from, to, false);
    return;
  }

  const step = challenge.steps[challengeIndex];
  if (!step) {
    playMove(move, from, to, false);
    return;
  }

  const expectedWhite = step.white;

  // Debug: print expected + played move
  console.debug("[tutorial] user move", { from, to, challengeIndex, expectedWhite });

  // If user's move matches expected white move (including optional promotion)
  const matches = uciEqual(expectedWhite, from, to, expectedWhite?.promotion);
  console.debug("[tutorial] uciEqual ->", matches);

  if (matches) {
  if (expectedWhite.promotion) move.promotion = expectedWhite.promotion;

  playMove(move, from, to, false);
  setFeedback("Correct!");

  // increment immediately
  setChallengeIndex((prev) => {
    const next = prev + 1;
    if (!step.black) {
      if (next >= challenge!.steps.length) setFeedback("Completed!");
      else setFeedback(null);
    }
    return next;
  });

  if (step.black) {
    waitingForBlackRef.current = true;
    groundRef.current?.set({ movable: { color: ch.turn, free: false, dests: new Map(), showDests: false } });

    blackMoveTimeoutRef.current = window.setTimeout(() => {
      blackMoveTimeoutRef.current = null;
      const b = step.black!;
      const fromS = parseSquare(b.from);
      const toS = parseSquare(b.to);

      if (fromS !== undefined && toS !== undefined) {
        const bm: any = { from: fromS, to: toS };
        if (b.promotion) bm.promotion = b.promotion;
        playMove(bm, b.from, b.to, true);
      }

      waitingForBlackRef.current = false;
      // you already advanced the index, so don’t increment again
      if (challengeIndex + 1 >= challenge!.steps.length) setFeedback("Completed!");
      else setFeedback(null);
    }, 450);
  }

  return;
}


  // Incorrect
  setFeedback("Incorrect — try gain");
  console.log("[tutorial] incorrect move", { from, to, expected: expectedWhite, index: challengeIndex });
  window.setTimeout(() => {
    resetChallengeAndBoard(null);
  }, 700);
};



const promotePawn = (role: PromotionRole) => {
  if (!pendingPromotion) return;
  const ch = chessRef.current;
  if (!ch) return;

  // only allow promotion when it's the appropriate turn (defensive)
  if (ch.turn !== "white" && ch.turn !== "black") {
    console.debug("[tutorial] promotePawn ignored because unexpected turn", ch.turn);
    return;
  }

  const { from, to } = pendingPromotion;
  const fromSq = parseSquare(from);
  const toSq = parseSquare(to);
  if (fromSq === undefined || toSq === undefined) {
    setPendingPromotion(null);
    return;
  }

  const move: any = { from: fromSq, to: toSq, promotion: role };

  if (challenge) {
    const step = challenge.steps[challengeIndex];
    const expected = step?.white;

    console.debug("[tutorial] promotion attempt", { from, to, role, expected, index: challengeIndex });

    if (expected && expected.promotion) {
      if (uciEqual(expected, from, to, expected.promotion)) {
        // correct promotion
        playMove(move, from, to, false);
        setPendingPromotion(null);
        setFeedback("Correct!");

        setChallengeIndex((prev) => {
          const next = prev + 1;
          if (next >= challenge!.steps.length) setFeedback("Completed!");
          else setFeedback(null);
          return next;
        });

        if (step.black) {
          waitingForBlackRef.current = true;
          try {
            groundRef.current?.set({ movable: { color: ch.turn, free: false, dests: new Map(), showDests: false } });
          } catch {}
          blackMoveTimeoutRef.current = window.setTimeout(() => {
            blackMoveTimeoutRef.current = null;
            const b = step.black!;
            const fromS = parseSquare(b.from);
            const toS = parseSquare(b.to);
            if (fromS !== undefined && toS !== undefined) {
              const bm: any = { from: fromS, to: toS };
              if (b.promotion) bm.promotion = b.promotion;
              playMove(bm, b.from, b.to, true);
            }
            waitingForBlackRef.current = false;
          }, 450);
        }

        return;
      } else {
        // wrong promotion
        setFeedback("Incorrect promotion — try again");
        setPendingPromotion(null);
        window.setTimeout(() => resetChallengeAndBoard(null), 700);
        return;
      }
    }
  }

  // Not a challenge or not expected promotion — play normally
  playMove(move, from, to, false);
  setPendingPromotion(null);
};



  // mount Chessground
  useEffect(() => {
    if (!containerRef.current) return;
    const cfg: Config = {
      fen: internalFen,
      orientation: currentOrientation,
      highlight: { lastMove: true, check: true },
      movable: { color: chess?.turn ?? "white", free: false, showDests: true, dests: new Map(), events: { after: handleMove } },
      animation: { enabled: true, duration: 240 },
      draggable: { enabled: true },
      drawable: { enabled: false },
    };

    groundRef.current = Chessground(containerRef.current, cfg);

    // ensure correct fen after layout
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          groundRef.current?.set({ fen: internalFen });
        } catch {}
      });
    });

    return () => {
      if (blackMoveTimeoutRef.current !== null) {
        clearTimeout(blackMoveTimeoutRef.current);
        blackMoveTimeoutRef.current = null;
      }
      groundRef.current?.destroy();
      groundRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once

  // sync chess -> chessground
  useEffect(() => {
    if (!groundRef.current || !chess) return;
    chessRef.current = chess;

    const dests = makeDestsFromChess(chess);
    groundRef.current.set({
      fen: makeFen(chess.toSetup()),
      turnColor: chess.turn,
      orientation: currentOrientation,
      movable: { color: chess.turn, free: false, dests, events: { after: handleMove }, showDests: true },
      lastMove: lastMoveRef.current,
      highlight: { check: true, custom: getCheckHighlights(chess) },
    });

    setInternalFen(makeFen(chess.toSetup()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, currentOrientation]);

  // ensure visible fen updates when internalFen or size changes
  useEffect(() => {
    if (!groundRef.current) return;
    try {
      groundRef.current.set({ fen: internalFen });
    } catch {}
  }, [internalFen, size]);

  // UI
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* Feedback / Challenge header (compact, above the board) */}
      <div
        aria-live="polite"
        style={{
          minHeight: 22,
          padding: "2px 6px",
          fontWeight: 600,
          fontSize: 14,
          color: feedback === "Correct!" ? "green" : feedback?.startsWith("Incorrect") ? "salmon" : "#ddd",
          textAlign: "center",
          lineHeight: "20px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ flex: "0 0 auto" }}>
          {feedback
            ? feedback
            : challenge
            ? `${challengeLabel}: step ${Math.min(challengeIndex + 1, challenge.steps.length)}/${challenge.steps.length}`
            : ""}
        </div>

        {/* "Try again" button appears once the exercise is completed */}
        {challenge && (feedback === "Completed!" || challengeIndex >= challenge.steps.length) && (
          <button
            onClick={() => {
              // restart the challenge from initial position
              resetChallengeAndBoard(null);
            }}
            style={{
              padding: "4px 8px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "#ddd",
              cursor: "pointer",
            }}
            aria-label="Try challenge again"
            title="Try again"
          >
            Try again
          </button>
        )}
      </div>

      {/* Board (centered) */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          ref={containerRef}
          className="cg-wrap"
          style={{
            width: size,
            maxWidth: "100%",
            height: size,
            boxSizing: "border-box",
            borderRadius: 8,
            overflow: "hidden",
          }}
        />
      </div>

      {/* Small control row below the board (compact) */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", width: "100%" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {showControls && (
            <button
              onClick={() => {
                const newOrientation = currentOrientation === "white" ? "black" : "white";
                setCurrentOrientation(newOrientation);
                groundRef.current?.set({ orientation: newOrientation });
              }}
            >
              Flip
            </button>
          )}

          {showControls && (
            <button onClick={() => resetChallengeAndBoard(null)}>
              Reset
            </button>
          )}
        </div>

        {/* optional small FEN / info in the same row (non-intrusive) */}
        {showControls && (
          <div style={{ marginLeft: 8, fontSize: 12, color: "#999", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>
            {internalFen}
          </div>
        )}
      </div>

      {/* Promotion modal (overlay) */}
      {pendingPromotion && (
        <div
          onClick={() => {
            // cancel promotion selection and re-render board state
            const ch = chessRef.current;
            if (ch && groundRef.current) {
              const newFen = makeFen(ch.toSetup());
              const dests = makeDestsFromChess(ch);
              groundRef.current.set({
                fen: newFen,
                turnColor: ch.turn,
                lastMove: undefined,
                movable: { color: ch.turn, free: false, showDests: true, dests, events: { after: handleMove } },
                highlight: { check: true, custom: getCheckHighlights(ch) },
              });
            }
            setPendingPromotion(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 900,
            backgroundColor: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "white", border: "2px solid black", borderRadius: 8, padding: 10, display: "flex", gap: 10 }}>
            {["queen", "rook", "bishop", "knight", "knook", "knishop"].map((role) => (
              <button key={role} onClick={() => promotePawn(role as PromotionRole)} style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }} title={role}>
                <div className={`cg-piece ${role} ${pendingPromotion?.color}`} style={{ width: 48, height: 48 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );


}
