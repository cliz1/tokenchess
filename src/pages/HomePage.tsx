// src/pages/HomePage.tsx
import "../assets/custom-pieces.css"; // ensures cg-piece classes apply

export default function HomePage() {
  const standardPieces = ["pawn", "knight", "bishop", "rook", "queen", "king"];
  const customPieces = ["champion", "princess", "amazon", "mann", "painter", "snare", "wizard", "archer"];

  const renderRow = (pieces: string[], color: "white" | "black") => (
    <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 32, flexWrap: "wrap" }}>
      {pieces.map((role) => (
        <div
          key={`${role}-${color}`}
          className={`cg-piece ${role} ${color}`}
          style={{
            width: 64,
            height: 64,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
            backgroundSize: "64px 64px",
          }}
        />
      ))}
    </div>
  );

  return (
    <div className= "app-container" style={{ padding: 28, maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ marginTop: 0, fontSize: "3.5rem" }}>A game of chess...</h1>

      {/* White rows */}
      {renderRow(standardPieces, "white")}
      {renderRow(customPieces, "white")}

      {/* Black rows */}
      {renderRow(standardPieces, "black")}
      {renderRow(customPieces, "black")}
       <h1 style={{ marginTop: 0, fontSize: "3.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
  ...with tokens
  <img
    src="/images/coin-stack.svg"
    alt="Token"
    style={{ width: 48, height: 48 }}
  />
    <img
    src="/images/coin-stack.svg"
    alt="Token"
    style={{ width: 48, height: 48 }}
  />
.</h1>
    </div>
  );
}
