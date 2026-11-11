// src/utils/profile.ts
import { ROLE_DISPLAY_NAMES } from "./chessHelpers";

export type Profile = {
  id: string;
  username: string;
  bio: string | null;
  flair: string | null;
  country: string | null;
  favoritePiece: string | null;
  joinedAt: string;
  stats: { wins: number; draws: number; losses: number; total: number };
  recentGames: ProfileGame[];
};

export type ProfileGame = {
  id: string;
  whiteId: string;
  blackId: string;
  whiteUsername: string;
  blackUsername: string;
  result: string;
  pgn: string;
  moves: string | null; // UCI, space-separated; null for older games
  startFen: string;
  timeControl: string;
  playedAt: string;
  moveCount: number;
};

export const FLAIRS = ["♟️", "👑", "🔥", "⚡", "🪙", "🦉", "🐉", "🐺", "🐆", "❤️", "🌙", "⭐", "☕", "🍓", "⚔️", "🧙", "🏹", "🍞"];

export const FAVORITE_PIECES = [
  "pawn", "knight", "bishop", "rook", "queen", "king", "champion", "princess", "amazon", "mann",
  "painter", "royalpainter", "snare", "rollingsnare", "wizard", "archer", "general", "centaur",
];

export const pieceLabel = (role: string) =>
  ROLE_DISPLAY_NAMES[role] ?? role.charAt(0).toUpperCase() + role.slice(1);

const COUNTRY_CODES =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW".split(" ");


export const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

export const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
  a.name.localeCompare(b.name)
);

// GET /games/:id — a ProfileGame plus the players' flairs
export type SharedGame = ProfileGame & { whiteFlair: string | null; blackFlair: string | null };

// Turn a stored result ("Black Resigns: 1-0", "Checkmate: 0-1", "Agreement: 1/2-1/2", ...) into
// the winner, a headline and the reason, e.g. { winner: "white", headline: "White wins", reason: "Black resigned" }
export type ResultSummary = { winner: "white" | "black" | null; score: string; headline: string; reason: string };

export const summarizeResult = (result: string): ResultSummary => {
  const score = result.endsWith("1/2-1/2") ? "1/2-1/2" : result.endsWith("1-0") ? "1-0" : result.endsWith("0-1") ? "0-1" : "*";
  const winner = score === "1-0" ? "white" : score === "0-1" ? "black" : null;
  const kind = result.split(":")[0].trim().toLowerCase();

  let reason: string;
  if (kind.includes("resign")) reason = kind.startsWith("white") ? "White resigned" : "Black resigned";
  else if (kind.includes("flag")) reason = kind.startsWith("white") ? "White ran out of time" : "Black ran out of time";
  else if (kind.startsWith("checkmate")) reason = "Checkmate";
  else if (kind.startsWith("stalemate")) reason = "Stalemate";
  else if (kind.startsWith("agreement")) reason = "Draw by agreement";
  else if (kind.startsWith("insufficient")) reason = "Insufficient material";
  else reason = kind.charAt(0).toUpperCase() + kind.slice(1);

  const headline = winner === "white" ? "White wins" : winner === "black" ? "Black wins" : "Draw";
  return { winner, score, headline, reason };
};
