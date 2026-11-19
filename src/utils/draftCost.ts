// src/utils/draftCost.ts
// Token costs for drafting. Mirrors PIECE_TOKEN_COST on the server.

export const STANDARD_BUDGET = 39;

export function getCost(role: string) {
  const r = role.toLowerCase();
  if (r.includes("pawn")) return 1;
  if (r.includes("knight") || r === "n") return 3;
  if (r.includes("bishop")) return 3;
  if (r.includes("rook")) return 5;
  if (r.includes("queen")) return 9;
  if (r.includes("champion")) return 8;
  if (r.includes("king") || r.includes("general")) return 0;
  if (r.includes("princess")) return 8;
  if (r.includes("amazon")) return 13;
  if (r.includes("mann")) return 3;
  if (r.includes("royalpainter")) return 21;
  if (r.includes("rollingsnare")) return 5;
  if (r.includes("centaur")) return 9;
  if (r.includes("painter")) return 2;
  if (r.includes("snare")) return 1;
  if (r.includes("wizard")) return 7;
  if (r.includes("archer")) return 3;
  return 2;
}

const LETTER_TO_ROLE: Record<string, string> = {
  P: "pawn",
  N: "knight",
  B: "bishop",
  R: "rook",
  Q: "queen",
  K: "king",
  G: "general",
  C: "champion",
  I: "princess",
  A: "amazon",
  M: "mann",
  S: "snare",
  Y: "painter",
  W: "wizard",
  X: "archer",
  O: "royalpainter",
  L: "rollingsnare",
  U: "centaur",
};

// Total token cost of one color's pieces in a FEN (unknown letters count as pawns).
export function computeCostOfColorFromFen(fenStr: string, color: "white" | "black") {
  const placement = fenStr.split(" ")[0] ?? fenStr;
  let total = 0;
  for (const ch of placement) {
    if (ch === "/" || (ch >= "1" && ch <= "8")) continue;
    const isWhite = ch >= "A" && ch <= "Z";
    if ((color === "white") !== isWhite) continue;
    total += getCost(LETTER_TO_ROLE[ch.toUpperCase()] ?? "pawn");
  }
  return total;
}
