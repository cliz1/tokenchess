import React, { useState } from "react";
import { useGameSocket } from "../hooks/useGameSocket";

export default function GamePage() {
  const [fen, setFen] = useState("startpos");
  const { sendFen } = useGameSocket("room1", (newFen) => setFen(newFen));

  return (
    <div>
      <h2>Multiplayer Test</h2>
      <p>FEN: {fen}</p>
      <button onClick={() => {
        const newFen = fen === "startpos"
          ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          : "startpos";
        setFen(newFen);
        sendFen(newFen);
      }}>
        Toggle FEN
      </button>
    </div>
  );
}
