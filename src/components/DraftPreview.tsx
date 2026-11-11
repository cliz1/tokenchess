// A draft's two home ranks as piece icons (used on the Home and Play pages)
import { parseBoardFen } from "chessops/fen";
import "../assets/custom-pieces.css";

// a draft's FEN holds white's home ranks at the bottom: returns [rank 2 (front), rank 1 (back)] as role names (null = empty)
export function draftRows(fen?: string): (string | null)[][] | null {
  if (!fen) return null;
  try {
    const board = parseBoardFen(fen.split(" ")[0]).unwrap();
    return [1, 0].map((rank) =>
      Array.from({ length: 8 }, (_, file) => board.get(file + 8 * rank)?.role ?? null)
    );
  } catch {
    return null;
  }
}

export function DraftRows({ rows, maxIcon = 36 }: { rows: (string | null)[][]; maxIcon?: number }) {
  return (
    <>
      {rows.map((row, r) => (
        <div key={r} style={{ display: "flex" }}>
          {row.map((role, f) => (
            <div
              key={f}
              className={role ? `cg-piece ${role} white` : undefined}
              style={{ flex: "1 1 0", aspectRatio: "1", maxWidth: maxIcon, backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "contain" }}
            />
          ))}
        </div>
      ))}
    </>
  );
}
