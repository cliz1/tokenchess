// src/components/ArmyBuilder.tsx
import React, { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";

const FILES = "abcdefgh";
type PalettePiece = { role: string; color: "white" | "black" };

export default function ArmyBuilder() {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const groundRef = useRef<any>(null);

  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";
  const INITIAL_TOKENS = 39;

  const [fen, setFen] = useState<string>(EMPTY_FEN);
  const [orientation] = useState<"white" | "black">("white");

  // Tokens state + ref (ref used by handlers so we don't need to re-create handlers on every token change)
  const [tokens, setTokens] = useState<number>(INITIAL_TOKENS);
  const tokensRef = useRef<number>(tokens);
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  // Temporary warning message when placement blocked
  const [warning, setWarning] = useState<string | null>(null);
  function flashWarning(msg: string, ms = 2000) {
    setWarning(msg);
    setTimeout(() => setWarning(null), ms);
  }

  // ---- token cost table (tweak values as you like) ----
  function getCost(role: string) {
    const r = role.toLowerCase();
    // standard pieces
    if (r.includes("pawn")) return 1;
    if (r.includes("knight") || r === "n") return 3;
    if (r.includes("bishop")) return 3;
    if (r.includes("rook")) return 5;
    if (r.includes("queen")) return 9;
    if (r.includes("king")) return 0; 
    if (r.includes("knook")) return 9;
    if (r.includes("knishop")) return 8;
    if (r.includes("amazon")) return 12;
    if (r.includes("peasant")) return 3;
    if (r.includes("painter")) return 2;
    if (r.includes("snare")) return 2;
    if (r.includes("wizard")) return 5;
    if (r.includes("archer")) return 3;
    // fallback
    return 2;
  }
  // ----------------------------------------------------

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

  // compute total cost of white pieces from a FEN piece placement string
  function costOfWhitePiecesFromFen(fenStr: string) {
    // fenStr may be full FEN; take piece placement (first field)
    const parts = fenStr.split(" ");
    const placement = parts[0] ?? fenStr;
    let total = 0;
    for (const ch of placement) {
      if (ch === "/" || (ch >= "1" && ch <= "8")) continue;
      // uppercase letters are white pieces
      if (ch >= "A" && ch <= "Z") {
        // map letter to role name
        let role = "pawn";
        switch (ch) {
          case "P": role = "pawn"; break;
          case "N": role = "knight"; break;
          case "B": role = "bishop"; break;
          case "R": role = "rook"; break;
          case "Q": role = "queen"; break;
          case "K": role = "king"; break;
          default:
            // custom char: fallback map (if you used different letters for custom pieces)
            role = "pawn";
        }
        total += getCost(role);
      }
    }
    return total;
  }

  useEffect(() => {
    if (!boardRef.current) return;

    const cfg: Config = {
      fen,
      orientation,
      draggable: { enabled: true },
      // allow moving pieces of either color on the board
      movable: { free: true, color: "both" },
      highlight: { lastMove: false, check: false },
      drawable: { enabled: false },
      animation: { enabled: true, duration: 180 },

      // keep fen in sync when internal state changes
      events: {
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

    // onDrop handles placing a palette piece onto the board, with token checks & refunds (if replacing)
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

      // current pieces (normalize into Map)
      const curr = groundRef.current.state.pieces;
      const baseMap = curr instanceof Map ? new Map(curr) : new Map(Array.isArray(curr) ? curr : Object.entries(curr ?? {}));

      // existing piece at target square (if any)
      const existing = baseMap.get(sq) as { role: string; color: string } | undefined;

      // compute token effect:
      // - refund existing white piece (if present)
      // - subtract cost of new piece if it's white
      const refund = existing && existing.color === "white" ? getCost(existing.role) : 0;
      const costNew = piece.color === "white" ? getCost(piece.role) : 0;

      const currentTokens = tokensRef.current;
      const effective = currentTokens + refund - costNew;

      if (effective < 0) {
        // blocked
        flashWarning(`Not enough tokens to place ${piece.color} ${piece.role}. Need ${costNew}, have ${currentTokens}${refund ? ` (replace refunds ${refund})` : ""}.`);
        return;
      }

      // OK to place:
      if (typeof groundRef.current.newPiece === "function") {
        try {
          groundRef.current.newPiece({ role: piece.role, color: piece.color }, sq);
        } catch {
          const copy = new Map(baseMap);
          copy.set(sq, { role: piece.role, color: piece.color });
          groundRef.current.set({ pieces: copy });
        }
        setTokens(effective);
        const newFen = typeof groundRef.current.getFen === "function"
          ? groundRef.current.getFen()
          : piecesToFen(statePiecesToObject(groundRef.current.state.pieces));
        setFen(newFen);
        return;
      }

      baseMap.set(sq, { role: piece.role, color: piece.color });
      groundRef.current.set({ pieces: baseMap });

      setTokens(effective);
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
      const existing = baseMap.get(sq);
      if (!existing) return;

      // refund tokens if white
      if (existing.color === "white") {
        const refundAmt = getCost(existing.role);
        setTokens((t) => t + refundAmt);
      }

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
      const existing = baseMap.get(sq);
      if (!existing) return;

      if (existing.color === "white") {
        const refundAmt = getCost(existing.role);
        setTokens((t) => t + refundAmt);
      }

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
    // note: we intentionally do NOT depend on `tokens` here because we use tokensRef to read current value inside handlers
  }, [orientation, fen]);

  // list of custom piece roles (no color here)
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

  // NEW: palette color state (white or black)
  const [paletteColor, setPaletteColor] = useState<"white" | "black">("white");
  // build current palette using the selected paletteColor
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

    // inline styles: ensure drag preview shows a single piece (not tiled sprite)
    node.innerHTML = `
      <div class="cg-piece ${piece.role} ${piece.color}"
           style="
             width:64px;
             height:64px;
             background-repeat:no-repeat;
             background-position:center center;
             background-size:64px 64px;
             image-rendering: auto;
           ">
      </div>
    `;

    document.body.appendChild(node);
    e.dataTransfer.setDragImage(node, 32, 32);
    setTimeout(() => {
      try { document.body.removeChild(node); } catch {}
    }, 0);
  }

  // ---------- NEW: handlers to set start / empty fen and adjust tokens ----------
  function handleSetStartPosition() {
    // compute cost of white pieces in start fen and deduct from initial allotment
    const cost = costOfWhitePiecesFromFen(START_FEN);
    const newTokens = Math.max(0, INITIAL_TOKENS - cost);
    setTokens(newTokens);
    tokensRef.current = newTokens;

    setFen(START_FEN);
    try { groundRef.current?.set?.({ fen: START_FEN }); } catch {}
  }
  function handleSetEmptyPosition() {
    // empty board => no white pieces => full allotment
    const newTokens = INITIAL_TOKENS;
    setTokens(newTokens);
    tokensRef.current = newTokens;

    setFen(EMPTY_FEN);
    try { groundRef.current?.set?.({ fen: EMPTY_FEN }); } catch {}
  }
  // ----------------------------------------------------------

  return (
    <div style={{ minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 24 }}>
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        {/* LEFT: RIGHT PANEL moved to the LEFT */}
        <div
          style={{
            width: 220,
            padding: 12,
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "stretch",
          }}
        >
          {/* START / EMPTY buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSetStartPosition}
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
              Start Position
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

          <div style={{ fontSize: 13, color: "#bbb" }}>Tokens</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{tokens}</div>

          <div style={{ fontSize: 12, color: "#aaa" }}>
            Placing <strong style={{ color: "#fff" }}>white</strong> pieces consumes tokens. If a placement would make tokens go below 0 it will be blocked.
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: 8 }}>
            <div style={{ fontSize: 13, color: "#bbb", marginBottom: 6 }}>Piece costs</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 48px", gap: 6, fontSize: 13 }}>
              {pieceRoles.map((r) => (
                <React.Fragment key={r}>
                  <div style={{ color: "#ddd", textTransform: "capitalize" }}>{r}</div>
                  <div style={{ color: "#fff", textAlign: "right" }}>{getCost(r)}</div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {warning && (
            <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: "rgba(255,80,80,0.08)", color: "#ffb3b3", fontSize: 13 }}>
              {warning}
            </div>
          )}
        </div>

        {/* CENTER: board + info column */}
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
          <div style={{ marginTop: 10, fontFamily: "monospace", color: "#ddd" }}>FEN: {fen}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#aaa" }}>
            Tip: Alt+click or right-click a square to remove a piece.
          </div>
        </div>

        {/* RIGHT: palette + toggle */}
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

          <div style={{ display: "flex", justifyContent: "center" }}>
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
