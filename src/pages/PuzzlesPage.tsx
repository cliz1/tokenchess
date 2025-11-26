import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TutorialBoard from "../components/TutorialBoard";

type Puzzle = {
  initialFen: string;
  steps: any[];
  alt_steps: any[];
  label?: string; // optional custom label
};

export default function PuzzlesPage() {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch("../assets/puzzles.json")
      .then((res) => res.json())
      .then((data) => setPuzzles(data))
      .catch((err) => console.error("Failed to load puzzles:", err));
  }, []);

  const nextPuzzle = () => {
    if (puzzles.length === 0) return;
    setCurrentIndex((i) => (i + 1) % puzzles.length);
  };

  const prevPuzzle = () => {
    if (puzzles.length === 0) return;
    setCurrentIndex((i) => (i - 1 + puzzles.length) % puzzles.length);
  };

  if (puzzles.length === 0) return <div>Loading puzzles...</div>;

  const puzzle = puzzles[currentIndex];

  // compute label: prefer puzzle.label, otherwise derive "White to move" / "Black to move" from FEN
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
        }}
      >
        <TutorialBoard
          initialFen={puzzle.initialFen}
          challenge={puzzle}
          challengeLabel={computeLabel(puzzle)}
          size={600}
          showControls={false}
          debugName="PuzzleBoard"
        />
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={prevPuzzle}>Previous</button>
        <button onClick={nextPuzzle}>Next</button>
      </div>

      <Link
        to="/"
        style={{
          marginTop: 30,
          color: "#7e7bd8ff",
          fontSize: 16,
        }}
      >
        Back to Home
      </Link>
    </div>
  );
}
