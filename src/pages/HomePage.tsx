import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../assets/custom-pieces.css";

const UPDATE_KEY = "seenUpdateMay2026";

const UPDATE_TITLE = "May 2026 Patch Notes";
const UPDATE_LINES = [
  "Token costs have been rebalanced across several pieces. Before playing a game, please review your active draft — drafts that now exceed the 39-token budget will fall back to the standard setup when a game starts.",
  "You can now play against the computer directly from the Board Editor using any custom position, or using your drafts via Play -> vs Computer",
  "Various bug fixes, mostly related to wizard swapping.",
];

export default function HomePage() {
  const standardPieces = ["pawn", "knight", "bishop", "rook", "queen", "king"];
  const customPieces = ["champion", "princess", "amazon", "mann", "painter", "snare", "wizard", "archer"];

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(UPDATE_KEY)) {
      setShowModal(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(UPDATE_KEY, "1");
    setShowModal(false);
  }

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
    <div className="app-container" style={{ padding: 28, maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>

      {/* Update modal */}
      {showModal && (
        <div
          onClick={dismiss}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "32px 36px",
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              textAlign: "left",
              color: "#eee",
              fontFamily: "monospace",
            }}
          >
            <div style={{ fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              Update
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#fff" }}>
              {UPDATE_TITLE}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {UPDATE_LINES.map((line, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: "#ccc" }}>
                  {line}
                </li>
              ))}
            </ul>
            <Link
              to="/tutorials/balance"
              onClick={dismiss}
              style={{
                display: "block",
                marginTop: 20,
                fontSize: 13,
                color: "#d4af37",
                textDecoration: "none",
              }}
            >
              View the Balance changes →
            </Link>

            <button
              onClick={dismiss}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 0",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <h1 style={{ marginTop: 0, fontSize: "3.5rem" }}>A game of chess...</h1>

      {renderRow(standardPieces, "white")}
      {renderRow(customPieces, "white")}
      {renderRow(standardPieces, "black")}
      {renderRow(customPieces, "black")}

      <h1 style={{ marginTop: 0, fontSize: "3.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        ...with tokens
        <img src="/images/coin-stack.svg" alt="Token" style={{ width: 48, height: 48 }} />
        <img src="/images/coin-stack.svg" alt="Token" style={{ width: 48, height: 48 }} />.
      </h1>

      {/* "What's new" button — fixed so it's always visible even with scroll disabled */}
      {!showModal && (
        <button
          onClick={() => setShowModal(true)}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "transparent",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: 6,
            color: "#d4af37",
            fontSize: 14,
            padding: "7px 16px",
            cursor: "pointer",
            letterSpacing: "0.03em",
          }}
        >
          What's new
        </button>
      )}
    </div>
  );
}
