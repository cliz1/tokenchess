// Piece-wiki popup for use during games: pick a piece, read its page, close.
import { useEffect, useState } from "react";
import WikiPiece from "./WikiPiece";
import { WIKI_PIECES } from "../wiki/pieces";

export default function WikiModal({ open, onClose, initialSlug }: { open: boolean; onClose: () => void; initialSlug?: string }) {
  const [slug, setSlug] = useState(initialSlug ?? WIKI_PIECES[0].slug);
  useEffect(() => { if (initialSlug) setSlug(initialSlug); }, [initialSlug]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const entry = WIKI_PIECES.find((p) => p.slug === slug) ?? WIKI_PIECES[0];

  return (
    <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Piece guide" onClick={(e) => e.stopPropagation()}
        style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, width: "100%", maxWidth: 820, maxHeight: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
            {WIKI_PIECES.map((p) => (
              <button key={p.slug} onClick={() => setSlug(p.slug)} aria-current={p.slug === slug ? "true" : undefined}
                style={{ padding: "4px 10px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: p.slug === slug ? "#fff" : "#bbb", background: p.slug === slug ? "rgba(255,255,255,0.12)" : "transparent" }}>
                {p.name}
              </button>
            ))}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: 16 }}>
          <WikiPiece entry={entry} boardSize={336} />
        </div>
      </div>
    </div>
  );
}
