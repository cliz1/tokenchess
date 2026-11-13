// One piece-wiki page: header, summary, interactive diagram (with built-in hints), movement, notes.
import TutorialBoard from "./TutorialBoard";
import type { WikiEntry } from "../wiki/pieces";
import "../assets/custom-pieces.css";

// Explicit bullets (not the browser's default list markers) so the gap between bullet and text stays tight.
function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: "none", margin: "8px 0", padding: 0, fontSize: 17, lineHeight: 1.6 }}>
      {items.map((text, i) => (
        <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 6 }}>
          <span aria-hidden="true" style={{ flex: "0 0 auto", color: "#d4af37" }}>•</span>
          <span style={{ flex: 1, minWidth: 0 }}>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function WikiPiece({ entry, boardSize = 400 }: { entry: WikiEntry; boardSize?: number }) {
  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "4px 4px 32px", textAlign: "left" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        <div
          className={`cg-piece ${entry.role} white`}
          aria-hidden="true"
          style={{ width: 56, height: 56, flex: "0 0 auto", backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "56px 56px" }}
        />
        <div>
          <h2 style={{ margin: 0, fontSize: 32 }}>{entry.name}</h2>
          <div style={{ color: "#aaa", fontSize: 14 }}>{entry.cost === null ? "Not draftable" : `${entry.cost} token${entry.cost === 1 ? "" : "s"}`}</div>
        </div>
      </header>

      <p style={{ fontSize: 18, lineHeight: 1.55 }}>{entry.summary}</p>

      {/* key={slug} so switching pieces remounts the board and restores its hints */}
      <div style={{ margin: "16px 0" }}>
        <TutorialBoard key={entry.slug} initialFen={entry.fen} hints={entry.hints} size={boardSize} showReset debugName={`wiki-${entry.slug}`} />
        <div style={{ textAlign: "center", color: "#888", fontSize: 13, marginTop: 4 }}>Move pieces to experiment. Hints return on Reset.</div>
      </div>

      {entry.notes && entry.notes.length > 0 && (
        <>
          <h3>Notes</h3>
          <BulletList items={entry.notes} />
        </>
      )}
    </article>
  );
}
