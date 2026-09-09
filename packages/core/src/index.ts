// Empty scaffold — Phase 2 moves in types, FEN helpers, and the piece-cost
// table currently duplicated in DraftBuilder.getCost() and server/src/index.ts.

// Bumped whenever a rules change (a piece's moves, costs, or the token budget)
// would make an older client or a stored game/draft disagree with this build.
// Every game and draft record gets stamped with the RULES_VERSION it was
// created under, so a mismatch can be detected and handled explicitly instead
// of silently producing illegal or miscosted positions.
export const RULES_VERSION = 1;
