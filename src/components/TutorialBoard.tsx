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
import { calculateDests, getCheckHighlights, playSound } from "../utils/chessHelpers";

type PromotionRole = "queen" | "rook" | "bishop" | "knight" | "champion" | "princess";
type UciMove = { from: string; to: string; promotion?: PromotionRole };
type Challenge = {
  initialFen?: string;
  steps: Array<{ white: UciMove; black?: UciMove }>;
  alt_steps?: Array<{ white: UciMove; black?: UciMove }>;
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
  debugName?: string;
};

const now = () => new Date().toISOString().slice(11, 23);
const debug = (...args: any[]) => console.log(`[TB ${now()}]`, ...args);
const group = (label: string, body: () => void) => {
  console.groupCollapsed(`[TB ${now()}] ${label}`);
  try { body(); } finally { console.groupEnd(); }
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
  debugName = "TutorialBoard",
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
  const prevChallengeIndexRef = useRef<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const blackMoveTimeoutRef = useRef<number | null>(null);
  const lastMoveRef = useRef<[string, string] | undefined>(undefined);
  const waitingForBlackRef = useRef<boolean>(false);
  const challengeIndexRef = useRef(0);

  const prevPropsRef = useRef<{ controlledFen?: string; initialFen?: string; challenge?: Challenge | null }>({
    controlledFen, initialFen, challenge
  });

  // Expose a quick inspector
  (window as any).__TB = (window as any).__TB || {};
  (window as any).__TB[debugName] = {
    dump: () => ({
      challengeIndex,
      waitingForBlack: waitingForBlackRef.current,
      pendingPromotion,
      feedback,
      lastMove: lastMoveRef.current,
      internalFen,
      chessTurn: chessRef.current?.turn,
      stepsLen: challenge?.steps.length,
      stepAtIndex: challenge ? challenge.steps[challengeIndex] : undefined,
      challengeIdentity: challenge && `${challenge.initialFen ?? "start"}#${challenge.steps.length}`,
    }),
  };

  // helpers
  const createChessFrom = (f: string) => {
    if (f === "start") return Chess.default();
    const setup = parseFen(f).unwrap();
    return Chess.fromSetup(setup).unwrap();
  };

  const makeDestsFromChess = (ch: Chess) => {
    try {
      return calculateDests(ch);
    } catch {
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
    const ok = expected.from === from && expected.to === to && (expected.promotion ?? undefined) === (promotion ?? undefined);
    return ok;
  };

  // Reset challenge/board to challenge.initialFen OR controlledFen OR initialFen
  const resetChallengeAndBoard = (feedbackText: string | null = null, reason: string = "explicit") => {
    group(`resetChallengeAndBoard (reason: ${reason})`, () => {
      if (blackMoveTimeoutRef.current !== null) {
        debug("clearing pending blackMoveTimeout", blackMoveTimeoutRef.current);
        clearTimeout(blackMoveTimeoutRef.current);
        blackMoveTimeoutRef.current = null;
      }

      const targetFen = (challenge && challenge.initialFen) ?? controlledFen ?? initialFen ?? "start";
      debug("targetFen:", targetFen);

      const newChess = createChessFrom(targetFen);
      debug("newChess.turn:", newChess.turn);

      setChess(newChess);
      chessRef.current = newChess;
      lastMoveRef.current = undefined;
      const fen = makeFen(newChess.toSetup());
      setInternalFen(fen);
      setChallengeIndex(0);
      setFeedback(feedbackText);

      if (groundRef.current) {
        const dests = makeDestsFromChess(newChess);
        groundRef.current.set({
          fen,
          turnColor: newChess.turn,
          orientation: currentOrientation,
          movable: { color: newChess.turn, free: false, dests, events: { after: handleMove }, showDests: true },
          lastMove: undefined,
          highlight: { check: true, custom: getCheckHighlights(newChess) },
        });
        debug("ground set on reset (movable.color):", newChess.turn);
      }
    });
  };

  // track prop changes that would cause resets
  useEffect(() => {
    const prev = prevPropsRef.current;
    if (prev.controlledFen !== controlledFen) {
      debug("prop change: controlledFen", { prev: prev.controlledFen, next: controlledFen });
    }
    if (prev.initialFen !== initialFen) {
      debug("prop change: initialFen", { prev: prev.initialFen, next: initialFen });
    }
    if (prev.challenge !== challenge) {
      group("prop change: challenge identity changed", () => {
        debug("prev === next ?", prev.challenge === challenge);
        debug("prev steps len:", prev.challenge?.steps.length, "next steps len:", challenge?.steps.length);
        try {
          debug("prev JSON:", JSON.stringify(prev.challenge));
          debug("next JSON:", JSON.stringify(challenge));
        } catch {}
      });
    }
    prevPropsRef.current = { controlledFen, initialFen, challenge };
  }, [controlledFen, initialFen, challenge]);

  // init / when challenge or initial fen changes
  useEffect(() => {
    resetChallengeAndBoard(null, "deps: controlledFen|initialFen|challenge");
  }, [controlledFen, initialFen, challenge]);

  // log challengeIndex transitions
  useEffect(() => {
    const prev = prevChallengeIndexRef.current;
    if (prev !== challengeIndex) {
      debug("challengeIndex change:", { prev, next: challengeIndex });
    }
    prevChallengeIndexRef.current = challengeIndex;
  }, [challengeIndex]);

  // keep ref in sync
useEffect(() => {
  challengeIndexRef.current = challengeIndex;
}, [challengeIndex]);

  const playMove = (move: any, fromAlg?: string, toAlg?: string, isAutomated = false) => {
    const ch = chessRef.current;
    if (!ch || !groundRef.current) return;

    group(`playMove ${fromAlg ?? makeSquare(move.from)}→${toAlg ?? makeSquare(move.to)} (isAutomated=${isAutomated})`, () => {
      const beforeFen = makeFen(ch.toSetup());
      const beforeTurn = ch.turn;
      debug("before", { fen: beforeFen, turn: beforeTurn });

      if (!ch.isLegal(move)) {
        debug("ILLEGAL move; restoring fen");
        groundRef.current.set({ fen: beforeFen });
        return;
      }

      const captured = ch.board.get(move.to);
      const piece = ch.board.get(move.from)!;
    //test
      
      ch.play(move);
      const newFen = makeFen(ch.toSetup());
      setInternalFen(newFen);
      onMove?.(fromAlg ?? makeSquare(move.from), toAlg ?? makeSquare(move.to));

      const toIdx = typeof move.to === "number" ? move.to : parseSquare(move.to)!;
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
      const neighbors = relIdxs.map((idx) => (idx !== undefined ? ch.board.get(idx) ?? null : null));

      // did the move place a snare next to an enemy piece?
      const hasEnemyAdjacent = neighbors.some((n) => n !== null && n.color !== piece.color);

      // did the move put the moved piece next to an enemy snare?
      const hasEnemySnareAdjacent = neighbors.some((n) => n !== null && n.color !== piece.color && n.role === "snare");

      // final boolean
      const isSnaredMove = (piece.role === "snare" && hasEnemyAdjacent) || hasEnemySnareAdjacent;


      // sounds
      if (captured) {
        if (piece.role === "painter") playSound("paint");
        else if (piece.role === "wizard" && captured.color === piece.color) playSound("wizard");
        else if (piece.role === "archer" && Math.abs(Math.floor(move.to / 8) - Math.floor(move.from / 8)) > 1) {
          playSound("archer"); playSound("x_capture");
        } else playSound("capture");
        if (ch.isCheck()) playSound("check");
         if (isSnaredMove){
        playSound("snare")
      }
      } else {
        if (piece.role === "snare") playSound("move");
        if (ch.isCheck()) playSound("check");
        playSound("move");
         if (isSnaredMove){
        playSound("snare")
      }
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
      debug("after", { fen: newFen, turn: ch.turn, lastMove: lastMoveRef.current, waitingForBlack: waitingForBlackRef.current });

      if (isAutomated) {
        debug("playMove done (automated)");
        return;
      }
    });
  };

const handleMove = (from: string, to: string) => {
  group(`handleMove ${from}→${to}`, () => {
    debug("state snapshot", {
      waitingForBlack: waitingForBlackRef.current,
      challengeIndex,
      feedback,
      chessTurn: chessRef.current?.turn,
    });

    if (waitingForBlackRef.current) {
      debug("IGNORED: waitingForBlackRef is true");
      return;
    }

    const ch = chessRef.current;
    if (!ch) { debug("no chessRef.current"); return; }
    if (ch.turn !== "white") {
      debug("IGNORED: not white's turn", { turn: ch.turn });
      return;
    }

    const fromSq = parseSquare(from);
    const toSq = parseSquare(to);
    if (fromSq === undefined || toSq === undefined) {
      debug("parseSquare undefined", { from, to, fromSq, toSq });
      return;
    }

    const piece = ch.board.get(fromSq);

    if (
      piece &&
      piece.role === "pawn" &&
      ((piece.color === "white" && Math.floor(toSq / 8) === 7) ||
       (piece.color === "black" && Math.floor(toSq / 8) === 0))
    ) {
      debug("pawn reached promotion rank, setting pendingPromotion", { from, to, color: piece.color });
      setPendingPromotion({ from, to, color: piece.color });
      return; // stop here until user picks promotion
    }

    const move: any = { from: fromSq, to: toSq };

    if (!challenge) {
      debug("no challenge → normal play");
      playMove(move, from, to, false);
      return;
    }

    const step = challenge.steps[challengeIndexRef.current];
    if (!step) {
      debug("no step at index", challengeIndex, "→ normal play");
      playMove(move, from, to, false);
      return;
    }

    const altstep = challenge.alt_steps?.[challengeIndexRef.current];

    const expectedWhite = step.white;
    debug("expected white @index", challengeIndex, expectedWhite);

    const matches = uciEqual(expectedWhite, from, to, undefined) ||(altstep ? uciEqual(altstep.white, from, to, undefined) : false);

    debug("uciEqual =", matches);

    if (matches) {
      if (expectedWhite.promotion) move.promotion = expectedWhite.promotion;

      playMove(move, from, to, false);
      setFeedback("Correct!");

      if (step.black) {
        // Wait for black reply before incrementing challengeIndex
        waitingForBlackRef.current = true;
        groundRef.current?.set({ movable: { color: ch.turn, free: false, dests: new Map(), showDests: false } });

        const delay = 450;
        blackMoveTimeoutRef.current = window.setTimeout(() => {
          group("auto black reply fired", () => {
            blackMoveTimeoutRef.current = null;
            const b = step.black!;
            const fromS = parseSquare(b.from);
            const toS = parseSquare(b.to);
            debug("black reply step", b, { fromS, toS });

            if (fromS !== undefined && toS !== undefined) {
              const bm: any = { from: fromS, to: toS };
              if (b.promotion) bm.promotion = b.promotion;
              playMove(bm, b.from, b.to, true);
            } else {
              console.warn("[tutorial] invalid black reply in challenge", b);
            }

            waitingForBlackRef.current = false;
            setChallengeIndex((prev) => {
              const next = prev + 1;
              debug("advance challengeIndex AFTER black reply", { prev, next });
              if (next >= challenge.steps.length) setFeedback("Completed!");
              else setFeedback(null);
              return next;
            });
          });
        }, delay);
        debug("scheduled auto black reply in", delay, "ms");
      } else {
        // No black reply: safe to increment immediately
        setChallengeIndex((prev) => {
          const next = prev + 1;
          debug("advance challengeIndex (white-only step)", { prev, next });
          if (next >= challenge.steps.length) setFeedback("Completed!");
          else setFeedback(null);
          return next;
        });
      }
      return;
    }

    // Incorrect
    setFeedback("Incorrect — try again");
    debug("INCORRECT move", { from, to, expected: expectedWhite, index: challengeIndex });
    window.setTimeout(() => resetChallengeAndBoard(null, "incorrect"), 700);
  });
};



  const promotePawn = (role: PromotionRole) => {
    group(`promotePawn -> ${role}`, () => {
      if (!pendingPromotion) { debug("no pendingPromotion"); return; }
      const ch = chessRef.current;
      if (!ch) { debug("no chess"); return; }

      if (ch.turn !== "white" && ch.turn !== "black") {
        debug("unexpected turn on promotion", ch.turn);
        return;
      }

      const { from, to } = pendingPromotion;
      const fromSq = parseSquare(from);
      const toSq = parseSquare(to);
      if (fromSq === undefined || toSq === undefined) {
        debug("promotion parseSquare undefined", { from, to });
        setPendingPromotion(null);
        return;
      }

      const move: any = { from: fromSq, to: toSq, promotion: role };

      if (challenge) {
        const step = challenge.steps[challengeIndex];
        const expected = step?.white;
        debug("promotion expected @index", challengeIndex, expected);

        if (expected && expected.promotion) {
          if (uciEqual(expected, from, to, role)) {
            playMove(move, from, to, false);
            setPendingPromotion(null);
            setFeedback("Correct!");

            setChallengeIndex((prev) => {
              const next = prev + 1;
              debug("advance challengeIndex (promotion)", { prev, next });
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
            setFeedback("Incorrect promotion — try again");
            setPendingPromotion(null);
            window.setTimeout(() => resetChallengeAndBoard(null, "wrong-promotion"), 700);
            return;
          }
        }
      }

      // Not a challenge or not expected promotion — play normally
      playMove(move, from, to, false);
      setPendingPromotion(null);
    });
  };

// mount Chessground
useEffect(() => {
  // capture & narrow the ref *once* at the top of the effect
  const mountEl = containerRef.current;
  if (!mountEl) return;

  const cfg: Config = {
    fen: internalFen,
    orientation: currentOrientation,
    highlight: { lastMove: true, check: true },
    movable: { color: chess?.turn ?? "white", free: false, showDests: true, dests: new Map(), events: { after: handleMove } },
    animation: { enabled: true, duration: 240 },
    draggable: { enabled: true },
    drawable: { enabled: false },
  };

  group("mount Chessground", () => {
    // use the non-null mountEl captured above
    groundRef.current = Chessground(mountEl, cfg);
    debug("initial ground movable.color", chess?.turn ?? "white");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          groundRef.current?.set({ fen: internalFen });
          debug("post-mount fen applied", internalFen);
        } catch (e) {
          debug("failed to set fen post-mount", e);
        }
      });
    });
  });

  return () => {
    group("unmount Chessground", () => {
      if (blackMoveTimeoutRef.current !== null) {
        debug("clearing pending blackMoveTimeout on unmount", blackMoveTimeoutRef.current);
        clearTimeout(blackMoveTimeoutRef.current);
        blackMoveTimeoutRef.current = null;
      }
      groundRef.current?.destroy();
      groundRef.current = null;
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // mount once


  // sync chess -> chessground
  useEffect(() => {
    if (!groundRef.current || !chess) return;
    chessRef.current = chess;

    group("sync chess -> ground", () => {
      const dests = makeDestsFromChess(chess);
      const fen = makeFen(chess.toSetup());
      groundRef.current.set({
        fen,
        turnColor: chess.turn,
        orientation: currentOrientation,
        movable: { color: chess.turn, free: false, dests, events: { after: handleMove }, showDests: true },
        lastMove: lastMoveRef.current,
        highlight: { check: true, custom: getCheckHighlights(chess) },
      });
      setInternalFen(fen);
      debug("synced", { fen, turn: chess.turn, lastMove: lastMoveRef.current });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, currentOrientation]);

  // ensure visible fen updates when internalFen or size changes
  useEffect(() => {
    if (!groundRef.current) return;
    try {
      groundRef.current.set({ fen: internalFen });
      debug("applied internalFen to ground", internalFen);
    } catch (e) {
      debug("failed to apply internalFen", e);
    }
  }, [internalFen, size]);

  // UI
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
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

        {challenge && (feedback === "Completed!" || challengeIndex >= challenge.steps.length) && (
          <button
            onClick={() => resetChallengeAndBoard(null, "try-again")}
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

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
        <div
          ref={containerRef}
          className="cg-wrap"
          style={{ width: size, maxWidth: "100%", height: size, boxSizing: "border-box", borderRadius: 8, overflow: "hidden" }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", width: "100%" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {showControls && (
            <button
              onClick={() => {
                const newOrientation = currentOrientation === "white" ? "black" : "white";
                setCurrentOrientation(newOrientation);
                groundRef.current?.set({ orientation: newOrientation });
                debug("flip orientation ->", newOrientation);
              }}
            >
              Flip
            </button>
          )}

          {showControls && (
            <button onClick={() => resetChallengeAndBoard(null, "reset-button")}>
              Reset
            </button>
          )}
        </div>

        {showControls && (
          <div style={{ marginLeft: 8, fontSize: 12, color: "#999", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>
            {internalFen}
          </div>
        )}
      </div>

      {pendingPromotion && (
        <div
          onClick={() => {
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
            debug("dismiss promotion modal");
            setPendingPromotion(null);
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 900,
            backgroundColor: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "white", border: "2px solid black", borderRadius: 8, padding: 10, display: "flex", gap: 10 }}>
            {["queen", "rook", "bishop", "knight", "champion", "princess"].map((role) => (
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
