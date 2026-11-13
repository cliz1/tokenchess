// Piece wiki entries. One object per piece page; add or reorder freely.
//
// Diagrams are a sandbox board (TutorialBoard) that starts with built-in arrows/highlights (`hints`).
// The first move the reader makes clears them; Reset brings them back.
//
// To edit a page: change `summary` / `notes`, tweak `fen` if the piece needs company
// (blockers, targets), and adjust `hints`. Set `todo: true` on an entry that still needs work.
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";

export type WikiEntry = {
  slug: string;        // URL + key: /tutorials/wiki/<slug>
  role: string;        // chessground role, used for the sprite (see src/assets/custom-pieces.css)
  name: string;
  cost: number | null; // token cost; mirrors PIECE_TOKEN_COST in server/src/index.ts. null = not draftable
  summary: string;
  notes?: string[];    // extra rules, interactions, tips
  fen: string;         // diagram position (needs both royal pieces to be a legal position)
  hints: DrawShape[];
  todo?: boolean;
};

// ---- tiny helpers for writing hints ----
const arrows = (from: string, to: string[], brush = "green"): DrawShape[] => to.map((dest) => ({ orig: from as Key, dest: dest as Key, brush }));
const marks = (squares: string[], brush = "red"): DrawShape[] => squares.map((orig) => ({ orig: orig as Key, brush }));

// d4 is the piece's home in most diagrams; these are its standard geometry.
const KNIGHT_FROM_D4 = ["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"];
const DIAG_STEPS_FROM_D4 = ["c3", "e3", "c5", "e5"];
const DIAG_SHOTS_FROM_D4 = ["b2", "a1", "f2", "g1", "b6", "a7", "f6", "g7"]; // 2-3 squares away on a diagonal

const lone = (letter: string) => `4k3/8/8/8/3${letter}4/8/8/4K3 w - - 0 1`; // piece on d4, kings on e1/e8

export const WIKI_PIECES: WikiEntry[] = [
  {
    slug: "champion", role: "champion", name: "Champion", cost: 8,
    summary: "A Rook and a Knight in one piece.",
    notes: ["Can castle with the King, like a Rook."],
    fen: lone("C"), hints: arrows("d4", KNIGHT_FROM_D4),
  },
  {
    slug: "princess", role: "princess", name: "Princess", cost: 8,
    summary: "A Bishop and a Knight in one piece.",
    fen: lone("I"), hints: arrows("d4", KNIGHT_FROM_D4),
  },
  {
    slug: "amazon", role: "amazon", name: "Amazon", cost: 13,
    summary: "A Queen and a Knight in one piece.",
    fen: lone("A"), hints: arrows("d4", KNIGHT_FROM_D4),
  },
  {
    slug: "baker", role: "mann", name: "Baker", cost: 3,
    summary: "Steps one square in any direction, like a King.",
    fen: lone("M"), hints: arrows("d4", ["c3", "d3", "e3", "c4", "e4", "c5", "d5", "e5"]),
  },
  {
    slug: "archer", role: "archer", name: "Archer", cost: 5,
    summary: "Steps a single square diagonally and shoots pieces 2–3 squares away on a diagonal without moving.",
    notes: ["On reaching the far rank by a step, the Archer promotes to a Centaur."],
    fen: lone("X"), hints: [...arrows("d4", DIAG_STEPS_FROM_D4), ...marks(DIAG_SHOTS_FROM_D4)],
  },
  {
    slug: "centaur", role: "centaur", name: "Centaur", cost: null,
    summary: "A Knight with the Archer's ranged shot. Reached only by promoting an Archer.",
    notes: ["Not draftable."],
    fen: lone("U"), hints: [...arrows("d4", KNIGHT_FROM_D4), ...marks(DIAG_SHOTS_FROM_D4)],
  },
  {
    slug: "painter", role: "painter", name: "Painter", cost: 2,
    summary: "Moves like a Pawn, but never captures. It paints enemy pieces instead, turning them to its side.",
    notes: [
      "Wet paint: a piece that was just painted cannot be painted again on the opponent's next move.",
      "On reaching the far rank, the Painter promotes to a Royal Painter.",
      "Can paint en passant."
    ],
    fen: "4k3/8/8/2r1n3/3Y4/8/8/4K3 w - - 0 1",
    hints: [...arrows("d4", ["d5"]), ...arrows("d4", ["c5", "e5"], "blue")],
  },
  {
    slug: "royal-painter", role: "royalpainter", name: "Royal Painter", cost: null,
    summary: "A Painter that moves like a Queen. Reached only by promoting a Painter.",
    notes: ["Not draftable."],
    fen: "4k3/6r1/8/8/3O4/8/8/4K3 w - - 0 1",
    hints: [...arrows("d4", ["d8", "h4", "a4", "d1", "a1", "g1", "a7"]), ...arrows("d4", ["g7"], "blue")],
  },
  {
    slug: "snare", role: "snare", name: "Snare", cost: 1,
    summary: "Cannot capture. It traps enemy pieces directly in front of it and beside it so they cannot move.",
    notes: ["Moves one square forward, straight or diagonal.",
      "Cannot move backwards or laterally.",
      "Never captures and never gives check.",
      "On reaching the far rank, the Snare promotes to a Rolling Snare."],
    fen: "4k3/8/8/3b4/2rSn3/8/8/4K3 w - - 0 1",
    hints: [...arrows("d4", ["c5", "e5"]), ...marks(["c4", "e4", "d5"])],
  },
  {
    slug: "rolling-snare", role: "rollingsnare", name: "Rolling Snare", cost: null,
    summary: "A Snare that moves like a Queen and also traps the square behind it. Reached only by promoting a Snare.",
    notes: ["Cannot capture or give check.",
      "Freezes enemy pieces directly in front of it, beside it, and behind it.",
      "Not draftable."],
    fen: "4k3/8/8/3b4/2rLn3/3p4/8/4K3 w - - 0 1",
    hints: [...arrows("d4", ["a7", "g7", "a1", "g1"]), ...marks(["c4", "e4", "d5", "d3"])],
  },
  {
    slug: "wizard", role: "wizard", name: "Wizard", cost: 7,
    summary: "Teleports one or two squares in any direction, ignoring whatever stands in between.",
    notes: [
      "Pieces in the way don't matter: the Wizard jumps over them.",
      "Can swap places with a friendly piece in range.",
      "A swap can pull a friendly piece out of danger, even the King, or put a Pawn, Painter or Snare onto the far rank to promote it.",
    ],
    fen: "4k3/8/8/3p4/1R1W4/8/8/4K3 w - - 0 1",
    hints: [
      ...marks(["d5", "d6", "d3", "d2", "c4", "e4", "f4", "c5", "b6", "e5", "f6", "c3", "b2", "e3", "f2"], "green"),
      ...arrows("d4", ["b4"], "blue"),
    ],
  },
  {
    slug: "general", role: "general", name: "General", cost: 0,
    summary: "An optional replacement for the King. It steps one square straight, but captures from a distance like a Rook.",
    notes: ["Cannot move diagonally.",
      "Captures like a Rook.",
      "The General replaces the King, meaning it can be checkmated.",
      "If a player uses the General, they can win the game by delivering stalemate.",
    ],
    fen: "7k/3n4/8/8/p2G4/8/8/8 w - - 0 1",
    hints: [...arrows("d4", ["d3", "d5", "c4", "e4"]), ...arrows("d4", ["d7", "a4"], "red")],
  },
];

export const wikiBySlug = (slug: string) => WIKI_PIECES.find((p) => p.slug === slug);
