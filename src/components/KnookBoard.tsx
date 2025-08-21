import { useEffect, useRef, useState } from "react";
import { Chess } from "../../chessops/src/chess"; // your local chessops
import { parseFen, makeFen } from "../../chessops/src/fen";
import { Chessground } from "chessground"; // assuming you're using chessground
import type { Config } from "chessground/config";

export default function KnookBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<any>(null);
  const [chess, setChess] = useState<Chess | null>(null);
  const [fen, setFen] = useState<string>("8/8/8/8/8/8/8/RH6 w KQkq - 0 1"); // custom FEN with Knook

  useEffect(() => {
    const newChess = Chess.default();
    setChess(newChess);
    //setFen(makeFen(newChess.toSetup()));
  }, []);

  useEffect(() => {
    if (!chess || !fen || !containerRef.current) return;

    const config: Config = {
      fen,
      orientation: "white",
      movable: {
        color: "both",
        free: false,
        showDests: true,
        dests: new Map(), // compute later if needed
        events: {
          after: (from, to) => {
            console.log(`Move: ${from} -> ${to}`);
          },
        },
      },
    };


    groundRef.current = Chessground(containerRef.current, config);

    return () => groundRef.current?.destroy();
  }, [fen, chess]);
 
  return <div ref={containerRef} style={{ width: "400px", height: "400px" }} />;
}
