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

export default function GamePage() {
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
    //console.log("[onGameUpdate]", update);
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
      //console.log("[onGameUpdate] Setting gameResult =", update.result);
            // --- Determine win/lose/draw from the perspective of the client ---
        let outcome: "win" | "lose" | "draw" | null = null;

        const effectiveColor = update.color ?? playerColorRef.current;

        // Match a score that appears at the *end* of the string
        const match = update.result.match(/(1-0|0-1|1\/2-1\/2)$/);
        const score = match ? (match[1] as any) : null;

        if (effectiveColor && score) {
          if (score === "1-0") {
            outcome = effectiveColor === "white" ? "win" : "lose";
          } else if (score === "0-1") {
            outcome = effectiveColor === "black" ? "win" : "lose";
          } else if (score === "1/2-1/2") {
            outcome = "draw";
          }
        }
        if (outcome) {
          playResultSound(outcome);
        }
      setGameResult(update.result as "1-0" | "0-1" | "1/2-1/2" | "ongoing");
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
            if (
              (fromPiece?.role === "pawn") &&
              (toRank === 0 || toRank === 7)
            ) {
              setPendingPromotion({ from, to, color: chess.turn });
              return;
            }

            if (
              fromPiece?.role === "wizard" &&
              toPiece?.role === "pawn" &&
              ((fromPiece?.color === 'white' && fromRank === 0) || ( fromPiece?.color === 'black' && fromRank === 7))
            ) {
              setPendingPromotion({ from, to, color: chess.turn });
              return;
            }

            // determine move and optional promotion role
            let promotionRole: string | null = null;
            // Painter auto-promotes to RoyalPainter
            if (fromPiece?.role === "painter" && (toRank === 0 || toRank === 7) || (fromPiece?.role === "wizard" && fromPiece?.color === 'white' && toPiece?.role === 'painter' && fromRank === 7) || ((fromPiece?.role === "wizard" && fromPiece?.color === 'black' && toPiece?.role === 'painter' && fromRank === 0))) {
              promotionRole = "royalpainter";
            }
            // Snare auto-promotes to RollingSnare
            else if (fromPiece?.role === "snare" && (toRank === 0 || toRank === 7) || (fromPiece?.role === "wizard" && fromPiece?.color === 'white' && toPiece?.role === 'snare' && fromRank === 7) || ((fromPiece?.role === "wizard" && fromPiece?.color === 'black' && toPiece?.role === 'snare' && fromRank === 0))) {
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
            if (promotionRole) {
              sendMove([from, to, promotionRole]);
            } else {
              sendMove([from, to]);
            }
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

      {/* Horizontal container */}
      <div style={{ display: "flex", alignItems: "flex-start", marginTop: 10 }}>
        <div ref={containerRef} className="cg-wrap" style={{ width: 625, height: 625 }} />

        {/* Game result + buttons (right) */}
        {gameResult && role === "player" && (
          <div style={{ marginLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>{gameResult}</div>
            <button onClick={() => sendRematch()}>Rematch</button>
            <button onClick={handleLeave}>Leave</button>
            <ChangeDraftDropdown />
          </div>
        )}
      </div>

      {/* Controls below board */}
      {role === "player" && !gameResult && (
        <div style={{ marginTop: 20 }}>
          <button onClick={sendResign}>Resign</button>
          <button onClick={sendDraw} style={{ marginLeft: 8 }}>
            Draw
          </button>
        </div>
      )}
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