import { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseSquare, makeSquare, parseUci, makeUci } from "chessops/util";
import { makeSan } from "chessops/san";
import { calculateDests, getCheckHighlights, playMoveSound, playResultSound } from "../utils/chessHelpers";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";

const DEFAULT_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Default back rows for each side when no draft is selected
const COMPUTER_WHITE_ROWS = ["PPPPPPPP", "RNBQKBNR"];
const STANDARD_WHITE_ROWS = ["PPPPPPPP", "RNBQKBNR"];

type Draft = { id: string; name: string; data: { fen?: string }; isActive: boolean; slot: number };

function extractWhiteRows(fen: string): string[] {
  const rows = fen.split(" ")[0].split("/");
  if (rows.length !== 8) throw new Error("Invalid FEN");
  return rows.slice(-2); // ranks 2 and 1 (white's home rows)
}

function mirrorAndLower(rows: string[]): string[] {
  return rows.slice().reverse().map((r) => r.toLowerCase());
}

function buildStartFen(
  playerFen: string | null,
  playerColor: "white" | "black",
  engineFen: string | null,
): string {
  const playerRows = playerFen ? extractWhiteRows(playerFen) : STANDARD_WHITE_ROWS;
  const engineRows = engineFen ? extractWhiteRows(engineFen) : COMPUTER_WHITE_ROWS;
  const whiteBottom = playerColor === "white" ? playerRows : engineRows;
  const blackTop = playerColor === "white"
    ? mirrorAndLower(engineRows)
    : mirrorAndLower(playerRows);
  const combined = [...blackTop, "8", "8", "8", "8", ...whiteBottom].join("/");
  return `${combined} w KQkq - 0 1`;
}

type Phase = "setup" | "playing" | "gameover";

export default function ComputerGamePage({ initialFen, watchMode }: { initialFen?: string; watchMode?: boolean } = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<any>(null);
  const gameMovesRef = useRef<string[]>([]);   // SAN strings for review
  const gameStartFenRef = useRef<string>(initialFen ?? DEFAULT_START_FEN);
  const chessRef = useRef<Chess>((() => {
    if (initialFen) {
      try { return Chess.fromSetup(parseFen(initialFen).unwrap()).unwrap(); } catch {}
    }
    return Chess.default();
  })());
  const workerRef = useRef<Worker | null>(null);

  // The computed start FEN (may differ from default if user has an active draft)
  const startFenRef = useRef<string>(initialFen ?? DEFAULT_START_FEN);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedEngineDraftId, setSelectedEngineDraftId] = useState<string | null>(null);

  const [fen, setFen] = useState(initialFen ?? DEFAULT_START_FEN);
  const fenRef = useRef(initialFen ?? DEFAULT_START_FEN);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);

  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const playerColorRef = useRef<"white" | "black">("white");
  const watchModeRef = useRef(!!watchMode);

  const [phase, setPhase] = useState<Phase>("setup");
  const phaseRef = useRef<Phase>("setup");

  const [engineReady, setEngineReady] = useState(false);
  const engineReadyRef = useRef(false);

  const [engineThinking, setEngineThinking] = useState(false);
  const engineThinkingRef = useRef(false);

  const [gameResult, setGameResult] = useState<string | null>(null);

  const movetimeRef = useRef(1000);
  const [movetime, setMovetime] = useState(1000);

  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string; to: string; color: "white" | "black";
  } | null>(null);

  // Stable ref for the engine message handler so the worker closure never goes stale
  const onEngineLineRef = useRef<(line: string) => void>(() => {});

  useEffect(() => { playerColorRef.current = playerColor; }, [playerColor]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { movetimeRef.current = movetime; }, [movetime]);

  // Fetch all drafts when the user logs in/out; default selection = active draft.
  useEffect(() => {
    if (!user) { setDrafts([]); setSelectedDraftId(null); return; }
    apiFetch("/drafts")
      .then((res: Draft[]) => {
        setDrafts(res);
        const active = res.find((d) => d.isActive);
        setSelectedDraftId(active?.id ?? null);
      })
      .catch(() => { setDrafts([]); setSelectedDraftId(null); });
  }, [user]);

  // Recompute startFen whenever draft selections or player color change,
  // and update the board preview while still in setup phase.
  useEffect(() => {
    if (initialFen) return; // editor position overrides drafts
    const playerDraft = drafts.find((d) => d.id === selectedDraftId);
    const engineDraft = drafts.find((d) => d.id === selectedEngineDraftId);
    let newFen = DEFAULT_START_FEN;
    if (playerDraft?.data?.fen || engineDraft?.data?.fen) {
      try {
        newFen = buildStartFen(
          playerDraft?.data?.fen ?? null,
          playerColor,
          engineDraft?.data?.fen ?? null,
        );
      } catch {
        newFen = DEFAULT_START_FEN;
      }
    }
    startFenRef.current = newFen;
    if (phaseRef.current === "setup") {
      fenRef.current = newFen;
      setFen(newFen);
      try {
        chessRef.current = Chess.fromSetup(parseFen(newFen).unwrap()).unwrap();
      } catch {
        chessRef.current = Chess.default();
      }
    }
  }, [selectedDraftId, selectedEngineDraftId, playerColor, drafts, initialFen]);

  // ---- engine helpers (read refs, always fresh) ----

  function sendToEngine(cmd: string) {
    workerRef.current?.postMessage(cmd);
  }

  function askEngine() {
    if (!engineReadyRef.current || engineThinkingRef.current) return;
    engineThinkingRef.current = true;
    setEngineThinking(true);
    sendToEngine(`position fen ${fenRef.current}`);
    sendToEngine(`go movetime ${movetimeRef.current}`);
  }

  function applyEngineMove(uciStr: string) {
    const move = parseUci(uciStr);
    if (!move || !("from" in move)) {
      engineThinkingRef.current = false;
      setEngineThinking(false);
      return;
    }

    const chess = chessRef.current;
    const from = makeSquare(move.from);
    let to = makeSquare(move.to);

    if (move.from === move.to) {
      // Locust capture (archer shoot): engine uses from=to UCI format.
      // Try chess.play as-is first (chessops fork may handle from=to natively).
      // If that throws, walk the archer's legal dests to find the actual target.
      let applied = false;
      const locusSan = (() => { try { return makeSan(chess, move as any); } catch { return makeUci(move); } })();
      try {
        chess.play(move as any);
        gameMovesRef.current.push(locusSan);
        applied = true;
      } catch { /* fall through */ }

      if (!applied) {
        const dests = chess.allDests(chess.ctx());
        const targets = dests.get(move.from) ?? [];
        let found = false;
        for (const targetSq of targets) {
          const candidate: any = { from: move.from, to: targetSq };
          const candidateSan = (() => { try { return makeSan(chess, candidate); } catch { return makeUci(candidate); } })();
          try {
            chess.play(candidate);
            gameMovesRef.current.push(candidateSan);
            to = makeSquare(targetSq);
            found = true;
            break;
          } catch { /* try next */ }
        }
        if (!found) {
          engineThinkingRef.current = false;
          setEngineThinking(false);
          return;
        }
      }
      playMoveSound(chess, move as any, from, to, null);
    } else {
      // If the engine omits the promotion letter on a wizard-pawn back-rank swap, auto-promote to queen
      const movePiece = chess.board.get(move.from);
      const destPiece = chess.board.get(move.to);
      const fromRank = Math.floor(move.from / 8);
      if (
        movePiece?.role === 'wizard' &&
        (destPiece?.role === 'pawn' || destPiece?.role === 'painter' || destPiece?.role === 'snare') &&
        destPiece?.color === chess.turn &&
        (fromRank === 0 || fromRank === 7) &&
        !(move as any).promotion
      ) {
        const promoMap: Record<string, string> = {
          pawn: 'queen',
          painter: 'royalpainter',
          snare: 'rollingsnare',
        };
        (move as any).promotion = promoMap[destPiece.role];
      }

      const san = (() => { try { return makeSan(chess, move as any); } catch { return makeUci(move); } })();
      const preCaptured = chess.board.get(move.to) ?? null;
      playMoveSound(chess, move as any, from, to, preCaptured);
      try {
        chess.play(move as any);
        gameMovesRef.current.push(san);
      } catch {
        engineThinkingRef.current = false;
        setEngineThinking(false);
        return;
      }
    }

    const newFen = makeFen(chess.toSetup());
    fenRef.current = newFen;
    setFen(newFen);
    setLastMove([from, to]);
    engineThinkingRef.current = false;
    setEngineThinking(false);

    checkGameOver(chess);
    if (watchModeRef.current && phaseRef.current !== "gameover") {
      askEngine();
    }
  }

  function checkGameOver(chess: Chess) {
    if (chess.isCheckmate()) {
      const mated = chess.turn;
      const result = mated === "white" ? "0-1" : "1-0";
      const sound = watchModeRef.current ? "draw" : (mated === playerColorRef.current ? "lose" : "win");
      finishGame(result, sound);
    } else if (chess.isStalemate() || chess.isInsufficientMaterial()) {
      finishGame("1/2-1/2", "draw");
    }
  }

  function finishGame(result: string, sound: "win" | "lose" | "draw") {
    setGameResult(result);
    setPhase("gameover");
    phaseRef.current = "gameover";
    playResultSound(sound);
  }

  // ---- engine initialization ----

  useEffect(() => {
    onEngineLineRef.current = (line: string) => {
      if (line === "uciok") {
        sendToEngine("setoption name UCI_Variant value tokenvariant");
        sendToEngine("isready");
      } else if (line === "readyok") {
        if (!engineReadyRef.current) {
          engineReadyRef.current = true;
          setEngineReady(true);
        }
      } else if (line.startsWith("bestmove")) {
        const uciMove = line.split(" ")[1];
        if (uciMove && uciMove !== "(none)") {
          applyEngineMove(uciMove);
        } else {
          engineThinkingRef.current = false;
          setEngineThinking(false);
        }
      }
    };
  });

  useEffect(() => {
    const worker = new Worker("/engine-worker.js");
    workerRef.current = worker;
    worker.onmessage = (e) => onEngineLineRef.current(e.data);
    worker.onerror = (e) => console.error("Engine error:", e.message);
    worker.postMessage("uci");
    return () => worker.terminate();
  }, []);

  // ---- Chessground ----

  useEffect(() => {
    if (!containerRef.current) return;
    groundRef.current = Chessground(containerRef.current, {
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: false },
      animation: { enabled: true, duration: 300 },
    } as Config);
    return () => groundRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!groundRef.current) return;
    const chess = chessRef.current;
    const isPlayerTurn =
      !watchModeRef.current && phase === "playing" && !engineThinking && chess.turn === playerColor;

    groundRef.current.set({
      fen,
      turnColor: chess.turn,
      orientation: watchModeRef.current ? "white" : playerColor,
      highlight: { check: true, custom: getCheckHighlights(chess) },
      lastMove: lastMove ?? undefined,
      animation: { enabled: true, duration: 300 },
      movable: isPlayerTurn
        ? {
            color: playerColor,
            dests: calculateDests(chess),
            showDests: true,
            free: false,
            events: { after: handlePlayerMove },
          }
        : {
            color: undefined,
            free: false,
            showDests: false,
            dests: new Map(),
            events: {},
          },
    });
  }, [fen, lastMove, engineThinking, phase, playerColor]);

  // ---- move handling ----

  function handlePlayerMove(from: string, to: string) {
    if (phaseRef.current !== "playing" || engineThinkingRef.current) return;
    const chess = chessRef.current;
    const fromSq = parseSquare(from);
    const toSq = parseSquare(to);
    if (fromSq === undefined || toSq === undefined) return;

    const fromPiece = chess.board.get(fromSq);
    const toPiece = chess.board.get(toSq);
    const toRank = Math.floor(toSq / 8);
    const fromRank = Math.floor(fromSq / 8);

    // Auto-promotions (painter → royalpainter, snare → rollingsnare, wizard swap)
    let autoPromo: string | null = null;
    if (fromPiece?.role === "painter" && (toRank === 0 || toRank === 7)) {
      autoPromo = "royalpainter";
    } else if (fromPiece?.role === "snare" && (toRank === 0 || toRank === 7)) {
      autoPromo = "rollingsnare";
    } else if (
      fromPiece?.role === "wizard" && fromPiece.color === "white" &&
      toPiece?.role === "painter" && fromRank === 7
    ) {
      autoPromo = "royalpainter";
    } else if (
      fromPiece?.role === "wizard" && fromPiece.color === "black" &&
      toPiece?.role === "painter" && fromRank === 0
    ) {
      autoPromo = "royalpainter";
    } else if (
      fromPiece?.role === "wizard" && fromPiece.color === "white" &&
      toPiece?.role === "snare" && fromRank === 7
    ) {
      autoPromo = "rollingsnare";
    } else if (
      fromPiece?.role === "wizard" && fromPiece.color === "black" &&
      toPiece?.role === "snare" && fromRank === 0
    ) {
      autoPromo = "rollingsnare";
    }

    if (autoPromo) { executeMove(from, to, autoPromo); return; }

    // Pawn / wizard-pawn promotion needs modal
    const isPawnPromo = fromPiece?.role === "pawn" && (toRank === 0 || toRank === 7);
    const isWizardPawnPromo =
      fromPiece?.role === "wizard" && toPiece?.role === "pawn" &&
      (fromRank === 0 || fromRank === 7);

    if (isPawnPromo || isWizardPawnPromo) {
      const wrongDir =
        (fromPiece?.color === "white" && fromRank === 0) ||
        (fromPiece?.color === "black" && fromRank === 7);
      if (!wrongDir) {
        setPendingPromotion({ from, to, color: chess.turn });
        return;
      }
    }

    executeMove(from, to, null);
  }

  function executeMove(from: string, to: string, promotion: string | null) {
    const chess = chessRef.current;
    const fromSq = parseSquare(from)!;
    const toSq = parseSquare(to)!;
    const move: any = promotion
      ? { from: fromSq, to: toSq, promotion }
      : { from: fromSq, to: toSq };

    if (!chess.isLegal(move)) {
      groundRef.current?.set({ fen: fenRef.current });
      return;
    }

    try { gameMovesRef.current.push(makeSan(chess, move)); } catch { gameMovesRef.current.push(makeUci(move)); }

    const preCaptured = chess.board.get(toSq) ?? null;
    playMoveSound(chess, move, from, to, preCaptured);
    chess.play(move);

    const newFen = makeFen(chess.toSetup());
    fenRef.current = newFen;
    setFen(newFen);
    setLastMove([from, to]);

    if (checkGameOverReturn(chess)) return;
    askEngine();
  }

  // Returns true if game ended
  function checkGameOverReturn(chess: Chess): boolean {
    if (chess.isCheckmate()) {
      const mated = chess.turn;
      const result = mated === "white" ? "0-1" : "1-0";
      finishGame(result, mated === playerColorRef.current ? "lose" : "win");
      return true;
    }
    if (chess.isStalemate() || chess.isInsufficientMaterial()) {
      finishGame("1/2-1/2", "draw");
      return true;
    }
    return false;
  }

  function promotePawn(role: string) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    executeMove(from, to, role);
  }

  // ---- game lifecycle ----

  function stopWatch() {
    sendToEngine("stop");
    engineThinkingRef.current = false;
    setEngineThinking(false);
    phaseRef.current = "setup";
    setPhase("setup");
    const resetFen = initialFen ?? DEFAULT_START_FEN;
    fenRef.current = resetFen;
    setFen(resetFen);
    setLastMove(null);
    gameMovesRef.current = [];
    try { chessRef.current = Chess.fromSetup(parseFen(resetFen).unwrap()).unwrap(); } catch { chessRef.current = Chess.default(); }
  }

  function startGame() {
    const startFen = initialFen ?? startFenRef.current;

    // Initialize chessops from the (potentially custom) start FEN
    let startChess: Chess;
    try {
      startChess = Chess.fromSetup(parseFen(startFen).unwrap()).unwrap();
    } catch {
      startChess = Chess.default();
    }

    chessRef.current = startChess;
    fenRef.current = startFen;
    playerColorRef.current = playerColor;
    phaseRef.current = "playing";
    engineThinkingRef.current = false;
    gameMovesRef.current = [];
    gameStartFenRef.current = startFen;

    setFen(startFen);
    setLastMove(null);
    setGameResult(null);
    setEngineThinking(false);
    setPhase("playing");

    sendToEngine("ucinewgame");

    if (watchModeRef.current || startChess.turn !== playerColor) {
      engineThinkingRef.current = true;
      setEngineThinking(true);
      sendToEngine(`position fen ${startFen}`);
      sendToEngine(`go movetime ${movetimeRef.current}`);
    }
  }

  function resign() {
    if (phaseRef.current !== "playing") return;
    // Stop engine if thinking
    sendToEngine("stop");
    const result = playerColorRef.current === "white" ? "0-1" : "1-0";
    finishGame(`Resigned — ${result}`, "lose");
  }

  // ---- difficulty label ----
  const movetimeLabel =
    movetime < 1000 ? `${movetime}ms` : `${movetime / 1000}s`;

  // ---- result display ----
  function resultLabel() {
    if (!gameResult) return "";
    if (gameResult.includes("Resigned")) return gameResult;
    if (gameResult === "1/2-1/2") return "Draw";
    const winner = gameResult === "1-0" ? "White wins" : "Black wins";
    return `${winner} (${gameResult})`;
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "flex-start", marginTop: 10, gap: 20 }}>
        {/* Board */}
        <div ref={containerRef} className="cg-wrap" style={{ width: 625, height: 625 }} />

        {/* Side panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minWidth: 200,
            padding: 16,
            backgroundColor: "#1e1e1e",
            borderRadius: 8,
            color: "#fff",
            fontFamily: "monospace",
            boxSizing: "border-box",
            alignSelf: "stretch",
          }}
        >
          {/* Engine status indicator */}
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: engineReady ? "#4caf50" : "#888",
            }}
          >
            {engineReady ? "● Engine ready" : "● Loading engine…"}
          </div>

          {/* ---- SETUP ---- */}
          {phase === "setup" && (
            <>
              <div style={{ fontWeight: 700, textAlign: "center", fontSize: 15 }}>
                {watchMode ? "Engine vs Engine" : "Play vs Computer"}
              </div>

              {initialFen && (
                <div style={{ textAlign: "center", fontSize: 11, color: "#4caf50" }}>
                  Custom position from editor
                </div>
              )}

              {!watchMode && (
                <div>
                  <div style={{ marginBottom: 6, fontSize: 12, color: "#bbb" }}>Play as</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["white", "black"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setPlayerColor(c)}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          background: playerColor === c ? "#2a7" : "#2a2a2a",
                          border: `1px solid ${playerColor === c ? "#2a7" : "#444"}`,
                          color: "#fff",
                          borderRadius: 4,
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ marginBottom: 6, fontSize: 12, color: "#bbb" }}>
                  Think time: {movetimeLabel}
                </div>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={movetime}
                  onChange={(e) => setMovetime(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Draft selectors — hidden in watch mode or when position comes from the board editor */}
              {!watchMode && !initialFen && user ? (
                <>
                  <div>
                    <div style={{ marginBottom: 6, fontSize: 12, color: "#bbb" }}>Your draft</div>
                    <select
                      value={selectedDraftId ?? ""}
                      onChange={(e) => setSelectedDraftId(e.target.value || null)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        background: "#2a2a2a",
                        border: "1px solid #444",
                        color: "#fff",
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <option value="">Standard (no draft)</option>
                      {drafts
                        .filter((d) => d.data?.fen)
                        .map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6, fontSize: 12, color: "#bbb" }}>Engine's draft</div>
                    <select
                      value={selectedEngineDraftId ?? ""}
                      onChange={(e) => setSelectedEngineDraftId(e.target.value || null)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        background: "#2a2a2a",
                        border: "1px solid #444",
                        color: "#fff",
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <option value="">Default (token chess)</option>
                      {drafts
                        .filter((d) => d.data?.fen)
                        .map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                  </div>
                </>
              ) : (!watchMode && !initialFen && (
                <div style={{ fontSize: 11, color: "#888", textAlign: "center" }}>
                  Log in to use your draft
                </div>
              ))}

              <button
                onClick={startGame}
                disabled={!engineReady}
                style={{
                  padding: "9px 0",
                  background: engineReady ? "#1976d2" : "#333",
                  border: "none",
                  color: "#fff",
                  borderRadius: 4,
                  cursor: engineReady ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {engineReady ? "Start Game" : "Loading…"}
              </button>
            </>
          )}

          {/* ---- PLAYING ---- */}
          {phase === "playing" && (
            <>
              {watchMode ? (
                <>
                  {/* Black engine block */}
                  <div
                    style={{
                      textAlign: "center",
                      padding: "10px 0",
                      borderRadius: 6,
                      background: engineThinking && chessRef.current.turn === "black" ? "#2a2a2a" : "#141414",
                      border: engineThinking && chessRef.current.turn === "black" ? "2px solid #4caf50" : "2px solid #333",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Fairy Stockfish (Black)</div>
                    {engineThinking && chessRef.current.turn === "black" && (
                      <div style={{ fontSize: 11, color: "#4caf50", marginTop: 4 }}>thinking…</div>
                    )}
                  </div>

                  <div style={{ flex: 1 }} />

                  {/* White engine block */}
                  <div
                    style={{
                      textAlign: "center",
                      padding: "10px 0",
                      borderRadius: 6,
                      background: engineThinking && chessRef.current.turn === "white" ? "#2a2a2a" : "#141414",
                      border: engineThinking && chessRef.current.turn === "white" ? "2px solid #4caf50" : "2px solid #333",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Fairy Stockfish (White)</div>
                    {engineThinking && chessRef.current.turn === "white" && (
                      <div style={{ fontSize: 11, color: "#4caf50", marginTop: 4 }}>thinking…</div>
                    )}
                  </div>

                  <button
                    onClick={stopWatch}
                    style={{
                      padding: "6px 0",
                      background: "#333",
                      border: "1px solid #555",
                      color: "#ccc",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Stop
                  </button>
                </>
              ) : (
                <>
                  {/* Engine block — highlighted when it's the engine's turn */}
                  <div
                    style={{
                      textAlign: "center",
                      padding: "10px 0",
                      borderRadius: 6,
                      background: engineThinking ? "#2a2a2a" : "#141414",
                      border: engineThinking ? "2px solid #4caf50" : "2px solid #333",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Fairy Stockfish</div>
                    {selectedEngineDraftId && drafts.find((d) => d.id === selectedEngineDraftId) && (
                      <div style={{ fontSize: 11, color: "#888", fontWeight: 400, marginTop: 3 }}>
                        {drafts.find((d) => d.id === selectedEngineDraftId)!.name}
                      </div>
                    )}
                    {engineThinking && (
                      <div style={{ fontSize: 11, color: "#4caf50", marginTop: 4 }}>
                        thinking…
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1 }} />

                  {/* Player block — highlighted when it's the player's turn */}
                  <div
                    style={{
                      textAlign: "center",
                      padding: "10px 0",
                      borderRadius: 6,
                      background: !engineThinking ? "#2a2a2a" : "#141414",
                      border: !engineThinking ? "2px solid #4caf50" : "2px solid #333",
                      fontWeight: 600,
                    }}
                  >
                    <div>You ({playerColor})</div>
                    {selectedDraftId && drafts.find((d) => d.id === selectedDraftId) && (
                      <div style={{ fontSize: 11, color: "#888", fontWeight: 400, marginTop: 3 }}>
                        {drafts.find((d) => d.id === selectedDraftId)!.name}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={resign}
                    style={{
                      padding: "6px 0",
                      background: "#333",
                      border: "1px solid #555",
                      color: "#ccc",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Resign
                  </button>
                </>
              )}
            </>
          )}

          {/* ---- GAME OVER ---- */}
          {phase === "gameover" && (
            <>
              <div
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 16,
                  padding: "12px 0",
                }}
              >
                {resultLabel()}
              </div>

              <button
                onClick={() => setPhase("setup")}
                style={{
                  padding: "9px 0",
                  background: "#1976d2",
                  border: "none",
                  color: "#fff",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                New Game
              </button>

              <button
                onClick={() =>
                  navigate("/analysis", {
                    state: {
                      initialFen: gameStartFenRef.current,
                      initialMoves: gameMovesRef.current,
                      orientation: watchModeRef.current ? "white" : playerColorRef.current,
                    },
                  })
                }
                style={{
                  padding: "9px 0",
                  background: "#2a2a2a",
                  border: "1px solid #555",
                  color: "#ccc",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Review Game
              </button>
            </>
          )}
        </div>
      </div>

      {/* Promotion modal */}
      {pendingPromotion && (
        <div
          onClick={() => {
            // Revert board to pre-move state on dismiss
            if (groundRef.current) {
              const chess = chessRef.current;
              groundRef.current.set({
                fen: fenRef.current,
                turnColor: chess.turn,
                movable: {
                  color: playerColor,
                  dests: calculateDests(chess),
                  showDests: true,
                  free: false,
                  events: { after: handlePlayerMove },
                },
              });
            }
            setPendingPromotion(null);
          }}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
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
            {["queen", "rook", "bishop", "knight", "champion", "princess"].map((role) => (
              <button
                key={role}
                onClick={() => promotePawn(role)}
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
