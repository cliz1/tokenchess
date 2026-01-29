import { useState } from "react";
import TutorialBoard from "../components/TutorialBoard";
import puzzlesData from '../assets/puzzles.json';

type Puzzle = {
  initialFen: string;
  steps: any[];
  alt_steps: any[];
  label?: string;
  orientation?: "white" | "black";
};

export default function PuzzlesPage() {
  const [puzzles] = useState<Puzzle[]>(puzzlesData as unknown as Puzzle[]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextPuzzle = () => {
    setCurrentIndex((i) => (i + 1) % puzzles.length);
  };

  const prevPuzzle = () => {
    setCurrentIndex((i) => (i - 1 + puzzles.length) % puzzles.length);
  };

  const puzzle = puzzles[currentIndex];

  const computeLabel = (p: Puzzle) => {
    if (p.label && p.label.trim().length > 0) return p.label;
    const parts = (p.initialFen || "").split(" ");
    const active = (parts[1] || "w").toLowerCase();
    return active === "b" ? "Black to move" : "White to move";
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "transparent",
      }}
    >
      <div
        style={{
          width: 600,
          height: 600,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 100
        }}
      >
        <TutorialBoard
          initialFen={puzzle.initialFen}
          challenge={puzzle}
          challengeLabel={computeLabel(puzzle)}
          size={600}
          showControls={false}
          debugName="PuzzleBoard"
          orientation={puzzle.orientation}
        />
        <div style={{ marginTop: 20, display: "flex", gap: 10, marginLeft: 10 }}>
        <button onClick={prevPuzzle}>&lt;&lt;</button>
        <button onClick={nextPuzzle}>&gt;&gt;</button>
      </div>
      </div>
    </div>
  );
}
