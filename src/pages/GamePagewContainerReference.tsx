// src/pages/GamePage.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { calculateDests, playResultSound } from "../utils/chessHelpers";
import { useGameSocket } from "../hooks/useGameSocket";
import type { GameUpdate } from "../hooks/useGameSocket";
import { parseSquare } from "chessops/util";
import { getCheckHighlights, playMoveSound } from "../utils/chessHelpers";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";

export default function GamePage2() {
  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<any>(null);
  const chessRef = useRef<Chess>(Chess.default());
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room") ?? "test-room";
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const [fen, setFen] = useState<string>(startFen);
  const fenRef = useRef<string>(startFen);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const lastMoveRef = useRef<[string, string] | null>(null);

  const [gameResult, setGameResult] = useState<null | "1-0" | "0-1" | "1/2-1/2" | "ongoing">(null);
  const [role, setRole] = useState<"player" | "spectator">("spectator");
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null);
  const [players, setPlayers] = useState<{ id: string; username: string }[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});

  type ClockState = {
    whiteMs: number;
    blackMs: number;
    running: "white" | "black" | null;
  };

  // displayed clock (what UI renders)
  const [clock, setClock] = useState<ClockState | null>(null);

  // authoritative server snapshot + local receive time
  const serverClockRef = useRef<ClockState | null>(null);
  const [serverClockReceivedAt, setServerClockReceivedAt] = useState<number | null>(null);

  const clockRef = useRef<ClockState | null>(null);
  const tickRef = useRef<number | null>(null);

  type Draft = {
    id: string;
    name: string;
    isActive: boolean;
    slot: number;
  };

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);

  // keep color ref for game termination update
  const playerColorRef = useRef<"white" | "black" | null>(playerColor);
  useEffect(() => { playerColorRef.current = playerColor; }, [playerColor]);

  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    color: "white" | "black";
  } | null>(null);

  // ensure no draft fetching during active play
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !gameResult) return;
    loadDrafts();
  }, [user, gameResult]);

  async function loadDrafts() {
    const res: Draft[] = await apiFetch("/drafts");
    res.sort((a, b) => a.slot - b.slot);
    setDrafts(res);
  }

  // --- stable WS callback ---
  const onGameUpdate = useCallback((update: GameUpdate) => {
    if (update.players) setPlayers(update.players);
    if (update.role) setRole(update.role);
    if (update.color) setPlayerColor(update.color);
    if (update.scores) setScores(update.scores);

    const prevFen = fenRef.current;
    const prevLast = lastMoveRef.current;
    const sameFen = update.fen === prevFen;
    const sameLastMove =
      update.lastMove &&
      prevLast &&
      update.lastMove[0] === prevLast[0] &&
      update.lastMove[1] === prevLast[1];

    if (sameFen && sameLastMove && update.result === undefined) return;

    if (update.result !== undefined) {
      let outcome: "win" | "lose" | "draw" | null = null;
      const effectiveColor = update.color ?? playerColorRef.current;
      const match = update.result.match(/(1-0|0-1|1\/2-1\/2)$/);
      const score = match ? (match[1] as any) : null;

      if (effectiveColor && score) {
        if (score === "1-0") outcome = effectiveColor === "white" ? "win" : "lose";
        else if (score === "0-1") outcome = effectiveColor === "black" ? "win" : "lose";
        else if (score === "1/2-1/2") outcome = "draw";
      }
      if (outcome) playResultSound(outcome);
      setGameResult(update.result as any);
    } else if (update.type === "newGame") {
      setGameResult(null);
      setLastMove(null);
      lastMoveRef.current = null;
    }

    let newChess = chessRef.current;
    let preCaptured: any | null = null;

    if (update.lastMove && prevFen) {
      try {
        const prevSetup = parseFen(prevFen).unwrap();
        const preChess = Chess.fromSetup(prevSetup).unwrap();
        const toSq = parseSquare(update.lastMove[1]);
        if (toSq !== undefined) preCaptured = preChess.board.get(toSq) ?? null;
      } catch {}
    }

    if (update.fen !== prevFen) {
      try {
        const setup = parseFen(update.fen).unwrap();
        newChess = Chess.fromSetup(setup).unwrap();
      } catch {
        newChess = chessRef.current;
      }
    }

    if (update.fen !== prevFen) {
      chessRef.current = newChess;
      setFen(update.fen);
      fenRef.current = update.fen;
    }

    if (update.lastMove) {
      const [from, to] = update.lastMove;
      const fromSq = parseSquare(from);
      const toSq = parseSquare(to);
      if (fromSq !== undefined && toSq !== undefined) {
        const move = { from: fromSq, to: toSq };
        if (!sameLastMove) playMoveSound(newChess, move, from, to, preCaptured);
        setLastMove(update.lastMove);
        lastMoveRef.current = update.lastMove;
      }
    }

    // --- clock handling: record authoritative server snapshot + receive time
    if (update.clock) {
      serverClockRef.current = update.clock;
      setServerClockReceivedAt(performance.now());
      // also update displayed clock immediately to server snapshot (will be animated by tick loop)
      setClock(update.clock);
    }
    if (update.type === "gameOver") {
      // if server sends gameOver with a clock, we already set it above; otherwise just clear running
      if (update.clock) {
        serverClockRef.current = update.clock;
        setServerClockReceivedAt(performance.now());
        setClock(update.clock);
      } else {
        setClock((prev) => prev ? { ...prev, running: null } : prev);
      }
    }
  }, []);

  const { sendMove, sendLeave, sendRematch, sendResign, sendDraw } = useGameSocket(roomId, onGameUpdate);

  useEffect(() => {
    if (!containerRef.current) return;
    groundRef.current = Chessground(containerRef.current, {
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true },
    } as Config);
    return () => groundRef.current?.destroy();
  }, []);

  // ---- Tick loop derived from authoritative server snapshot ----
  useEffect(() => {
    // if no server snapshot, nothing to animate
    const base = serverClockRef.current;
    if (!base || serverClockReceivedAt == null) {
      // ensure UI shows whatever clock state we have (or null)
      clockRef.current = clock;
      return;
    }

    // if no running side, just display server snapshot (no animation)
    if (!base.running) {
      setClock(base);
      clockRef.current = base;
      return;
    }

    let raf = 0;
    function frame() {
      const now = performance.now();
      const elapsed = Math.max(0, now - (serverClockReceivedAt ?? now));
      const b = serverClockRef.current!;
      const running = b.running;
      const display: ClockState = { ...b };

      if (running === "white") {
        display.whiteMs = Math.max(0, Math.floor(b.whiteMs - elapsed));
      } else if (running === "black") {
        display.blackMs = Math.max(0, Math.floor(b.blackMs - elapsed));
      }

      // update displayed clock
      setClock(display);
      clockRef.current = display;

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    tickRef.current = raf;

    return () => {
      if (raf) cancelAnimationFrame(raf);
      tickRef.current = null;
    };
  }, [serverClockReceivedAt]); // restarts whenever we receive a new server snapshot

  useEffect(() => {
    if (!groundRef.current) return;

    const setup = parseFen(fen).unwrap();
    const newChess = Chess.fromSetup(setup).unwrap();
    chessRef.current = newChess;

    groundRef.current.set({
      fen,
      turnColor: newChess.turn,
      animation: { enabled: true, duration: 300 },
      orientation: playerColor ?? "white",
      highlight: { check: true, custom: getCheckHighlights(newChess) },
      movable: {
        color: playerColor ?? newChess.turn,
        dests: calculateDests(newChess),
        showDests: true,
        events: {
          after: (from: string, to: string) => {
            if (role !== "player") return;
            const chess = chessRef.current;
            const fromSq = parseSquare(from);
            const toSq = parseSquare(to);
            if (fromSq == null || toSq == null) return;

            const fromPiece = chess.board.get(fromSq);
            const toPiece = chess.board.get(toSq);
            const toRank = Math.floor(toSq / 8);
            const fromRank = Math.floor(fromSq / 8);

            // intercept pawn promotion
            if ((fromPiece?.role === "pawn") && (toRank === 0 || toRank === 7)) {
              setPendingPromotion({ from, to, color: chess.turn });
              return;
            }

            if (
              fromPiece?.role === "wizard" &&
              toPiece?.role === "pawn" &&
              ((fromPiece?.color === "white" && fromRank === 0) || (fromPiece?.color === "black" && fromRank === 7))
            ) {
              setPendingPromotion({ from, to, color: chess.turn });
              return;
            }

            // determine move and optional promotion role
            let promotionRole: string | null = null;
            if (
              (fromPiece?.role === "painter" && (toRank === 0 || toRank === 7)) ||
              (fromPiece?.role === "wizard" && fromPiece?.color === "white" && toPiece?.role === "painter" && fromRank === 7) ||
              (fromPiece?.role === "wizard" && fromPiece?.color === "black" && toPiece?.role === "painter" && fromRank === 0)
            ) {
              promotionRole = "royalpainter";
            } else if (
              (fromPiece?.role === "snare" && (toRank === 0 || toRank === 7)) ||
              (fromPiece?.role === "wizard" && fromPiece?.color === "white" && toPiece?.role === "snare" && fromRank === 7) ||
              (fromPiece?.role === "wizard" && fromPiece?.color === "black" && toPiece?.role === "snare" && fromRank === 0)
            ) {
              promotionRole = "rollingsnare";
            }

            const move: any = promotionRole
              ? { from: fromSq, to: toSq, promotion: promotionRole }
              : { from: fromSq, to: toSq };

            if (!chess.isLegal(move)) return;
            const preCaptured = chess.board.get(toSq) ?? null;
            playMoveSound(chess, move, from, to, preCaptured);
            chess.play(move);
            const newFen = makeFen(chess.toSetup());
            setFen(newFen);
            fenRef.current = newFen;
            setLastMove([from, to]);
            lastMoveRef.current = [from, to];

            // *** DO NOT optimistically flip the clock locally here. ***
            // Wait for server to send authoritative clock snapshot.
            sendMove(promotionRole ? [from, to, promotionRole] : [from, to]);
          },
        },
      },
      lastMove: lastMove ?? undefined,
    });
  }, [fen, lastMove, role, playerColor, sendMove]);

  const handleLeave = () => {
    sendLeave();
    navigate("/");
  };

  const promotePawn = (role: string) => {
    if (!pendingPromotion || !chessRef.current) return;
    const { from, to } = pendingPromotion;

    const move: any = { from: parseSquare(from), to: parseSquare(to), promotion: role };
    const preCaptured = chessRef.current.board.get(parseSquare(to)!) ?? null;
    playMoveSound(chessRef.current, move, from, to, preCaptured);
    chessRef.current.play(move);
    const newFen = makeFen(chessRef.current.toSetup());
    setFen(newFen);
    fenRef.current = newFen;
    setLastMove([from, to]);
    lastMoveRef.current = [from, to];

    // again: don't flip the clock locally; wait for server snapshot
    sendMove([from, to, role]);
    setPendingPromotion(null);
  };

  // --- Helper: format score display ---
  const formatPlayerLine = (p: { id: string; username: string }) => {
    const score = scores[p.id] ?? 0;
    return `${p.username} (${score})`;
  };

  // helper: draft change menu
  function ChangeDraftDropdown() {
    return (
      <div style={{ position: "relative" }}>
        <button onClick={() => setDraftOpen(o => !o)}>
          Switch Draft
        </button>

        {draftOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              background: "#111",
              border: "1px solid #444",
              borderRadius: 6,
              padding: 6,
              zIndex: 20,
              minWidth: 160,
            }}
          >
            {drafts.map(d => (
              <div
                key={d.id}
                onClick={() => activateDraft(d)}
                style={{
                  padding: "6px 10px",
                  cursor: "pointer",
                  borderRadius: 4,
                  marginBottom: 4,
                  background: d.isActive ? "#2a7" : "#222",
                  color: "#fff",
                }}
              >
                {d.name}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // helper: set draft
  async function activateDraft(draft: Draft) {
    try {
      await apiFetch(`/drafts/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      });

      // Optimistic UI update
      setDrafts(ds =>
        ds.map(d => ({
          ...d,
          isActive: d.id === draft.id,
        }))
      );

      setDraftOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  function formatMs(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function switchClockAfterLocalMove() {
    // kept for compatibility but NOT used by move handlers in this version.
    setClock(prev => {
      if (!prev || !prev.running) return prev;

      const next =
        prev.running === "white" ? "black" : "white";

      return {
        ...prev,
        running: next,
      };
    });
  }

  // Sidebar UI (clock, players, actions) — keeps original behavior for handlers
  function GameSidebar() {
    return (
      <div
        style={{
          width: 260,
          padding: 14,
          borderRadius: 10,
          background: "#1b1b1b",
          color: "#eee",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* CLOCK */}
        {clock && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ClockRow
              label="White"
              ms={clock.whiteMs}
              active={clock.running === "white"}
            />
            <ClockRow
              label="Black"
              ms={clock.blackMs}
              active={clock.running === "black"}
            />
          </div>
        )}

        <Divider />

        {/* PLAYERS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {players.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                opacity: 0.9,
              }}
            >
              <span>{p.username}</span>
              <span>{scores[p.id] ?? 0}</span>
            </div>
          ))}
        </div>

        {/* IN-GAME ACTIONS: exact same handlers as original */}
        {role === "player" && !gameResult && (
          <>
            <Divider />
            <div style={{ display: "flex", gap: 8 }}>
              <SidebarButton onClick={sendResign} danger>
                Resign
              </SidebarButton>
              <SidebarButton onClick={sendDraw}>
                Draw
              </SidebarButton>
            </div>
          </>
        )}

        {/* POST-GAME ACTIONS */}
        {role === "player" && gameResult && (
          <>
            <Divider />
            <div style={{ fontSize: 14, opacity: 0.85 }}>
              Result: <strong>{gameResult}</strong>
            </div>

            <SidebarButton onClick={sendRematch}>
              Rematch
            </SidebarButton>
            <SidebarButton onClick={handleLeave}>
              Leave
            </SidebarButton>

            <ChangeDraftDropdown />
          </>
        )}
      </div>
    );
  }

  function Divider() {
    return (
      <div
        style={{
          height: 1,
          background: "#333",
          margin: "6px 0",
        }}
      />
    );
  }

  function ClockRow({
    label,
    ms,
    active,
  }: {
    label: string;
    ms: number;
    active: boolean;
  }) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "6px 8px",
          borderRadius: 6,
          background: active ? "#2a7" : "#222",
          fontWeight: active ? 600 : 400,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{label}</span>
        <span>{formatMs(ms)}</span>
      </div>
    );
  }

  function SidebarButton({
    children,
    onClick,
    danger,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
  }) {
    return (
      <button
        onClick={onClick}
        style={{
          flex: 1,
          padding: "8px 10px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          background: danger ? "#a33" : "#333",
          color: "#fff",
          fontSize: 13,
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ marginTop: 5, fontFamily: "monospace" }}>
        {players.map(formatPlayerLine).join(" vs ")} &nbsp; Room: {roomId}
      </div>

      {clock && (
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <div style={{ fontWeight: clock.running === "white" ? "bold" : "normal" }}>
            White: {formatMs(clock.whiteMs)}
          </div>
          <div style={{ fontWeight: clock.running === "black" ? "bold" : "normal" }}>
            Black: {formatMs(clock.blackMs)}
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 20,
          marginTop: 10,
        }}
      >
        <div
          ref={containerRef}
          className="cg-wrap"
          style={{ width: 625, height: 625 }}
        />
        <GameSidebar />
      </div>

      {/* Promotion Modal */}
      {pendingPromotion && (
        <div
          onClick={() => {
            // === CANCEL PROMOTION ===
            if (chessRef.current && groundRef.current) {
              // Stop any animations
              groundRef.current.stop?.();

              const chess = chessRef.current;
              const newFen = makeFen(chess.toSetup());
              const dests = calculateDests(chess);

              groundRef.current.set({
                fen: newFen,
                turnColor: chess.turn,
                lastMove: undefined,
                movable: {
                  color: playerColor ?? chess.turn,
                  free: false,
                  showDests: true,
                  dests,
                  events: {
                    after: (from: string, to: string) => {
                      if (role !== "player") return;
                      const chess = chessRef.current;
                      const fromSq = parseSquare(from);
                      const toSq = parseSquare(to);
                      if (fromSq == null || toSq == null) return;

                      const fromPiece = chess.board.get(fromSq);
                      const toPiece = chess.board.get(toSq);
                      const toRank = Math.floor(toSq / 8);
                      const fromRank = Math.floor(fromSq / 8);

                      // Detect promotion again
                      if (
                        (fromPiece?.role === "pawn" || fromPiece?.role === "painter") &&
                        (toRank === 0 || toRank === 7)
                      ) {
                        setPendingPromotion({ from, to, color: chess.turn });
                        return;
                      }

                      if (
                        fromPiece?.role === "wizard" &&
                        toPiece?.role === "pawn" &&
                        (fromRank === 0 || fromRank === 7)
                      ) {
                        setPendingPromotion({ from, to, color: chess.turn });
                        return;
                      }

                      // Normal move logic
                      const move = { from: fromSq, to: toSq };
                      if (!chess.isLegal(move)) return;
                      const preCaptured = chess.board.get(toSq) ?? null;
                      playMoveSound(chess, move, from, to, preCaptured);
                      chess.play(move);
                      const newFen = makeFen(chess.toSetup());
                      setFen(newFen);
                      fenRef.current = newFen;
                      setLastMove([from, to]);
                      lastMoveRef.current = [from, to];

                      // do not flip clock locally; wait for server snapshot
                      sendMove([from, to]);
                    },
                  },
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
            {["queen", "rook", "bishop", "knight", "champion", "princess"].map((role) => (
              <button
                key={role}
                onClick={() => promotePawn(role)}
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
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
