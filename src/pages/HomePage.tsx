// src/pages/HomePage.tsx
import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Welcome to Token Chess!</h1>
      <p style={{ color: "#ccc", fontSize: 16 }}>
        TokenChess blends standard chess with a token system and variant pieces.
        Use the Board Editor to build boards, the Army Builder to compose token armies,
        and the Analysis board to play through or demonstrate lines.
      </p>
    </div>
  );
}
