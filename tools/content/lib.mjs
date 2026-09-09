// Shared parsing for the Markdown authoring format.
//
// Authoring lives in content/ as Markdown; the app keeps consuming the JSON in
// src/assets/. tools/content/build.mjs compiles one into the other, so the
// runtime shape never has to change.
//
// Puzzle file:
//   ---
//   id: painter-pin-01
//   teaches: painter
//   fen: "..."
//   line: f4h6 h8g8 e2c4
//   ---
//   Free prose. Author-side notes, not shipped (yet).
//
// Lesson file: same frontmatter idea, body split into steps by a line of `---`.
// Inside a step:
//   @note   one-line prompt shown with the challenge
//   @image  one path
//   ```challenge
//   fen: "..."
//   line: d5d6 c7c6
//   alt: e2e4 e7e5        (repeatable)
//   ```
// Everything else in the step is its prose.

import fs from 'node:fs';
import path from 'node:path';

/* ---------- frontmatter ---------- */

const scalar = raw => {
  const v = raw.trim();
  if (!v) return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"');
  }
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v;
};

export function parseFrontmatter(text) {
  const src = text.replace(/^﻿/, '');
  if (!src.startsWith('---')) return { fm: {}, body: src.trim() };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, body: src.trim() };
  const head = src.slice(3, end).trim();
  const body = src.slice(end + 4).replace(/^\r?\n/, '');
  const fm = {};
  for (const line of head.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k in fm) fm[k] = [].concat(fm[k], scalar(v));
    else fm[k] = scalar(v);
  }
  return { fm, body: body.trimEnd() };
}

const needsQuote = v =>
  typeof v === 'string' && (/^\s|\s$|^["'\[{]|:\s|^$/.test(v) || /[#]/.test(v));

export function serializeFrontmatter(fm) {
  const lines = [];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null) continue;
    for (const one of [].concat(v)) {
      lines.push(`${k}: ${needsQuote(one) ? JSON.stringify(one) : one}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n`;
}

/* ---------- moves ---------- */

const UCI = /^[a-h][1-8][a-h][1-8][a-z]?$/;

// Promotion role <-> FEN letter, matching the chessground fork's fen.ts.
export const PROMO_LETTER = {
  queen: 'q', rook: 'r', bishop: 'b', knight: 'n', king: 'k', pawn: 'p',
  champion: 'c', princess: 'i', amazon: 'a', mann: 'm', painter: 'y',
  snare: 's', wizard: 'w', archer: 'x', royalpainter: 'o', rollingsnare: 'l',
  centaur: 'u', general: 'g',
};
const PROMO_ROLE = Object.fromEntries(Object.entries(PROMO_LETTER).map(([r, l]) => [l, r]));

/**
 * "f4h6 h8g8 e2c4" -> [{white:{from,to}, black:{from,to}}, {white:{...}}]
 * `first` is the side that moves first; for a black-to-move position the pairs
 * are emitted as {black, white} in that key order, matching the existing JSON.
 */
export function uciToSteps(line, first = 'white') {
  const toks = String(line || '').trim().split(/\s+/).filter(Boolean);
  const bad = toks.filter(t => !UCI.test(t));
  if (bad.length) throw new Error(`bad move token(s): ${bad.join(' ')}`);
  const sq = t => {
    const m = { from: t.slice(0, 2), to: t.slice(2, 4) };
    if (t.length === 5) {
      const role = PROMO_ROLE[t[4]];
      if (!role) throw new Error(`unknown promotion letter '${t[4]}' in ${t}`);
      m.promotion = role;
    }
    return m;
  };
  const second = first === 'white' ? 'black' : 'white';
  const steps = [];
  for (let i = 0; i < toks.length; i += 2) {
    const step = { [first]: sq(toks[i]) };
    if (toks[i + 1]) step[second] = sq(toks[i + 1]);
    steps.push(step);
  }
  return steps;
}

/** Side to move from a FEN, defaulting to white. */
export const sideToMove = fen => (String(fen).split(/\s+/)[1] === 'b' ? 'black' : 'white');

/** Inverse of uciToSteps. */
export function stepsToUci(steps) {
  const enc = m => {
    if (!m) return null;
    const p = m.promotion ? PROMO_LETTER[m.promotion] : '';
    if (m.promotion && !p) throw new Error(`unknown promotion role '${m.promotion}'`);
    return m.from + m.to + p;
  };
  const out = [];
  for (const s of Array.isArray(steps) ? steps : []) {
    for (const side of Object.keys(s)) {
      const m = enc(s[side]);
      if (m) out.push(m);
    }
  }
  return out.join(' ');
}

/* ---------- lesson step bodies ---------- */

/** Split a lesson body into raw step chunks on lines that are exactly `---`. */
export function splitSteps(body) {
  return body
    .split(/\n---[ \t]*(?=\n|$)/)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseChallengeBlock(inner) {
  let initialFen = '';
  const raw = {};
  for (const ln of inner.split('\n')) {
    const m = ln.match(/^(fen|line|alt):\s?(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'fen') initialFen = scalar(v);
    else if (k === 'line') raw.line = v;
    else raw.alt = v;
  }
  const first = sideToMove(initialFen);
  // key order matches the hand-written JSON, and alt_steps is omitted when unused
  const out = { initialFen, steps: raw.line !== undefined ? uciToSteps(raw.line, first) : [] };
  if (raw.alt !== undefined) out.alt_steps = uciToSteps(raw.alt, first);
  return out;
}

/** Parse one step chunk into {text, note?, image?, challenge?}. */
export function parseStep(chunk) {
  const step = {};
  let rest = chunk;

  const fence = rest.match(/```challenge\n([\s\S]*?)```/);
  if (fence) {
    step.challenge = parseChallengeBlock(fence[1]);
    rest = rest.replace(fence[0], '').trim();
  }

  // A ```text block holds prose whose leading/trailing whitespace is significant
  // (e.g. the two trailing spaces that mean a hard line break in Markdown).
  // Ordinary steps don't need it — their prose is just written plainly.
  const verbatim = rest.match(/```text\n([\s\S]*?)\n?```/);
  if (verbatim) {
    step.text = verbatim[1];
    rest = rest.replace(verbatim[0], '').trim();
    for (const line of rest.split('\n')) {
      const m = line.match(/^@(note|image)\s+(.*)$/);
      if (m) step[m[1]] = m[2].trim();
    }
    return step;
  }

  const lines = [];
  for (const line of rest.split('\n')) {
    const m = line.match(/^@(note|image)\s+(.*)$/);
    if (m) step[m[1]] = m[2].trim();
    else lines.push(line);
  }
  step.text = lines.join('\n').trim();
  return step;
}

/** Render a step object back to a markdown chunk. */
export function formatStep(step) {
  const parts = [];
  if (step.image) parts.push(`@image ${step.image}`);
  if (step.note) parts.push(`@note ${step.note}`);
  if (parts.length) parts.push('');
  if (step.text) {
    // preserve significant edge whitespace verbatim
    if (/^\s|\s$/.test(step.text)) parts.push('```text', step.text, '```', '');
    else parts.push(step.text, '');
  }
  if (step.challenge) {
    const c = step.challenge;
    const inner = [`fen: ${JSON.stringify(c.initialFen)}`, `line: ${stepsToUci(c.steps)}`];
    const alt = stepsToUci(c.alt_steps);
    if (alt) inner.push(`alt: ${alt}`);
    parts.push('```challenge', ...inner, '```');
  }
  return parts.join('\n').trim();
}

/* ---------- fs helpers ---------- */

export const readMarkdownDir = dir =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md').sort()
        .map(f => ({ file: f, id: f.replace(/\.md$/, ''), ...parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8')) }))
    : [];

/** Fairy piece letters -> role, for inferring what a position teaches. */
export const FAIRY = {
  c: 'champion', i: 'princess', a: 'amazon', m: 'mann', y: 'painter',
  s: 'snare', w: 'wizard', x: 'archer', o: 'royalpainter', l: 'rollingsnare',
  u: 'centaur', g: 'general',
};

export function fairyPiecesIn(fen) {
  const placement = String(fen).split(' ')[0] || '';
  const found = new Set();
  for (const ch of placement) {
    const role = FAIRY[ch.toLowerCase()];
    if (role) found.add(role);
  }
  return [...found];
}
