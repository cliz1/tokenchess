// src/components/BoardEditor.tsx
import React, { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { useNavigate } from "react-router-dom";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";

const FILES = "abcdefgh";
type PalettePiece = { role: string; color: "white" | "black" };

export default function BoardEditor() {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const groundRef = useRef<any>(null);
  const [fen, setFen] = useState<string>("8/8/8/8/8/8/8/8 w - - 0 1");
  const [orientation] = useState<"white" | "black">("white");
  const navigate = useNavigate();

  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";
  const [paletteColor, setPaletteColor] = useState<"white" | "black">("white");

  function squareFromClientPos(x: number, y: number, rect: DOMRect, orientation: "white" | "black") {
    const relX = x - rect.left;
    const relY = y - rect.top;
    if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;
    const fileIndex = Math.floor((relX / rect.width) * 8);
    const rankIndexFromTop = Math.floor((relY / rect.height) * 8);
    let file = Math.max(0, Math.min(7, fileIndex));
    let rankFromBottom = 7 - Math.max(0, Math.min(7, rankIndexFromTop));
    if (orientation === "black") {
      file = 7 - file;
      rankFromBottom = 7 - rankFromBottom;
    }
    return `${FILES[file]}${rankFromBottom + 1}`;
  }

  function roleToFenLetter(role: string) {
    const r = role.toLowerCase();
    if (r.includes("pawn")) return "p";
    if (r.includes("knight") || r === "n") return "n";
    if (r.includes("bishop")) return "b";
    if (r.includes("rook") || r.includes("knook")) return "r";
    if (r.includes("queen")) return "q";
    if (r.includes("king")) return "k";
    return r.charAt(0) || "p";
  }

  function piecesToFen(pieces: Record<string, { role: string; color: string }>) {
    const ranks: string[] = [];
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      let rankStr = "";
      for (let file = 0; file < 8; file++) {
        const sq = `${FILES[file]}${rank + 1}`;
        const p = pieces[sq];
        if (!p) {
          empty++;
        } else {
          if (empty > 0) {
            rankStr += String(empty);
            empty = 0;
          }
          const letter = roleToFenLetter(p.role);
          rankStr += p.color === "white" ? letter.toUpperCase() : letter.toLowerCase();
        }
      }
      if (empty > 0) rankStr += String(empty);
      ranks.push(rankStr);
    }
    return `${ranks.join("/")} w - - 0 1`;
  }

  function statePiecesToObject(statePieces: any) {
    const out: Record<string, { role: string; color: string }> = {};
    if (!statePieces) return out;
    if (statePieces instanceof Map) {
      for (const [sq, p] of statePieces.entries()) out[sq] = p;
      return out;
    }
    if (Array.isArray(statePieces)) {
      for (const [sq, p] of statePieces) out[sq] = p;
      return out;
    }
    Object.assign(out, statePieces);
    return out;
  }

  useEffect(() => {
    if (!boardRef.current) return;
    const cfg: Config = {
      fen,
      orientation,
      draggable: { enabled: true },
      movable: { free: true, color: "both" },
      highlight: { lastMove: false, check: false },
      drawable: { enabled: false },
      animation: { enabled: true, duration: 180 },
      events: {
        // called after any change to the state (baseMove, baseNewPiece, etc.)
        change: () => {
          try {
            const api = groundRef.current;
            if (!api) return;
            const newFen =
              typeof api.getFen === "function"
                ? api.getFen()
                : piecesToFen(statePiecesToObject(api.state.pieces));
            setFen(newFen);
          } catch (err) {
            // ignore
          }
        },
      },
    };

    groundRef.current = Chessground(boardRef.current, cfg);
    const el = boardRef.current;

    const onDragOver = (e: DragEvent) => e.preventDefault();

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (!groundRef.current || !el) return;
      const raw = e.dataTransfer?.getData("application/x-chess-piece");
      if (!raw) return;
      let piece: PalettePiece;
      try {
        piece = JSON.parse(raw) as PalettePiece;
      } catch {
        return;
      }
      const rect = el.getBoundingClientRect();
      const sq = squareFromClientPos(e.clientX, e.clientY, rect, orientation);
      if (!sq) return;
      if (typeof groundRef.current.newPiece === "function") {
        groundRef.current.newPiece({ role: piece.role, color: piece.color }, sq);
        const newFen = typeof groundRef.current.getFen === "function"
          ? groundRef.current.getFen()
          : piecesToFen(statePiecesToObject(groundRef.current.state.pieces));
        setFen(newFen);
        return;
      }
      const curr = groundRef.current.state.pieces;
      const baseMap = curr instanceof Map ? new Map(curr) : new Map(Array.isArray(curr) ? curr : Object.entries(curr ?? {}));
      baseMap.set(sq, { role: piece.role, color: piece.color });
      groundRef.current.set({ pieces: baseMap });
      const newFen = typeof groundRef.current.getFen === "function"
        ? groundRef.current.getFen()
        : piecesToFen(statePiecesToObject(baseMap));
      setFen(newFen);
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);

    // ---------- DELETION (Alt+click or right-click only) ----------
    const onPointerDownCapture = (ev: PointerEvent) => {
      if (!boardRef.current || !groundRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;

      const wantDelete = ev.altKey || ev.button === 2;
      if (!wantDelete) return;

      try { (ev as any).stopImmediatePropagation?.(); } catch {}
      ev.preventDefault();

      const sq = squareFromClientPos(ev.clientX, ev.clientY, rect, orientation);
      if (!sq) return;

      const curr = groundRef.current.state.pieces;
      const baseMap = curr instanceof Map ? new Map(curr) : new Map(Array.isArray(curr) ? curr : Object.entries(curr ?? {}));
      if (!baseMap.has(sq)) return;

      baseMap.delete(sq);
      groundRef.current.set({ pieces: baseMap });

      setTimeout(() => {
        const newFen = typeof groundRef.current.getFen === "function"
          ? groundRef.current.getFen()
          : piecesToFen(statePiecesToObject(groundRef.current.state.pieces));
        setFen(newFen);
      }, 0);
    };

    const onContextMenu = (ev: MouseEvent) => {
      if (!boardRef.current || !groundRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
      ev.preventDefault();
      const sq = squareFromClientPos(ev.clientX, ev.clientY, rect, orientation);
      if (!sq) return;

      const curr = groundRef.current.state.pieces;
      const baseMap = curr instanceof Map ? new Map(curr) : new Map(Array.isArray(curr) ? curr : Object.entries(curr ?? {}));
      if (!baseMap.has(sq)) return;

      baseMap.delete(sq);
      groundRef.current.set({ pieces: baseMap });
      setTimeout(() => {
        const newFen = typeof groundRef.current.getFen === "function"
          ? groundRef.current.getFen()
          : piecesToFen(statePiecesToObject(groundRef.current.state.pieces));
        setFen(newFen);
      }, 0);
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    document.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      document.removeEventListener("contextmenu", onContextMenu);
      groundRef.current?.destroy();
      groundRef.current = null;
    };
  }, [orientation, fen]);

  const pieceRoles = [
    "pawn",
    "knight",
    "bishop",
    "rook",
    "queen",
    "king",
    "knook",
    "knishop",
    "amazon",
    "peasant",
    "painter",
    "snare",
    "wizard",
    "archer",
  ];

  const palette: PalettePiece[] = pieceRoles.map((role) => ({ role, color: paletteColor }));

  function handlePaletteDragStart(e: React.DragEvent, piece: PalettePiece) {
    e.dataTransfer.setData("application/x-chess-piece", JSON.stringify(piece));
    const node = document.createElement("div");
    node.style.width = "64px";
    node.style.height = "64px";
    node.style.position = "fixed";
    node.style.left = "-9999px";
    node.style.top = "-9999px";
    node.style.pointerEvents = "none";

    document.body.appendChild(node);
    e.dataTransfer.setDragImage(node, 32, 32);
    setTimeout(() => {
      try { document.body.removeChild(node); } catch {}
    }, 0);
  }

  // --------- VALIDATION + NAVIGATION ----------
  function countKingsFromState(): { white: number; black: number } {
    try {
      const piecesState = groundRef.current?.state?.pieces;
      if (piecesState) {
        const obj = statePiecesToObject(piecesState);
        let white = 0;
        let black = 0;
        for (const sq in obj) {
          const p = obj[sq];
          if (!p) continue;
          if (p.role && p.role.toLowerCase().includes("king")) {
            if (p.color === "white") white++;
            else if (p.color === "black") black++;
          }
        }
        return { white, black };
      }
    } catch (e) {
      // ignore, fallback to fen parsing below
    }

    // fallback: parse FEN first field and count K/k
    const placement = fen.split(" ")[0] ?? fen;
    let white = 0;
    let black = 0;
    for (const ch of placement) {
      if (ch === "K") white++;
      if (ch === "k") black++;
    }
    return { white, black };
  }

  function validateFenForAnalysis(): { ok: boolean; reason?: string } {
    const { white, black } = countKingsFromState();
    if (white !== 1 || black !== 1) {
      return { ok: false, reason: `Need exactly one king of each color — currently white=${white}, black=${black}` };
    }
    return { ok: true };
  }

  function handleOpenInAnalysis() {
    const res = validateFenForAnalysis();
    if (!res.ok) {
      alert(res.reason ?? "FEN is not valid for analysis");
      return;
    }
    // pass fen via react-router state
    navigate("/analysis", { state: { initialFen: fen } });
  }

    function handleSetStartPosition() {
    setFen(START_FEN);
    try { groundRef.current?.set?.({ fen: START_FEN }); } catch {}
    }

    function handleSetEmptyPosition() {
    setFen(EMPTY_FEN);
    try { groundRef.current?.set?.({ fen: EMPTY_FEN }); } catch {}
  }



  return (
    <div style={{ minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 24 }}>
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            ref={boardRef}
            className="cg-wrap"
            style={{
              width: 560,
              height: 560,
              boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          />
          <div style={{ marginTop: 10, marginBottom: 10, fontFamily: "monospace", color: "#ddd" }}>FEN: {fen} </div>
          <div>
                  <button
              onClick={handleSetStartPosition}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#ddd",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Start Position
            </button>
              <button
              onClick={handleOpenInAnalysis}
              aria-label="Open in analysis"
              style={{
                background: "#3d3b3bff",
                border: "none",
                padding: "6px 10px",
                borderRadius: 6,
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
                minWidth: 80,
              }}
            >
              Analyze
            </button>
             <button
              onClick={handleSetEmptyPosition}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 6,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#ddd",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Empty Board
            </button>
            </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#aaa" }}>
            Tip: Alt+click or right-click a square to remove a piece.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            className="palette"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,1fr)",
              gap: 12,
              alignContent: "start",
              padding: 8,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
            }}
          >
            {palette.map((p, i) => (
              <div
                key={`${p.role}-${p.color}-${i}`}
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, p)}
                style={{
                  width: 72,
                  height: 72,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "grab",
                  borderRadius: 6,
                }}
              >
                <div className={`cg-piece ${p.role} ${p.color}`} style={{ width: 64, height: 64 }} />
              </div>
            ))}
          </div>

          {/* SMALL BUTTON: swap palette color */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPaletteColor((c) => (c === "white" ? "black" : "white"))}
              aria-label="Toggle palette color"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "6px 10px",
                borderRadius: 6,
                color: "#ddd",
                fontSize: 13,
                cursor: "pointer",
                minWidth: 120,
              }}
            >
              Show {paletteColor === "white" ? "Black" : "White"} Pieces
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
