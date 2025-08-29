// src/pages/TutorialsPage.tsx
import React, { useMemo, useState } from "react";
import TutorialLesson from "../components/TutorialLesson";
import { Link } from "react-router-dom";

/**
 * Build a lessons object mapping "slug" -> { title, steps }
 * Expand this object with each sub-section you want.
 *
 * The provided ones are examples you can copy/extend.
 */
const LESSONS = {
  // Standard Chess
  "standard-rules": {
    title: "Rules of Standard Chess",
    quote: "chess is a waste of time lol",
    steps: [
      { text: "Standard chess is played on an 8x8 board. Each side starts with 16 pieces..." },
      // Add small illustrative FENs if you like
    ],
  },

  // Pawn (both steps are now interactive challenges)
  "pawn": {
    title: "Standard Chess Pieces: Pawns",
    quote: "“The pawn is the soul of chess.” – Philidor",
    steps: [
      {
        text: "The pawn is the most basic unit in a game of chess. They are considered the weakest and least valuable of all the pieces, but their effect on the game is immense. Depending on the context, a pawn may be either expendable or priceless. \n \n A pawn can only move forward. On its first move, it can move up to 2 spaces. Otherwise it moves only one space.",
        challenge: {
          initialFen: "3k4/8/8/8/8/8/3P4/3K4 w - - 0 1",
          steps: [
            { white: { from: "d2", to: "d4" }, black: {from: "d8", to: "c8"} }, {white: {from: "d4", to: "d5"}}
          ],
        },
        note: "Push the pawn two squares, then push it again.",
      },
      {
        text: "When capturing, pawns must move one square diagonally.",
        challenge: {
          initialFen: "3k4/8/8/4n3/3P4/8/8/3K4 w - - 0 1",
          steps: [
            { white: { from: "d4", to: "e5" } },
          ],
        },
        note: "Capture the knight to complete this exercise.",
      },
      {
        text: "It would be boring if a pawn ran out of moves upon reaching the other end of the board. For this reason, a pawn reaching the other end must be swapped for a piece of the player's choice. This is called 'promoting.'",
        challenge: {
          initialFen: "3k4/P7/8/8/8/8/8/3K4 w - - 0 1",
          steps: [
            // placeholder: require promotion to queen
            { white: { from: "a7", to: "a8", promotion: "queen" } },
          ],
        },
        note: "Select the queen in the promotion modal to complete the exercise.",
      },
    ],
  },

  // Chancellor (interactive; kept original starting FEN)
  "chancellor": {
    title: "Chancellor",
    quote: "“The pawn is the soul of chess.” – Philidor",
    steps: [
      {
        text: "The Chancellor combines rook + knight movement. Practice a simple Chancellor maneuver.",
        challenge: {
          initialFen: "8/8/8/3c4/8/8/8/8 w - - 0 1",
          // placeholder moves — replace with the sequence you prefer
          steps: [
            { white: { from: "d5", to: "f5" }, black: { from: "a7", to: "a6" } },
            { white: { from: "f5", to: "f7" } },
          ],
        },
        note: "This is an interactive exercise — play the indicated white moves.",
      },
    ],
  },

  // Token chess rules / how-to examples
  "token-system": {
    title: "The Token System",
    quote: "“The pawn is the soul of chess.” – Philidor",
    steps: [
      { text: "Tokens give you budgeted points to spend on pieces. Use the Army Builder to create armies using the token budget." },
      { text: "In the Army Builder you can save and export armies as JSON so the Board Editor can place them." },
    ],
  },
};

type LessonKey = keyof typeof LESSONS;

export default function TutorialsPage() {
  const groups = useMemo(
    () => [
      {
        heading: "1. Standard Chess",
        items: [
          { key: "standard-rules", label: "1.1 Rules of Standard Chess" },
          { key: "pawn", label: "1.2 Pawn" },
        ],
      },
      {
        heading: "2. Token Chess Pieces",
        items: [
          { key: "chancellor", label: "2.1 Chancellor" },
          // add other token pieces...
        ],
      },
      {
        heading: "3. Token Chess Rules",
        items: [{ key: "token-system", label: "3.1 The Token System" }],
      },
    ],
    []
  );

  const [selected, setSelected] = useState<LessonKey>("standard-rules");

  const lesson = LESSONS[selected];

  return (
    <div style={{ display: "flex", gap: 18, padding: 20 }}>
      {/* Sidebar TOC */}
      <aside style={{ width: 280, padding: 12, borderRight: "1px solid rgba(255,255,255,0.04)" }}>
        <h3 style={{ marginTop: 4 }}>Tutorials — Table of contents</h3>
        {groups.map((g) => (
          <div key={g.heading} style={{ marginTop: 12 }}>
            <div style={{ color: "#bbb", fontSize: 13, marginBottom: 8 }}>{g.heading}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map((it) => (
                <button
                  key={it.key}
                  onClick={() => setSelected(it.key as LessonKey)}
                  style={{
                    display: "block",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: selected === it.key ? "rgba(255,255,255,0.06)" : "transparent",
                    border: "none",
                    color: selected === it.key ? "#fff" : "#ccc",
                    cursor: "pointer",
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 18 }}>
          <Link to="/">← Back to Home</Link>
        </div>
      </aside>

      {/* Content area */}
      <section style={{ flex: 1 }}>
        <TutorialLesson title={lesson.title} steps={lesson.steps} quote={lesson.quote} />
      </section>
    </div>
  );
}

