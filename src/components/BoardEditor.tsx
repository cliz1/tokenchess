// src/components/BoardEditor.tsx
import React, { useEffect, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Config } from "chessground/config";
import { useNavigate } from "react-router-dom";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../assets/custom-pieces.css";
import { parseFen } from "chessops/fen";
import { Chess } from "chessops/chess";
import { attacks } from "chessops/attacks";
import { SquareSet } from "chessops";


const FILES = "abcdefgh";
type PalettePiece = { role: string; color: "white" | "black" };

type BoardEditorProps = {
  initialFen: string;
};


export default function BoardEditor({ initialFen }: BoardEditorProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const groundRef = useRef<any>(null);
  const [fen, setFen] = useState<string>(initialFen);
  const [orientation] = useState<"white" | "black">("white");
  const [sideToMove, setSideToMove] = useState<"white" | "black">("white");
  const navigate = useNavigate();
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const EMPTY_FEN = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
  const [paletteColor, setPaletteColor] = useState<"white" | "black">("white");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Counts FEN applications made programmatically (via tryApplyFen) whose resulting
  // chessground "change" event should be ignored. A plain boolean isn't enough here: chessground
  // defers its "change" callback via setTimeout(…, 1), so fast typing can queue several
  // applications before any of their callbacks fire — a boolean flag can only suppress one of
  // them, letting the rest slip through and stomp the FEN input mid-keystroke.
  const applyingFenCountRef = useRef(0);
  const pendingApplyTimeoutRef = useRef<number | null>(null);
  const selectedRoleRef = useRef<string | null>(null);
  const paletteColorRef = useRef<"white" | "black">("white");
  const isPaintingRef = useRef(false);
  const paintedSquareRef = useRef<string | null>(null);
  const sideToMoveRef = useRef<"white" | "black">("white");

  function applySideToFen(fenStr: string, side: "white" | "black") {
    const parts = fenStr.split(/\s+/);
    parts[1] = side === "white" ? "w" : "b";
    return parts.join(" ");
  }


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
    if (r.includes("rook")) return "r";
    if (r.includes("champion")) return "c";
    if (r.includes("princess")) return "i";
    if (r.includes("mann")) return "m";
    if (r.includes("rollingsnare")) return "l";
    if (r.includes("royalpainter")) return "o";
    else if (r.includes("painter")) return "y";
    else if (r.includes("snare")) return "s";
    if (r.includes("wizard")) return "w";
    if (r.includes("archer")) return "x";
    if (r.includes("centaur")) return "u";
    if (r.includes("general")) return "g";
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

  // use the editor state for who is to move
  const turnShort = sideToMove === "white" ? "w" : "b";
  return `${ranks.join("/")} ${turnShort} - - 0 1`;
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
    setAnalysisError(null);
  }, [fen]);

  useEffect(() => { selectedRoleRef.current = selectedRole; }, [selectedRole]);
  useEffect(() => { paletteColorRef.current = paletteColor; }, [paletteColor]);
  useEffect(() => { sideToMoveRef.current = sideToMove; }, [sideToMove]);

  // Escape clears the armed brush
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setSelectedRole(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);


  function placePieceAt(sq: string, piece: { role: string; color: string }) {
    if (!groundRef.current) return;
    if (typeof groundRef.current.newPiece === "function") {
      groundRef.current.newPiece({ role: piece.role, color: piece.color }, sq);
    } else {
      const curr = groundRef.current.state.pieces;
      const baseMap = curr instanceof Map ? new Map(curr) : new Map(Array.isArray(curr) ? curr : Object.entries(curr ?? {}));
      baseMap.set(sq, { role: piece.role, color: piece.color });
      groundRef.current.set({ pieces: baseMap });
    }
    const newFen = typeof groundRef.current.getFen === "function"
      ? groundRef.current.getFen()
      : piecesToFen(statePiecesToObject(groundRef.current.state.pieces));
    setFen(applySideToFen(newFen, sideToMoveRef.current));
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
          // Defer to the next animation frame so the chessground internal state is stable
          requestAnimationFrame(() => {
            try {
              const api = groundRef.current;
              if (!api) return;

              // If we just applied one or more FENs programmatically, ignore one queued
              // change event per pending application (see applyingFenCountRef above).
              if (applyingFenCountRef.current > 0) {
                applyingFenCountRef.current -= 1;
                return;
              }

              // Prefer a provided getFen() if available (it returns full FEN)
              let newFen =
                typeof api.getFen === "function"
                  ? api.getFen()
                  : piecesToFen(statePiecesToObject(api.state.pieces));

              // Normalize the fen to a consistent shape, then force the turn field to match
              // our own tracked side-to-move — chessground's internal turn color isn't kept
              // in sync with it (this is a board editor, not a live game), so trusting
              // chessground's own reported turn here would silently reset it to white on
              // every piece edit.
              newFen = applySideToFen(normalizeFen(newFen), sideToMoveRef.current);

              setFen((prev) => (prev !== newFen ? newFen : prev));
            } catch (err) {
              // ignore errors while reading state
            }
          });
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
      placePieceAt(sq, { role: piece.role, color: piece.color });
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);

    // ---------- DELETION (Alt+click or right-click only) ----------
    const onPointerDownCapture = (ev: PointerEvent) => {
      if (!boardRef.current || !groundRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;

      const wantDelete = ev.altKey || ev.button === 2;
      if (wantDelete) {
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
          setFen(applySideToFen(newFen, sideToMoveRef.current));
        }, 0);
        return;
      }

      // ---------- BRUSH (a palette piece is armed) ----------
      if (ev.button === 0 && selectedRoleRef.current) {
        try { (ev as any).stopImmediatePropagation?.(); } catch {}
        ev.preventDefault();

        const sq = squareFromClientPos(ev.clientX, ev.clientY, rect, orientation);
        if (!sq) return;

        placePieceAt(sq, { role: selectedRoleRef.current, color: paletteColorRef.current });
        paintedSquareRef.current = sq;
        isPaintingRef.current = true;
      }
    };

    const onPointerMoveCapture = (ev: PointerEvent) => {
      if (!isPaintingRef.current || !selectedRoleRef.current) return;
      if (!(ev.buttons & 1)) { isPaintingRef.current = false; return; }
      if (!boardRef.current || !groundRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const sq = squareFromClientPos(ev.clientX, ev.clientY, rect, orientation);
      if (!sq || sq === paintedSquareRef.current) return;
      placePieceAt(sq, { role: selectedRoleRef.current, color: paletteColorRef.current });
      paintedSquareRef.current = sq;
    };

    const onPointerUp = () => {
      isPaintingRef.current = false;
      paintedSquareRef.current = null;
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
        setFen(applySideToFen(newFen, sideToMoveRef.current));
      }, 0);
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    document.addEventListener("pointermove", onPointerMoveCapture, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      document.removeEventListener("pointermove", onPointerMoveCapture, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("contextmenu", onContextMenu);
      groundRef.current?.destroy();
      groundRef.current = null;

       // clean up fallback timer
      if (pendingApplyTimeoutRef.current) {
        window.clearTimeout(pendingApplyTimeoutRef.current);
        pendingApplyTimeoutRef.current = null;
      }
    };
  }, [orientation]);

  const pieceRoles = [
    "pawn",
    "painter",
    "snare",
    "knight",
    "bishop",
    "mann",
    "wizard",
    "archer",
    "rook",
    "champion",
    "princess",
    "queen",
    "amazon",
    "rollingsnare",
    "royalpainter",
    "centaur",
    "king",
    "general"
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

  // --------- VALIDATION + NAVIGATION ----------
  // A side's "royal" piece is its king OR its general (a general is a king alternative;
  // a side must have exactly one of the two, never both, never neither).
  function countRoyalsFromState(): { white: number; black: number } {
    try {
      const piecesState = groundRef.current?.state?.pieces;
      if (piecesState) {
        const obj = statePiecesToObject(piecesState);
        let white = 0;
        let black = 0;
        for (const sq in obj) {
          const p = obj[sq];
          if (!p) continue;
          const role = p.role ? p.role.toLowerCase() : "";
          if (role === "king" || role === "general") {
            if (p.color === "white") white++;
            else if (p.color === "black") black++;
          }
        }
        return { white, black };
      }
    } catch (e) {
      // ignore, fallback to fen parsing below
    }

    // fallback: parse FEN first field and count K/k/G/g
    const placement = fen.split(" ")[0] ?? fen;
    let white = 0;
    let black = 0;
    for (const ch of placement) {
      if (ch === "K" || ch === "G") white++;
      if (ch === "k" || ch === "g") black++;
    }
    return { white, black };
  }

function validateFenForAnalysis(): { ok: boolean; reason?: string } {
  const { white, black } = countRoyalsFromState();
  if (white !== 1 || black !== 1) {
    return { ok: false, reason: `Need exactly one royal piece (king or general) per side — currently white=${white}, black=${black}` };
  }

  const piecesState = statePiecesToObject(groundRef.current?.state?.pieces ?? {});
  const rawFen = piecesToFen(piecesState);

  // inverse map for normalizing single-letter roles to full names only for attacks()
  const fenLetterToRole: Record<string, string> = {
    p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
    c: "champion", i: "princess", m: "mann", l: "rollingsnare", o: "royalpainter",
    y: "painter", s: "snare", w: "wizard", x: "archer", a: "amazon", u: "centaur",
    g: "general",
  };

  // helper: algebraic -> 0..63 square index (a1=0, b1=1, ..., a2=8, ...)
  const algebraicToIndex = (sq: string) => {
    const file = FILES.indexOf(sq[0]);
    const rank = Number(sq[1]) - 1;
    return rank * 8 + file;
  };

  // find opponent's royal square (king or general), algebraic
  const moverColor = sideToMove; // "white" | "black"
  const opponentColor = moverColor === "white" ? "black" : "white";
  let opponentKingSqAlg: string | null = null;
  for (const sq of Object.keys(piecesState)) {
    const p = piecesState[sq];
    if (!p) continue;
    const roleStr = typeof p.role === "string" ? p.role.toLowerCase() : p.role;
    if ((roleStr === "king" || roleStr === "general") && p.color === opponentColor) {
      opponentKingSqAlg = sq;
      break;
    }
  }
  if (!opponentKingSqAlg) {
    //console.debug("validateFenForAnalysis: opponent royal piece not found", { piecesState, moverColor });
    return { ok: false, reason: `Couldn't find opponent's king or general on the board.` };
  }
  const opponentKingIndex = algebraicToIndex(opponentKingSqAlg);

  // build occupied SquareSet expected by chessops.attacks
  let occupied = SquareSet.empty();
  for (const sq of Object.keys(piecesState)) {
    if (!sq || sq.length < 2) continue;
    const idx = algebraicToIndex(sq);
    occupied = occupied.with(idx);
  }

  // Manual per-piece attack check using chessops.attacks() with normalized role names
  try {
    for (const [sqAlg, p] of Object.entries(piecesState)) {
      if (!p) continue;
      if (p.color !== moverColor) continue;
      if (!sqAlg || sqAlg.length < 2) continue;
      const idx = algebraicToIndex(sqAlg);

      // Normalize role for attacks(): if it's a single fen-letter, map it to the full role string
      let roleName = typeof p.role === "string" ? p.role.trim().toLowerCase() : (p.role as string);
      if (roleName && roleName.length === 1) {
        const mapped = fenLetterToRole[roleName];
        if (mapped) roleName = mapped;
      }
      if (roleName && roleName.length === 1 && /^[A-Z]$/.test(roleName)) {
        // uppercase single-letter (just in case)
        const mapped = fenLetterToRole[roleName.toLowerCase()];
        if (mapped) roleName = mapped;
      }

      const pieceObj = { role: roleName, color: p.color };
      //console.debug("validateFenForAnalysis: testing piece", { sq: sqAlg, originalRole: p.role, normalizedRole: roleName, color: p.color, idx });

      const attacked = attacks(pieceObj as any, idx as any, occupied as any);
      const hitsKing = attacked.has(opponentKingIndex);

      //console.debug("validateFenForAnalysis: attacked contains king?", { sq: sqAlg, normalizedRole: roleName, hitsKing });

      if (hitsKing) {
        const mover = moverColor === "white" ? "White" : "Black";
        console.warn("validateFenForAnalysis: check detected (manual). Piece attacking king:", { sq: sqAlg, roleName, moverColor });
        return { ok: false, reason: `${mover} (side to move) appears to be giving check — fix the position before analysis.` };
      }
    }
  } catch (err: any) {
    console.error("validateFenForAnalysis: chessops.attacks() threw — falling back to parse/flip validation", err);
    // continue to fallback parsing below
  }

  // --- NO MAPPING: use the raw FEN produced from the board (which contains your custom letters) ---
  const convertedFen = rawFen; // intentionally not converting custom letters

  // basic FEN sanity checks (same as before)
  const parts = convertedFen.split(" ");
  if (parts.length < 2) {
    return { ok: false, reason: `Malformed FEN (missing fields): "${convertedFen}"` };
  }
  const placement = parts[0];
  const ranks = placement.split("/");
  if (ranks.length !== 8) {
    return { ok: false, reason: `FEN placement must have 8 slash-separated ranks. Got ${ranks.length}: "${placement}"` };
  }
  for (let i = 0; i < ranks.length; i++) {
    const r = ranks[i];
    let sum = 0;
    for (const ch of r) {
      if (ch >= "1" && ch <= "8") sum += Number(ch);
      else if (/^[a-zA-Z]$/.test(ch)) sum += 1;
      else {
        return { ok: false, reason: `Invalid character "${ch}" in rank ${i + 1}: "${r}" — FEN: "${convertedFen}"` };
      }
      if (sum > 8) {
        return { ok: false, reason: `Rank ${i + 1} adds up to >8 (invalid FEN): rank="${r}", FEN="${convertedFen}"` };
      }
    }
    if (sum !== 8) {
      return { ok: false, reason: `Rank ${i + 1} sums to ${sum} (must be 8): rank="${r}", FEN="${convertedFen}"` };
    }
  }

  // parse and flipped-check using chessops, but with raw/custom fen
  let setup;
  try {
    setup = parseFen(convertedFen).unwrap();
  } catch (err: any) {
    const msg = err && err.message ? `: ${err.message}` : "";
    return { ok: false, reason: `Unable to parse FEN${msg}. FEN: "${convertedFen}".` };
  }

  try {
    const flippedTurn = setup.turn === "white" ? ("black" as "black") : ("white" as "white");
    const flippedSetup = { ...setup, turn: flippedTurn };

    try {
      const flippedPos = Chess.fromSetup(flippedSetup).unwrap();
      if (flippedPos.isCheck()) {
        const mover = sideToMove === "white" ? "White" : "Black";
        return { ok: false, reason: `${mover} (side to move) appears to be giving check — fix the position before analysis.` };
      }
      // flipped build succeeded and opponent is NOT in check -> allow analysis
      return { ok: true };
    } catch (flipErr: any) {
      const flipMsg = flipErr && flipErr.message ? `: ${flipErr.message}` : "";
      try {
        const pos = Chess.fromSetup(setup).unwrap();
        pos;
        return { ok: true };
      } catch (origErr: any) {
        const origMsg = origErr && origErr.message ? `: ${origErr.message}` : "";
        return { ok: false, reason: `Failed to validate checks. Flipped build error${flipMsg}. Original build error${origMsg}. FEN: "${convertedFen}".` };
      }
    }
  } catch (err: any) {
    const msg = err && err.message ? `: ${err.message}` : "";
    return { ok: false, reason: `Unexpected error validating checks${msg}. FEN: "${convertedFen}".` };
  }
}




function handleOpenInAnalysis() {
  const res = validateFenForAnalysis();
  if (!res.ok) {
    setAnalysisError(res.reason ?? "FEN is not valid for analysis");
    return;
  }

  const piecesState = statePiecesToObject(groundRef.current?.state?.pieces ?? {});
  const baseFen = piecesToFen(piecesState); // only placement + side to move

  // Extract castling rights and en passant info from the *current* fen
  const currentParts = fen.split(" ");
  const castlingRights = currentParts[2] ?? "-";
  const enPassant = currentParts[3] ?? "-";
  const halfmove = currentParts[4] ?? "0";
  const fullmove = currentParts[5] ?? "1";

  // Replace the middle fields in baseFen with these details
  const fenParts = baseFen.split(" ");
  // baseFen = [placement, sideToMove, "-", "-", "0", "1"]
  fenParts[2] = castlingRights;
  fenParts[3] = enPassant;
  fenParts[4] = halfmove;
  fenParts[5] = fullmove;

  const fenToSend = fenParts.join(" ");

  navigate("/analysis", { state: { initialFen: fenToSend } });
}

function handlePlayVsComputer() {
  const res = validateFenForAnalysis();
  if (!res.ok) {
    setAnalysisError(res.reason ?? "FEN is not valid");
    return;
  }

  const piecesState = statePiecesToObject(groundRef.current?.state?.pieces ?? {});
  const baseFen = piecesToFen(piecesState);
  const currentParts = fen.split(" ");
  const fenParts = baseFen.split(" ");
  fenParts[2] = currentParts[2] ?? "-";
  fenParts[3] = currentParts[3] ?? "-";
  fenParts[4] = currentParts[4] ?? "0";
  fenParts[5] = currentParts[5] ?? "1";

  navigate("/play/computer", { state: { initialFen: fenParts.join(" ") } });
}

function handleWatchEngineVsEngine() {
  const res = validateFenForAnalysis();
  if (!res.ok) {
    setAnalysisError(res.reason ?? "FEN is not valid");
    return;
  }

  const piecesState = statePiecesToObject(groundRef.current?.state?.pieces ?? {});
  const baseFen = piecesToFen(piecesState);
  const currentParts = fen.split(" ");
  const fenParts = baseFen.split(" ");
  fenParts[2] = currentParts[2] ?? "-";
  fenParts[3] = currentParts[3] ?? "-";
  fenParts[4] = currentParts[4] ?? "0";
  fenParts[5] = currentParts[5] ?? "1";

  navigate("/play/computer", { state: { initialFen: fenParts.join(" "), watchMode: true } });
}


    function handleSetStartPosition() {
    setFen(START_FEN);
    try { groundRef.current?.set?.({ fen: START_FEN }); } catch {}
    }

    function handleSetEmptyPosition() {
    setFen(EMPTY_FEN);
    try { groundRef.current?.set?.({ fen: EMPTY_FEN }); } catch {}
  }

  // helper (optional): reuse your pieces->FEN logic but let us compute inline for clarity
function buildFenFromPiecesWithSide(pieces: Record<string, { role: string; color: string }>, side: "white" | "black") {
  const ranks: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0;
    let rankStr = "";
    for (let file = 0; file < 8; file++) {
      const sq = `${FILES[file]}${rank + 1}`;
      const p = pieces[sq];
      if (!p) { empty++; }
      else {
        if (empty > 0) { rankStr += String(empty); empty = 0; }
        const letter = roleToFenLetter(p.role);
        rankStr += p.color === "white" ? letter.toUpperCase() : letter.toLowerCase();
      }
    }
    if (empty > 0) rankStr += String(empty);
    ranks.push(rankStr);
  }
  const turnShort = side === "white" ? "w" : "b";
  return `${ranks.join("/")} ${turnShort} - - 0 1`;
}

function normalizeFen(input: string): string {
  // Trim spaces
  let fen = input.trim();

  // If user only provided placement (no spaces) OR only placement + turn
  const parts = fen.split(/\s+/);

  if (parts.length === 1) {
    // Only placement → add defaults
    return `${parts[0]} w - - 0 1`;
  }
  if (parts.length === 2) {
    // placement + turn only
    return `${parts[0]} ${parts[1]} - - 0 1`;
  }
  if (parts.length === 3) {
    return `${parts[0]} ${parts[1]} ${parts[2]} - 0 1`;
  }
  if (parts.length === 4) {
    return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} 0 1`;
  }

  // Already valid length (5 or 6 fields)
  return fen;
}

function tryApplyFen(rawInput: string) {
  const normalized = normalizeFen(rawInput);

  try {
    // will throw if invalid
    parseFen(normalized).unwrap();

    // Note: deliberately NOT calling setFen(normalized) here. The caller (the input's
    // onChange) already set `fen` to the raw text the user typed. Overwriting it here with
    // the normalized/padded string mid-keystroke used to snap the input's value out from
    // under the user's cursor, garbling anything typed immediately after (e.g. typing a
    // placement-only FEN would get padded to "... w - - 0 1" and further characters would
    // land after that padding instead of where the user was actually typing).

    // mark that we're programmatically applying a FEN so the change handler ignores the
    // corresponding queued change event (one increment per application — see
    // applyingFenCountRef above)
    applyingFenCountRef.current += 1;

    // Use the chessground API to set the fen (drives the live board preview only).
    try {
      groundRef.current?.set?.({ fen: normalized });
          // safety fallback: fully reset the count if change events never arrive within 150ms
          // of the last application (e.g. because the applied fen didn't actually change
          // anything, so chessground never fired "change" for it)
    if (pendingApplyTimeoutRef.current) {
      window.clearTimeout(pendingApplyTimeoutRef.current);
    }
    pendingApplyTimeoutRef.current = window.setTimeout(() => {
      applyingFenCountRef.current = 0;
      pendingApplyTimeoutRef.current = null;
    }, 150);

    } catch (err) {
      // ignore
    }

    // update side-to-move to stay in sync, but only when the user actually typed an
    // explicit turn field themselves — not when normalizeFen defaulted it to "w" while
    // they were still mid-way through typing the placement field.
    const rawParts = rawInput.trim().split(/\s+/);
    const rawTurnField = rawParts.length >= 2 ? rawParts[1] : undefined;
    if (rawTurnField === "w" || rawTurnField === "b") {
      setSideToMove(rawTurnField === "w" ? "white" : "black");
    }
  } catch (err) {
    // Invalid FEN while typing: don't throw — user is still typing
  }
}

function EditorButton({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 12px",
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 500,
        cursor: "pointer",
        color: primary ? "#fff" : "#eee",
        background: primary
          ? "linear-gradient(135deg, #5b5be0, #3f3fc0)"
          : "rgba(255,255,255,0.06)",
        border: primary
          ? "none"
          : "1px solid rgba(255,255,255,0.12)",
        boxShadow: primary
          ? "0 4px 10px rgba(0,0,0,0.35)"
          : "none",
        transition: "transform 0.05s ease, background 0.15s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

  return (
    <div style={{ minHeight: "100%", display: "flex", justifyContent: "center", padding: 24 }}>
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <div
  style={{
    width: 200,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }}
>

  <EditorButton onClick={handleSetStartPosition}>
    Start Position
  </EditorButton>

  <EditorButton onClick={handleSetEmptyPosition}>
    Only Kings
  </EditorButton>

  <EditorButton
    onClick={() => {
      const next = sideToMove === "white" ? "black" : "white";
      const pieces = statePiecesToObject(groundRef.current?.state?.pieces ?? {});
      const newFen = buildFenFromPiecesWithSide(pieces, next);
      // Preserve castling rights from the current FEN
      const newParts = newFen.split(" ");
      const currentParts = fen.split(" ");
      newParts[2] = currentParts[2] ?? "-";
      const finalFen = newParts.join(" ");
      groundRef.current?.set?.({ fen: finalFen });
      setSideToMove(next);
      setFen(finalFen);
    }}
  >
    Make {sideToMove === "white" ? "Black" : "White"} to Move
  </EditorButton>

  <EditorButton
    onClick={handleOpenInAnalysis}
    primary
  >
    Analyze
  </EditorButton>

  <EditorButton
    onClick={handlePlayVsComputer}
    primary
  >
    Play vs Computer
  </EditorButton>
  <EditorButton
    onClick={handleWatchEngineVsEngine}
  >
    Watch Engine vs Engine
  </EditorButton>
    {analysisError && (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(255, 80, 80, 0.12)",
        border: "1px solid rgba(255, 80, 80, 0.35)",
        color: "#ffb3b3",
        fontSize: 13,
        lineHeight: 1.35,
      }}
    >
      {analysisError}
    </div>
  )}
</div>

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
              cursor: selectedRole ? "crosshair" : undefined,
            }}
          />
          <div style={{ marginTop: 10, marginBottom: 10, width: "100%", textAlign: "center" }}>
              <input
                value={fen}
                onChange={(e) => {
                  const v = e.target.value;
                  setFen(v);      
                  tryApplyFen(v); 
                }
              }
                spellCheck={false}
                style={{
                  width: "95%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontFamily: "monospace",
                  fontSize: 13,
                }}
              />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#aaa" }}>
            Tip: click a palette piece to arm it as a brush, then click (or drag across) the board
            to place it — click it again or press Esc to put the brush away. Alt+click or
            right-click a square to remove a piece.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            className="palette"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 12,
              alignContent: "start",
              padding: 8,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
            }}
          >
            {palette.map((p, i) => {
              const isArmed = selectedRole === p.role;
              return (
                <div
                  key={`${p.role}-${p.color}-${i}`}
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, p)}
                  onClick={() => setSelectedRole((prev) => (prev === p.role ? null : p.role))}
                  title={`Click to ${isArmed ? "put away" : "arm as brush"}, or drag onto the board`}
                  style={{
                    width: 72,
                    height: 72,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "grab",
                    borderRadius: 6,
                    background: isArmed ? "rgba(91,91,224,0.35)" : "transparent",
                    boxShadow: isArmed ? "0 0 0 2px #5b5be0" : "none",
                  }}
                >
                  <div className={`cg-piece ${p.role} ${p.color}`} style={{ width: 64, height: 64 }} />
                </div>
              );
            })}
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
