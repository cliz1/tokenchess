// Replay every authored solution through the rules engine.
//
//   node tools/content/verify.mjs
//
// Catches the failure mode that matters when hand-authoring: a solution line
// with a typo, an illegal move, or a stale FEN. Uses the chessops fork — the
// same authority the app plays by — so it's fast and needs no engine boot.
// (tools/engine-parity proves Fairy-Stockfish agrees with chessops, so checking
// against chessops is enough.)
//
// Exits non-zero on any problem, so it works as a CI gate.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFen } from 'chessops/fen';
import { Chess } from 'chessops/chess';
import { parseUci } from 'chessops/util';
import { PROMO_LETTER } from './lib.mjs';

import { readMarkdownDir, splitSteps, parseStep, stepsToUci, sideToMove, uciToSteps } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT = path.join(ROOT, 'content');

const problems = [];
let checked = 0;

/** Replay a UCI line from a FEN; returns an error string or null. */
function replay(fen, line, label) {
  if (!fen) return `${label}: no fen`;
  const setup = parseFen(fen);
  if (setup.isErr) return `${label}: bad fen — ${setup.error.message}`;
  const pos = Chess.fromSetup(setup.value);
  if (pos.isErr) return `${label}: illegal position — ${pos.error.message}`;

  const p = pos.value;
  const moves = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (!moves.length) return `${label}: empty solution line`;

  for (const [i, uci] of moves.entries()) {
    const move = parseUci(uci);
    if (!move) return `${label}: unparseable move '${uci}' (move ${i + 1})`;
    if (!p.isLegal(move)) {
      // A pawn-like move onto the last rank is illegal until it names what it
      // becomes. Say so, rather than reporting a bare "illegal move".
      if (!move.promotion) {
        const promotable = Object.entries(PROMO_LETTER)
          .filter(([role]) => !['king', 'pawn'].includes(role))
          .filter(([role, letter]) => {
            const m = parseUci(uci + letter);
            return m && p.isLegal(m);
          })
          .map(([, letter]) => uci + letter);
        if (promotable.length) {
          return `${label}: '${uci}' (move ${i + 1}) needs a promotion piece — try ${promotable.slice(0, 4).join(' / ')}`;
        }
      }
      return `${label}: illegal move '${uci}' (move ${i + 1}, ${p.turn} to play)`;
    }
    p.play(move);
  }
  return null;
}

/* ---------- puzzles ---------- */

const puzzleFiles = readMarkdownDir(path.join(CONTENT, 'puzzles'));
const ids = new Map();

for (const f of puzzleFiles) {
  const id = f.fm.id ?? f.id;
  if (ids.has(id)) problems.push(`puzzles/${f.file}: duplicate id '${id}' (also ${ids.get(id)})`);
  ids.set(id, f.file);

  if ((f.fm.status ?? 'draft') === 'draft') continue; // drafts may be incomplete

  checked++;
  const err = replay(f.fm.fen, f.fm.line, `puzzles/${f.file}`);
  if (err) problems.push(err);
  if (f.fm.alt) {
    const e2 = replay(f.fm.fen, f.fm.alt, `puzzles/${f.file} (alt)`);
    if (e2) problems.push(e2);
  }
  // the encoded line must survive a round trip through the step form
  const rt = stepsToUci(uciToSteps(f.fm.line, sideToMove(f.fm.fen)));
  if (rt !== String(f.fm.line).trim()) {
    problems.push(`puzzles/${f.file}: line does not round-trip ('${f.fm.line}' -> '${rt}')`);
  }
}

/* ---------- lesson challenges ---------- */

for (const f of readMarkdownDir(path.join(CONTENT, 'lessons'))) {
  splitSteps(f.body).map(parseStep).forEach((step, i) => {
    const c = step.challenge;
    if (!c) return;
    checked++;
    const label = `lessons/${f.file} step ${i + 1}`;
    const err = replay(c.initialFen, stepsToUci(c.steps), label);
    if (err) problems.push(err);
    if (c.alt_steps?.length) {
      const e2 = replay(c.initialFen, stepsToUci(c.alt_steps), `${label} (alt)`);
      if (e2) problems.push(e2);
    }
  });
}

/* ---------- report ---------- */

console.log(`\nContent verification — ${checked} solution lines\n`);
for (const p of problems) console.log(`  FAIL ${p}`);

if (problems.length) {
  console.log(`\n  ${problems.length} problem${problems.length === 1 ? '' : 's'}\n`);
  process.exit(1);
}
console.log(`  all ${checked} solutions replay cleanly\n`);
