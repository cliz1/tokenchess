// A small non-interactive board from a FEN, for previews (no chessground, no engine)
import { parseBoardFen } from "chessops/fen";
import type { Board } from "chessops/board";
import "../assets/custom-pieces.css";

export default function MiniBoard({ fen, orientation = "white", size = 220 }: { fen: string; orientation?: "white" | "black"; size?: number }) {
  let board: Board;
  try {
    board = parseBoardFen(fen.split(" ")[0]).unwrap();
  } catch {
    return null;
  }
  const cells = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const rank = orientation === "white" ? 7 - r : r;
      const file = orientation === "white" ? f : 7 - f;
      const piece = board.get(file + 8 * rank);
      const light = (file + rank) % 2 === 1;
      cells.push(
        <div
          key={`${r}-${f}`}
          className={piece ? `cg-piece ${piece.role} ${piece.color}` : undefined}
          style={{ backgroundColor: light ? "#ecd9b3" : "#b58f68", backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "contain", aspectRatio: "1" }}
        />
      );
    }
  }
  // backgroundColor (not the `background` shorthand) so the cg-piece sprite image from CSS still shows
  return (
    <div style={{ width: size, maxWidth: "100%", display: "grid", gridTemplateColumns: "repeat(8, 1fr)", borderRadius: 6, overflow: "hidden", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
      {cells}
    </div>
  );
}
