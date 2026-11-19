// src/pages/LocalGamePage.tsx
// Pass-and-play: two players share one device. Setup (names, token budget, clock) ->
// player 1 drafts -> hand-off -> player 2 drafts -> coin flip for colors -> game.
// The token budget is chosen per game here; online games always use the standard budget.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseSquare, makeUci } from "chessops/util";
import type { NormalMove } from "chessops/types";
import { makeSan } from "chessops/san";
import DraftBuilder from "../components/DraftBuilder";
import { card, cardHead, cardTitle, muted } from "../components/homeCards";
import {
  calculateDests,
  getCheckHighlights,
  playMoveSound,
  playResultSound,
  promotionForMove,
} from "../utils/chessHelpers";
import { STANDARD_BUDGET, computeCostOfColorFromFen } from "../utils/draftCost";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";

type Color = "white" | "black";
type PlayerIdx = 0 | 1;
type ClockSetting = { minutes: number; increment: number } | null;
type Settings = { names: [string, string]; budget: number; clock: ClockSetting };
type Stage =
  | { kind: "setup" }
  | { kind: "draft"; player: PlayerIdx }
  | { kind: "handoff" }
  | { kind: "coin" }
  | { kind: "game"; whiteIdx: PlayerIdx };

const MIN_BUDGET = 1;
const MAX_BUDGET = 150;
const BUDGET_PRESETS = [20, 30, STANDARD_BUDGET, 50, 75];
const MINUTE_OPTIONS = [1, 2, 3, 5, 10, 15, 30, 60];
const BOARD_PX = 624; // chessground boards must be a multiple of 8px

const DEFAULT_SETTINGS: Settings = {
  names: ["Player 1", "Player 2"],
  budget: STANDARD_BUDGET,
  clock: null,
};

const opposite = (c: Color): Color => (c === "white" ? "black" : "white");

// ---- start position: same construction as the server's getCombinedStartFens ----

function homeRows(draftFen: string): string[] {
  const rows = draftFen.split(" ")[0].split("/");
  if (rows.length !== 8) throw new Error("Invalid draft FEN");
  return rows.slice(-2); // ranks 2 and 1, drafted from White's side
}

function combineArmies(whiteDraft: string, blackDraft: string): string {
  const blackTop = homeRows(blackDraft).slice().reverse().map((r) => r.toLowerCase());
  return `${[...blackTop, "8", "8", "8", "8", ...homeRows(whiteDraft)].join("/")} w KQkq - 0 1`;
}

// ============================================================================

export default function LocalGamePage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [stage, setStage] = useState<Stage>({ kind: "setup" });
  const [armies, setArmies] = useState<[string | null, string | null]>([null, null]);
  const [gameNo, setGameNo] = useState(0); // remounts the board for rematches

  const { names } = settings;
  const stepIndex =
    stage.kind === "setup" ? 0
    : stage.kind === "draft" ? 1 + stage.player
    : stage.kind === "handoff" ? 2
    : stage.kind === "coin" ? 3
    : 4;
  const steps = ["Setup", `${names[0]} drafts`, `${names[1]} drafts`, "Coin flip", "Play"];

  function startDrafting(next: Settings) {
    setSettings(next);
    setArmies([null, null]);
    setStage({ kind: "draft", player: 0 });
  }

  function finishDraft(player: PlayerIdx, fen: string) {
    setArmies((a) => (player === 0 ? [fen, a[1]] : [a[0], fen]));
    setStage(player === 0 ? { kind: "handoff" } : { kind: "coin" });
  }

  function startGame(whiteIdx: PlayerIdx) {
    setGameNo((n) => n + 1);
    setStage({ kind: "game", whiteIdx });
  }

  return (
    <div className="app-container local-page">
      <style>{LOCAL_CSS}</style>

      <ol className="local-steps" aria-label="Game setup progress">
        {steps.map((label, i) => (
          <li key={i} className={i === stepIndex ? "is-current" : i < stepIndex ? "is-done" : undefined}>
            <span className="local-step-num">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {stage.kind === "setup" && <SetupScreen initial={settings} onStart={startDrafting} />}

      {stage.kind === "draft" && (
        <DraftScreen
          key={stage.player}
          playerName={names[stage.player]}
          budget={settings.budget}
          onDone={(fen) => finishDraft(stage.player, fen)}
        />
      )}

      {stage.kind === "handoff" && (
        <section style={card} className="local-panel">
          <h2 className="local-heading">Pass the device to {names[1]}</h2>
          <p style={muted}>
            {names[0]}'s army is locked in and hidden. {names[1]}, build yours without peeking at theirs.
          </p>
          <button className="btn-primary local-cta" onClick={() => setStage({ kind: "draft", player: 1 })}>
            I'm {names[1]}, start drafting
          </button>
        </section>
      )}

      {stage.kind === "coin" && <CoinScreen names={names} onDecided={startGame} />}

      {stage.kind === "game" && armies[0] && armies[1] && (
        <LocalGame
          key={gameNo}
          startFen={combineArmies(armies[stage.whiteIdx]!, armies[1 - stage.whiteIdx]!)}
          whiteName={names[stage.whiteIdx]}
          blackName={names[1 - stage.whiteIdx]}
          clock={settings.clock}
          onRematch={() => setStage({ kind: "coin" })}
          onRedraft={() => startDrafting(settings)}
          onNewSetup={() => setStage({ kind: "setup" })}
        />
      )}
    </div>
  );
}

// ---- Step 1: setup ----------------------------------------------------------

function SetupScreen({ initial, onStart }: { initial: Settings; onStart: (s: Settings) => void }) {
  const [names, setNames] = useState<[string, string]>(initial.names);
  const [budgetText, setBudgetText] = useState(String(initial.budget));
  const [useClock, setUseClock] = useState(initial.clock !== null);
  const [minutes, setMinutes] = useState(initial.clock?.minutes ?? 10);
  const [increment, setIncrement] = useState(initial.clock?.increment ?? 0);

  const budget = Number(budgetText);
  const budgetOk = Number.isInteger(budget) && budget >= MIN_BUDGET && budget <= MAX_BUDGET;
  const incrementOk = Number.isInteger(increment) && increment >= 0 && increment <= 60;
  const canStart = budgetOk && (!useClock || incrementOk);

  function start() {
    if (!canStart) return;
    const clean = (n: string, i: number) => n.trim().slice(0, 24) || `Player ${i + 1}`;
    onStart({
      names: [clean(names[0], 0), clean(names[1], 1)],
      budget,
      clock: useClock ? { minutes, increment } : null,
    });
  }

  return (
    <section style={card} className="local-panel local-setup">
      <div style={cardHead}>
        <h2 style={{ ...cardTitle, fontSize: 18 }}>Pass &amp; Play</h2>
      </div>
      <p className="local-intro">
        Two players, one device. Each player drafts an army in secret, then a coin flip decides who plays White.
      </p>

      <div className="local-field">
        <span className="local-label">Players</span>
        <div className="local-row">
          {[0, 1].map((i) => (
            <input
              key={i}
              type="text"
              value={names[i]}
              maxLength={24}
              aria-label={`Player ${i + 1} name`}
              onChange={(e) => setNames((n) => (i === 0 ? [e.target.value, n[1]] : [n[0], e.target.value]))}
            />
          ))}
        </div>
      </div>

      <div className="local-field">
        <span className="local-label">Token budget (each player)</span>
        <div className="local-row">
          <input
            type="number"
            min={MIN_BUDGET}
            max={MAX_BUDGET}
            value={budgetText}
            onChange={(e) => setBudgetText(e.target.value)}
            style={{ width: 80 }}
            aria-label="Token budget"
          />
          {BUDGET_PRESETS.map((b) => (
            <button
              key={b}
              type="button"
              className={budget === b ? "local-chip is-on" : "local-chip"}
              onClick={() => setBudgetText(String(b))}
            >
              {b}
              {b === STANDARD_BUDGET ? " (standard)" : ""}
            </button>
          ))}
        </div>
        {!budgetOk && (
          <div className="local-error">Enter a whole number from {MIN_BUDGET} to {MAX_BUDGET}.</div>
        )}
      </div>

      <div className="local-field">
        <label className="local-row" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={useClock} onChange={(e) => setUseClock(e.target.checked)} />
          <span>Use a clock</span>
        </label>
        {useClock && (
          <div className="local-row" style={{ marginTop: 8 }}>
            <label>
              Minutes{" "}
              <select value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value))}>
                {MINUTE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Increment (sec){" "}
              <input
                type="number"
                min={0}
                max={60}
                value={increment}
                onChange={(e) => setIncrement(parseInt(e.target.value) || 0)}
                style={{ width: 64 }}
              />
            </label>
          </div>
        )}
        {useClock && !incrementOk && <div className="local-error">Increment must be 0 to 60 seconds.</div>}
      </div>

      <div className="local-row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <Link to="/play" style={{ color: "#aaa" }}>← Back to Play</Link>
        <button className="btn-primary local-cta" onClick={start} disabled={!canStart}>
          Start drafting
        </button>
      </div>
    </section>
  );
}

// ---- Steps 2–3: drafting ----------------------------------------------------

type SavedDraft = { id: string; name: string; data?: { fen?: string } };

function DraftScreen({
  playerName,
  budget,
  onDone,
}: {
  playerName: string;
  budget: number;
  onDone: (fen: string) => void;
}) {
  const { user } = useAuth();
  const saveRef = useRef<() => void>(() => {});
  const registerSave = useCallback((fn: () => void) => { saveRef.current = fn; }, []);

  // A signed-in user can start from one of their saved drafts, if it fits this budget.
  const [saved, setSaved] = useState<SavedDraft[]>([]);
  const [loadedId, setLoadedId] = useState("");
  useEffect(() => {
    if (!user) return;
    let alive = true;
    apiFetch("/drafts")
      .then((ds: SavedDraft[]) => alive && setSaved(ds))
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);
  const fitting = saved.filter((d) => d.data?.fen && computeCostOfColorFromFen(d.data.fen, "white") <= budget);
  const loadedFen = fitting.find((d) => d.id === loadedId)?.data?.fen;

  return (
    <>
      <div className="draft-toolbar local-draft-bar">
        <span>
          <strong>{playerName}</strong>, build your army · {budget} tokens
        </span>
        {fitting.length > 0 && (
          <select value={loadedId} onChange={(e) => setLoadedId(e.target.value)} aria-label="Start from a saved draft">
            <option value="">Start from a saved draft…</option>
            {fitting.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        <div className="toolbar-divider" />
        <button className="btn-primary" onClick={() => saveRef.current()}>
          Done
        </button>
      </div>
      <DraftBuilder
        budget={budget}
        initialFen={loadedFen}
        onSave={(fen) => onDone(fen)}
        onRegisterSave={registerSave}
        saveLabel="Done"
      />
    </>
  );
}

// ---- Step 4: coin flip ------------------------------------------------------

function CoinScreen({ names, onDecided }: { names: [string, string]; onDecided: (whiteIdx: PlayerIdx) => void }) {
  const [whiteIdx, setWhiteIdx] = useState<PlayerIdx | null>(null);

  return (
    <section style={card} className="local-panel" aria-live="polite">
      <h2 className="local-heading">Both armies are in</h2>
      <img src="/images/single-coin.svg" alt="" width={72} height={72} style={{ alignSelf: "center", margin: "8px 0" }} />
      {whiteIdx === null ? (
        <>
          <p style={muted}>Flip the coin to decide who plays White and moves first.</p>
          <button className="btn-primary local-cta" onClick={() => setWhiteIdx(Math.random() < 0.5 ? 0 : 1)}>
            Flip coin
          </button>
        </>
      ) : (
        <>
          <p className="local-coin-result">
            <strong>{names[whiteIdx]}</strong> plays White · <strong>{names[1 - whiteIdx]}</strong> plays Black
          </p>
          <button className="btn-primary local-cta" onClick={() => onDecided(whiteIdx)}>
            Start game
          </button>
        </>
      )}
    </section>
  );
}

// ---- Step 5: the game -------------------------------------------------------

type ClockState = { whiteMs: number; blackMs: number; running: Color | null; lastStartTs: number | null };
type Result = { score: "1-0" | "0-1" | "1/2-1/2"; reason: string };

function remainingMs(c: ClockState, color: Color, now: number) {
  const base = color === "white" ? c.whiteMs : c.blackMs;
  return c.running === color && c.lastStartTs !== null ? base - (now - c.lastStartTs) : base;
}

function formatMs(ms: number) {
  const clamped = Math.max(0, ms);
  const total = Math.floor(clamped / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  // tenths under 10 seconds, so a close finish is readable
  if (clamped < 10_000) return `${m}:${s.toString().padStart(2, "0")}.${Math.floor((clamped % 1000) / 100)}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Same end-of-game rules as the server's move handler.
function gameEnd(chess: Chess): Result | null {
  if (chess.isCheckmate()) {
    return { score: chess.turn === "white" ? "0-1" : "1-0", reason: "Checkmate" };
  }
  if (chess.isStalemate()) {
    // stalemating with a general (no king) wins
    const stalemater = opposite(chess.turn);
    if (chess.board.kingOf(stalemater) === undefined) {
      return { score: stalemater === "white" ? "1-0" : "0-1", reason: "Stalemate by a general" };
    }
    return { score: "1/2-1/2", reason: "Stalemate" };
  }
  if (chess.isInsufficientMaterial()) return { score: "1/2-1/2", reason: "Insufficient material" };
  return null;
}

function LocalGame({
  startFen,
  whiteName,
  blackName,
  clock: clockSetting,
  onRematch,
  onRedraft,
  onNewSetup,
}: {
  startFen: string;
  whiteName: string;
  blackName: string;
  clock: ClockSetting;
  onRematch: () => void;
  onRedraft: () => void;
  onNewSetup: () => void;
}) {
  const navigate = useNavigate();
  const nameOf = useCallback((c: Color) => (c === "white" ? whiteName : blackName), [whiteName, blackName]);

  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<ReturnType<typeof Chessground> | null>(null);
  // the drafts were each validated while building, so a bad start position should not happen
  const [initial] = useState(() => {
    try {
      return { chess: Chess.fromSetup(parseFen(startFen).unwrap()).unwrap(), error: null };
    } catch (err) {
      return { chess: null, error: err instanceof Error ? err.message : String(err) };
    }
  });
  const chessRef = useRef<Chess | null>(initial.chess);
  const setupError = initial.error;

  const sanRef = useRef<string[]>([]);
  const uciRef = useRef<string[]>([]);
  const [fen, setFen] = useState(startFen);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [orientation, setOrientation] = useState<Color>("white");
  const [autoFlip, setAutoFlip] = useState(true);
  const autoFlipRef = useRef(autoFlip);
  useEffect(() => { autoFlipRef.current = autoFlip; }, [autoFlip]);

  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: Color } | null>(null);

  const [clock, setClock] = useState<ClockState | null>(() =>
    clockSetting
      ? { whiteMs: clockSetting.minutes * 60_000, blackMs: clockSetting.minutes * 60_000, running: null, lastStartTs: null }
      : null,
  );
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const [now, setNow] = useState(() => Date.now());

  const finish = useCallback((r: Result) => {
    if (resultRef.current) return;
    resultRef.current = r;
    setResult(r);
    setPendingPromotion(null);
    // freeze the clock at the moment the game ended
    const c = clockRef.current;
    if (c?.running && c.lastStartTs !== null) {
      const t = Date.now();
      setClock({ ...c, whiteMs: remainingMs(c, "white", t), blackMs: remainingMs(c, "black", t), running: null, lastStartTs: null });
    }
    playResultSound("draw");
  }, []);

  // Clock tick + flag fall. The clock starts on White's first move, like online games.
  useEffect(() => {
    if (!clock?.running || result) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const c = clockRef.current;
      if (c?.running && remainingMs(c, c.running, t) <= 0) {
        const flagged = c.running;
        finish({ score: flagged === "white" ? "0-1" : "1-0", reason: `${nameOf(flagged)} ran out of time` });
      }
    }, 100);
    return () => clearInterval(id);
  }, [clock?.running, clock?.lastStartTs, result, finish, nameOf]);

  // Charge the mover's time, add increment, and start the opponent's clock.
  // Returns true if the mover had already flagged.
  function pressClock(mover: Color): boolean {
    const c = clockRef.current;
    if (!c || !clockSetting) return false;
    const t = Date.now();
    const left = c.running ? remainingMs(c, mover, t) : mover === "white" ? c.whiteMs : c.blackMs;
    if (left <= 0) return true;
    const after = left + clockSetting.increment * 1000;
    const next: ClockState = {
      whiteMs: mover === "white" ? after : c.whiteMs,
      blackMs: mover === "black" ? after : c.blackMs,
      running: opposite(mover),
      lastStartTs: t,
    };
    clockRef.current = next;
    setClock(next);
    setNow(t);
    return false;
  }

  function playMove(from: string, to: string, promotion: string | null) {
    const chess = chessRef.current;
    if (!chess || resultRef.current) return;
    const fromSq = parseSquare(from)!;
    const toSq = parseSquare(to)!;
    const move = (promotion ? { from: fromSq, to: toSq, promotion } : { from: fromSq, to: toSq }) as NormalMove;
    if (!chess.isLegal(move)) {
      groundRef.current?.set({ fen: makeFen(chess.toSetup()) });
      return;
    }

    const mover = chess.turn;
    if (pressClock(mover)) {
      finish({ score: mover === "white" ? "0-1" : "1-0", reason: `${nameOf(mover)} ran out of time` });
      groundRef.current?.set({ fen: makeFen(chess.toSetup()) });
      return;
    }

    try { sanRef.current.push(makeSan(chess, move)); } catch { sanRef.current.push(makeUci(move)); }
    uciRef.current.push(makeUci(move));
    playMoveSound(chess, move, from, to, chess.board.get(toSq) ?? null);
    chess.play(move);

    setFen(makeFen(chess.toSetup()));
    setLastMove([from, to]);
    const end = gameEnd(chess);
    if (end) finish(end);
    else if (autoFlipRef.current) setOrientation(chess.turn);
  }

  function onBoardMove(from: string, to: string) {
    const chess = chessRef.current;
    if (!chess || resultRef.current) return;
    const { auto, choose } = promotionForMove(chess, parseSquare(from)!, parseSquare(to)!);
    if (choose) {
      setPendingPromotion({ from, to, color: chess.turn });
      return;
    }
    playMove(from, to, auto);
  }
  const onBoardMoveRef = useRef(onBoardMove);
  onBoardMoveRef.current = onBoardMove;

  // ---- board ----
  useEffect(() => {
    if (!containerRef.current) return;
    groundRef.current = Chessground(containerRef.current, {
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true },
      animation: { enabled: true, duration: 200 },
    } as Config);
    return () => groundRef.current?.destroy();
  }, []);

  useEffect(() => {
    const chess = chessRef.current;
    if (!groundRef.current || !chess) return;
    const canMove = !result && !pendingPromotion;
    groundRef.current.set({
      fen,
      orientation,
      turnColor: chess.turn,
      lastMove: lastMove ?? undefined,
      highlight: { lastMove: true, check: true, custom: getCheckHighlights(chess) },
      movable: canMove
        ? {
            color: chess.turn,
            dests: calculateDests(chess),
            showDests: true,
            free: false,
            events: { after: (o: string, d: string) => onBoardMoveRef.current(o, d) },
          }
        : { color: undefined, dests: new Map(), free: false, events: {} },
    } as Config);
  }, [fen, lastMove, orientation, result, pendingPromotion]);

  // ---- flipping ----
  const flip = useCallback(() => setOrientation((o) => opposite(o)), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) flip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);

  function toggleAutoFlip(on: boolean) {
    setAutoFlip(on);
    if (on && chessRef.current && !resultRef.current) setOrientation(chessRef.current.turn);
  }

  // ---- resign / draw ----
  function resign(color: Color) {
    if (resultRef.current) return;
    if (!window.confirm(`${nameOf(color)}, resign this game?`)) return;
    finish({ score: color === "white" ? "0-1" : "1-0", reason: `${nameOf(color)} resigned` });
  }
  function agreeDraw() {
    if (resultRef.current) return;
    if (!window.confirm("Do both players agree to a draw?")) return;
    finish({ score: "1/2-1/2", reason: "Draw by agreement" });
  }

  if (setupError) {
    return (
      <section style={card} className="local-panel">
        <h2 className="local-heading">These armies can't start a game</h2>
        <p style={muted}>{setupError}</p>
        <button className="btn-primary local-cta" onClick={onRedraft}>Draft again</button>
      </section>
    );
  }

  const chess = chessRef.current!;
  const turn = chess.turn;
  const top = opposite(orientation);
  const bottom = orientation;
  const resultText = result
    ? result.score === "1/2-1/2"
      ? "Draw"
      : `${nameOf(result.score === "1-0" ? "white" : "black")} wins`
    : null;

  const panel = (color: Color) => (
    <PlayerPanel
      name={nameOf(color)}
      color={color}
      toMove={!result && turn === color}
      ms={clock ? remainingMs(clock, color, now) : null}
      onResign={result ? undefined : () => resign(color)}
    />
  );

  return (
    <div className="local-game">
      <div ref={containerRef} className="cg-wrap" style={{ width: BOARD_PX, height: BOARD_PX, flex: "0 0 auto" }} />

      <div className="local-side">
        {panel(top)}

        <div className="local-side-mid">
          {result ? (
            <div className="local-result" role="status">
              <div className="local-result-title">{resultText}</div>
              <div style={muted}>{result.reason} · {result.score}</div>
            </div>
          ) : (
            <div className="local-turn" role="status">
              {nameOf(turn)} to move <span style={{ color: "#888" }}>({turn})</span>
            </div>
          )}

          <div className="local-row">
            <button className="btn-ghost" onClick={flip} title="Flip board (F)">⇅ Flip</button>
            <label className="local-row" style={{ cursor: "pointer", fontSize: 13 }} title="Turn the board toward whoever is to move">
              <input type="checkbox" checked={autoFlip} onChange={(e) => toggleAutoFlip(e.target.checked)} />
              Auto-flip
            </label>
          </div>

          {!result && (
            <button className="btn-ghost" onClick={agreeDraw}>½ Agree draw</button>
          )}

          {result && (
            <div className="local-col">
              <button className="btn-primary" onClick={onRematch}>Rematch (same armies)</button>
              <button className="btn-ghost" onClick={onRedraft}>Rematch with new armies</button>
              <button className="btn-ghost" onClick={onNewSetup}>Change setup</button>
              <button
                className="btn-ghost"
                onClick={() =>
                  navigate("/analysis", {
                    state: { initialFen: startFen, initialMoves: sanRef.current, initialUci: uciRef.current, orientation },
                  })
                }
              >
                Review game
              </button>
            </div>
          )}
        </div>

        {panel(bottom)}
      </div>

      {pendingPromotion && (
        <div className="local-promo-backdrop" onClick={() => setPendingPromotion(null)}>
          <div className="local-promo" onClick={(e) => e.stopPropagation()}>
            {["queen", "rook", "bishop", "knight"].map((role) => (
              <button
                key={role}
                aria-label={`Promote to ${role}`}
                onClick={() => {
                  const { from, to } = pendingPromotion;
                  setPendingPromotion(null);
                  playMove(from, to, role);
                }}
              >
                <div className={`cg-piece ${role} ${pendingPromotion.color}`} style={{ width: 45, height: 45 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerPanel({
  name,
  color,
  toMove,
  ms,
  onResign,
}: {
  name: string;
  color: Color;
  toMove: boolean;
  ms: number | null;
  onResign?: () => void;
}) {
  return (
    <div className={toMove ? "local-player is-active" : "local-player"}>
      <div className="local-row" style={{ justifyContent: "space-between" }}>
        <span className="local-player-name">
          <span className={`local-dot local-dot-${color}`} aria-hidden="true" />
          {name}
        </span>
        {onResign && (
          <button className="local-resign" onClick={onResign} title={`${name} resigns`}>
            Resign
          </button>
        )}
      </div>
      {ms !== null && <div className={ms < 10_000 ? "local-clock is-low" : "local-clock"}>{formatMs(ms)}</div>}
    </div>
  );
}

const LOCAL_CSS = `
.local-page { padding: 20px; max-width: 1200px; margin: 0 auto; text-align: left; }
.local-steps { list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 18px; margin: 0 0 20px; padding: 0; font-size: 13px; color: #777; }
.local-steps li { display: flex; align-items: center; gap: 6px; }
.local-steps li.is-current { color: #e8dcc0; font-weight: 600; }
.local-steps li.is-done { color: #aaa; }
.local-step-num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; border: 1px solid currentColor; font-size: 11px; }
.local-steps li.is-current .local-step-num { border-color: #d4af37; color: #d4af37; }
.local-panel { max-width: 560px; margin: 0 auto; gap: 12px; }
.local-heading { margin: 0; font-size: 20px; color: #e8dcc0; }
.local-cta { align-self: flex-end; cursor: pointer; }
.local-field { display: flex; flex-direction: column; gap: 6px; }
.local-label { font-size: 13px; color: #bbb; }
.local-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.local-col { display: flex; flex-direction: column; gap: 8px; }
.local-row input[type="text"] { flex: 1; min-width: 120px; }
.local-chip { padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: #ccc; font-size: 13px; cursor: pointer; }
.local-chip.is-on { border-color: #d4af37; color: #d4af37; }
.local-error { color: #ff8a80; font-size: 12px; }
.local-setup { max-width: 660px; padding: 24px 28px !important; gap: 18px; font-size: 16px; }
.local-setup .local-intro { margin: 0; color: #999; font-size: 15px; line-height: 1.5; }
.local-setup .local-label { font-size: 15px; }
.local-setup .local-field { gap: 8px; }
.local-setup .local-row { gap: 10px; }
.local-setup input[type="text"], .local-setup input[type="number"], .local-setup select { font-size: 16px; padding: 6px 8px; }
.local-setup input[type="checkbox"] { width: 16px; height: 16px; }
.local-setup .local-chip { font-size: 15px; padding: 6px 14px; }
.local-setup .local-error { font-size: 14px; }
.local-coin-result { font-size: 17px; text-align: center; margin: 4px 0 8px; }
.local-draft-bar { justify-content: center; }
.local-game { display: flex; justify-content: center; align-items: stretch; gap: 20px; }
.local-side { display: flex; flex-direction: column; justify-content: space-between; gap: 14px; width: 260px; padding: 14px; background: #1e1e1e; border-radius: 8px; box-sizing: border-box; }
.local-side-mid { display: flex; flex-direction: column; gap: 10px; }
.local-turn { font-size: 15px; text-align: center; }
.local-result { text-align: center; }
.local-result-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.local-player { padding: 10px; border-radius: 6px; background: #141414; border: 2px solid #333; }
.local-player.is-active { background: #2a2a2a; border-color: #4caf50; }
.local-player-name { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
.local-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #888; }
.local-dot-white { background: #f0f0f0; }
.local-dot-black { background: #111; }
.local-clock { margin-top: 6px; font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; }
.local-clock.is-low { color: #ff8a80; }
.local-resign { background: transparent; border: none; color: #888; font-size: 12px; cursor: pointer; padding: 2px 4px; }
.local-resign:hover { color: #ff8a80; }
.local-promo-backdrop { position: fixed; inset: 0; z-index: 900; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; }
.local-promo { display: flex; gap: 10px; padding: 10px; background: #fff; border: 2px solid #000; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.local-promo button { padding: 0; border: none; background: none; cursor: pointer; }
`;
