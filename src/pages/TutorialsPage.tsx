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
        note: "Push the pawn and select a queen in the modal.",
      },
    ],
  },

  // Champion (interactive; kept original starting FEN)
  "Champion": {
    title: "The Champion",
    quote: "“I can't be defeated. I beat all men. Someday, I will beat a real champion. If he dies, he dies.” – Ivan Drago",
    steps: [
      {
        text: "The Champion combines the movement of the Rook and Knight pieces. It a classic addition in chess variants. \n José Raúl Capablanca called it the “Chancellor,“ a popular name for the piece, but Token Chess refers to it by the name given by its first introduction to western chess by Italian priest Pietro Carrera.",
        challenge: {
          initialFen: "8/3k4/8/1b2r12/2C5/8/8/3K4 w - - 0 1",
          steps: [
            { white: { from: "c4", to: "e5" }, black: { from: "d7", to: "d6" } },
            { white: { from: "e5", to: "b5" } },
          ],
        },
        note: "Capture the rook, then capture the bishop.",
      },
          {
        text: "You can castle with the Champion, just as you would a rook!",
        challenge: {
          initialFen: "4k3/8/8/8/8/8/5PPP/4K2C w kKQq - 0 1",
          steps: [
            { white: { from: "e1", to: "h1" } }
          ],
        },
        note: "Castle with the Champion.",
      },
    ],
  },

    "Princess": {
    title: "The Princess",
    quote: "“Your princess is quite a winning creature. Her appeal is undeniable.” – Count Rugen",
    steps: [
      {
        text: "The Princess combines the movement of the Rook and Knight pieces. Like the Champion, it is a piece with a long history in chess variants. It is a tricky piece that is quite irritating to play against-- in an open board, the Princess is difficult to escape.",
        challenge: {
          initialFen: "7k/8/8/1I2r3/8/8/8/3K4 w - - 0 1",
          steps: [
            { white: { from: "b5", to: "c3" }, black: { from: "h8", to: "g8" } },
            { white: { from: "c3", to: "e5" } },
          ],
        },
        note: "Retreat the Princess to pin the enemy Rook.",
      },
    ],
  },

  "Amazon": {
    title: "The Amazon",
    quote: "“It is much safer to be feared than loved” – Machiavelli",
    steps: [
      {
        text: "Combining the power of the Queen with that of a Knight, the Amazon is extremely powerful. Unlike any piece in standard chess, it can perform a checkmate without any additional help.",
        challenge: {
          initialFen: "5k2/8/8/8/3A4/8/8/3K4 w - - 0 1",
          steps: [
            { white: { from: "d4", to: "e6" } },
          ],
        },
        note: "Checkmate the enemy King in one move.",
      },
    ],
  },
    "Commoner": {
    title: "The Commoner",
    quote: "“That a peasant may become king does not render the kingdom democratic.” – Woodrow Wilson",
    steps: [
      {
        text: "The Commoner is just like a King, but as it was not born into royalty, it cannot be checkmated. \n While a weak attacker, the Commoner is strong in endgames. For example, despite having the same token cost as a Bishop or Knight, the Commoner can perform checkmate with the help of the King.",
        challenge: {
          initialFen: "6k1/3M4/5K2/8/8/8/8/8 w - - 0 1",
          steps: [
             { white: { from: "d7", to: "e7" }, black: { from: "g8", to: "h7" } },
              { white: { from: "e7", to: "f7" }, black: { from: "h7", to: "h6" } },
            { white: { from: "f7", to: "g6" } },
          ],
        },
        note: "Checkmate the enemy King in three moves.",
      },
            {
        text: "There's more! If sufficiently close to your King, this little endgame magician can effortlessly ward off a Queen, drawing a game down 5 points of material.",
        challenge: {
          initialFen: "5k2/8/8/2K3q1/2M5/8/8/8 w - - 0 1",
          steps: [
             { white: { from: "c4", to: "d5" }, black: { from: "g5", to: "g1" } },
              { white: { from: "d5", to: "d4" }, black: { from: "g1", to: "c1" } },
              { white: { from: "d4", to: "c4" }, black: { from: "c1", to: "a3" } },
              { white: { from: "c4", to: "b4" } },
          ],
        },
        note: "Use the Commoner to block the checks.",
      },
    ],
  },
      "Painter": {
    title: "The Royal Painter",
    quote: "“I dream my paintings, and then I paint my dreams.” – van Gogh",
    steps: [
      {
        text: "While similar to a pawn, the Royal Painter has no stomach for violence. They are not a fighter but a dreamer and an artist. Rather than capture, the Painter paints enemy pieces to its own color.",
        challenge: {
          initialFen: "8/2k1r1pp/8/2PY4/8/8/8/6K1 w - - 0 1",
          steps: [
             { white: { from: "d5", to: "d6" }, black: { from: "c7", to: "d7" } },
              { white: { from: "d6", to: "e7" }},
          ],
        },
        note: "Push the painter, then paint the enemy Rook.",
      },
          {
        text: "While similar to a pawn, the Royal Painter has no stomach for violence. They are not a fighter but a dreamer and an artist. Rather than capture, the Painter paints enemy pieces to its own color.",
        challenge: {
          initialFen: "2k5/4p3/8/8/3Y4/8/8/2K5 w - - 0 1",
          steps: [
             { white: { from: "d4", to: "d5" }, black: { from: "e7", to: "e5" } },
              { white: { from: "d5", to: "e6" }},
          ],
        },
        note: "Push the painter, then paint en passant (en paintssant).",
      },
    ],
  },
        "Snare": {
    title: "The Snare",
    quote: "“It's a trap!” – Admiral Ackbar",
    steps: [
            {
        text: "The Snare is a piece that restricts the movement of enemy pieces within a certain range. The Snare can only move forward, and cannot capture.",
        challenge: {
          initialFen: "3k4/8/2rrr3/2r1r3/2rrS3/8/8/7K w - - 0 1",
          steps: [
             { white: { from: "e4", to: "d5" }},
       
          ],
        },
        note: "Push the Snare forward, then click black's pieces to see which ones can move.",
      },
      {
        text: "The Snare can be a good way to win material. It is generally a good idea to ensnare a target that can easily be attacked, such as with a pawn.",
        challenge: {
          initialFen: "rnb1kb1r/ppp1pppp/5n2/3q4/8/3S4/PPP2PPP/RNBQKBNR w - - 0 1",
          steps: [
             { white: { from: "d3", to: "d4" }, black: { from: "e7", to: "e5" } },
              { white: { from: "c2", to: "c4" }, black: { from: "e5", to: "d4" } },
              { white: { from: "c4", to: "d5" }},
          ],
        },
        note: "Ensnare the enemy Queen, then attack it with a pawn.",
      },
            {
        text: "Note that since the Snare cannot capture, it cannot give check. However, a King may be ensnared. In this case, the opposing side may deliver mate by simply giving a check.",
        challenge: {
          initialFen: "1r6/8/1k6/8/S7/8/3B4/1K6 w - - 0 1",
          steps: [
             { white: { from: "a4", to: "b5" }, black: { from: "b8", to: "e8" } },
              { white: { from: "d2", to: "a5" }},
          ],
        },
        note: "Ensnare the King, then deliver checkmate.",
      },
  
    ],
  },
          "Wizard": {
    title: "The Wizard",
    quote: "“A wizard is never late. Nor is he early. He arrives precisely when he means to.” – Gandalf",
    steps: [
            {
        text: "The Wizard moves up to two squares orthogonally, disregarding occupancy of squares in between.",
        challenge: {
          initialFen: "8/8/5k2/8/3WP3/8/5b2/3K4 w - - 0 1",
          steps: [
               { white: { from: "d4", to: "f4" }, black: { from: "f6", to: "e5" } },
              { white: { from: "f4", to: "f2" }},
       
          ],
        },
        note: "Jump over the pawn, then capture the bishop.",
      },
      {
        text: "The true power of the Wizard lies in its ability to swap places with a friendly piece within its movement range. This ability disregards pins, unlike standard chess rules which disallow moving “through“ check.",
        challenge: {
          initialFen: "7k/6b1/8/8/3W4/2K5/3P4/8 w - - 0 1",
          steps: [
              { white: { from: "d4", to: "d2" }},
          ],
        },
        note: "Escape the pin.",
      },
            {
        text: "The Wizard creates value by relocating poorly positioned pieces with low mobility. For example, a Wizard may create a passed pawn from an otherwise deadlocked structure.",
        challenge: {
          initialFen: "8/k7/2p5/1pP1W3/1P6/2K3b1/8/8 w - - 0 1",
          steps: [
             { white: { from: "e5", to: "c5" }, black: { from: "a7", to: "b7" } },
              { white: { from: "e5", to: "e6" }},
          ],
        },
        note: "Use the wizard to create a passed pawn, then push the pawn.",
      },
            {
        text: "The Wizard may be used to escape the King from dangerous places, including positions which would otherwise be checkmate!",
        challenge: {
          initialFen: "rnb1kb1r/ppp1pppp/3p1n2/8/8/2N3Pp/PPPPPPqP/R2QW1KR w - - 0 1",
          steps: [
              { white: { from: "e1", to: "g1" }},
          ],
        },
        note: "Escape the checkmate attempt.",
      },
      {
        text: "While not a strong attacker, the Wizard is sufficient to deliver checkmate in an endgame.",
        challenge: {
          initialFen: "2k5/8/1W1K4/8/8/8/8/8 w - - 0 1",
          steps: [
             { white: { from: "b6", to: "d6" }, black: { from: "c8", to: "b8" } },
             { white: { from: "d6", to: "d8" }, black: { from: "b8", to: "a8" } },
              { white: { from: "d8", to: "c8" }},
          ],
        },
        note: "Use the Wizard to checkmate in three moves.",
      },
  
  
    ],
  },
      "Archer": {
    title: "The Archer",
    quote: "“Swift as the wind, silent as the forest.” – Sun Tzu",
    steps: [
      {
        text: "The Archer is a slow piece, moving one square diagonally at a time. This makes it a color-bound piece, like the Bishop.",
        challenge: {
          initialFen: "4k3/8/8/4p3/3p4/4X3/8/4K3 w - - 0 1",
          steps: [
             { white: { from: "e3", to: "d4" }, black: { from: "e8", to: "d8" } },
            { white: { from: "d4", to: "e5" } },
          ],
        },
        note: "Capture the pawns.",
      },
            {
        text: "The Archer has the unique ability to capture without moving, given that the captured piece is 2 to 3 diagonal squares away.",
        challenge: {
          initialFen: "n3k3/7p/8/8/4X3/8/6r1/1n2K3 w - - 0 1",
          steps: [
             { white: { from: "e4", to: "b1" }, black: { from: "e8", to: "d8" } },
              { white: { from: "e4", to: "g2" }, black: { from: "d8", to: "e8" } },
              { white: { from: "e4", to: "h7" } },
          ],
        },
        note: "Capture the pieces in the following order: Knight, Rook, Pawn",
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
          { key: "Champion", label: "2.1 Champion" },
          { key: "Princess", label: "2.2 Princess" },
          { key: "Amazon", label: "2.3 Amazon" },
          { key: "Commoner", label: "2.4 Commoner" },
          { key: "Painter", label: "2.5 Royal Painter" },
          { key: "Snare", label: "2.6 Snare" },
          { key: "Wizard", label: "2.7 Wizard" },
          { key: "Archer", label: "2.8 Archer" }
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

