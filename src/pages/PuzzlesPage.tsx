import { Link } from "react-router-dom";
import TutorialBoard from "../components/TutorialBoard";

const examplePuzzle = {
  initialFen: "r4bk1/5ppp/aip5/1b3N2/7W/1YB5/1K2B3/6R1 w - - 0 1",
  steps: [
    { white: { from: "f5", to: "h6" }, black: {from: "g8", to: "h8"} },
    { white: { from: "h6", to: "f7" }, black: {from: "h8", to: "g8"} },
    { white: { from: "f7", to: "h6" }, black: {from: "g8", to: "h8"} },
    { white: { from: "h4", to: "h6" }, black: {from: "h8", to: "g8"} },
    { white: { from: "e2", to: "c4" }, black: {from: "b5", to: "c4"} },
    { white: { from: "b3", to: "c4" }, black: {from: "b6", to: "c4"} },
    { white: { from: "b3", to: "c4" }, black: {from: "a6", to: "c4"} },
    { white: { from: "b3", to: "c4" } },
  ],
  alt_steps: []
};

export default function PuzzlesPage() {
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
        backgroundColor: "transparent"
      }}
    >
      <div
        style={{
          width: 600,
          height: 600,
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <TutorialBoard
          initialFen={examplePuzzle.initialFen}
          challenge={examplePuzzle}
          challengeLabel="White to move"
          size={600}
          showControls={false}
          debugName="PuzzleBoard"
        />
      </div>

      {/* Back home button */}
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
