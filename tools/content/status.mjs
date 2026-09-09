// Puzzle authoring progress, derived from git rather than a checklist.
//
//   node tools/content/status.mjs
//
// The commit that first added a puzzle file is when it was authored. Nothing to
// log, nothing to forget, nothing to fudge.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readMarkdownDir, FAIRY } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUZZLES = path.join(ROOT, 'content', 'puzzles');

const WEEKLY_MIN = Number(process.env.WEEKLY_MIN ?? 3);
const WEEKLY_GOAL = Number(process.env.WEEKLY_GOAL ?? 5);
const TARGET = Number(process.env.TARGET ?? 70);

const C = process.stdout.isTTY
  ? { dim: s => `\x1b[2m${s}\x1b[0m`, b: s => `\x1b[1m${s}\x1b[0m`,
      g: s => `\x1b[32m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m` }
  : { dim: s => s, b: s => s, g: s => s, y: s => s, r: s => s };

/** Monday-based ISO week key, e.g. 2026-W37. */
function weekKey(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const git = args => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return ''; }
};

/** When a file was first committed, or null if it isn't committed yet. */
function addedAt(file) {
  const rel = path.relative(ROOT, file);
  const out = git(['log', '--diff-filter=A', '--follow', '--format=%aI', '--', rel]);
  if (!out) return null;
  const lines = out.split('\n').filter(Boolean);
  return new Date(lines[lines.length - 1]);
}

const files = readMarkdownDir(PUZZLES);
if (!files.length) {
  console.log(`\n  No puzzles yet in ${path.relative(ROOT, PUZZLES)}\n`);
  process.exit(0);
}

const published = files.filter(f => (f.fm.status ?? 'draft') !== 'draft');
const drafts = files.filter(f => (f.fm.status ?? 'draft') === 'draft');

/* ---------- weekly history ---------- */

const byWeek = new Map();
let uncommitted = 0;
for (const f of files) {
  const when = addedAt(path.join(PUZZLES, f.file));
  if (!when) { uncommitted++; continue; }
  const k = weekKey(when);
  byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
}

const thisWeek = weekKey(new Date());
const thisWeekCount = byWeek.get(thisWeek) ?? 0;

// streak of consecutive weeks (ending last week) that met the minimum
const weeksBack = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 7 * n); return weekKey(d); };
let streak = 0;
if (thisWeekCount >= WEEKLY_MIN) streak++;
for (let i = 1; i < 260; i++) {
  if ((byWeek.get(weeksBack(i)) ?? 0) >= WEEKLY_MIN) streak++;
  else break;
}

const activeWeeks = [...byWeek.keys()].length;
const pace = activeWeeks ? (files.length - uncommitted) / activeWeeks : 0;
const remaining = Math.max(0, TARGET - published.length);
const eta = pace > 0 ? Math.ceil(remaining / pace) : null;

/* ---------- coverage ---------- */

const roles = [...new Set(Object.values(FAIRY))];
const counts = new Map(roles.map(r => [r, 0]));
for (const f of published) {
  for (const t of String(f.fm.teaches ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
}

/* ---------- render ---------- */

const bar = (n, max, w = 10) => {
  const filled = Math.max(0, Math.min(w, Math.round((n / max) * w)));
  return '█'.repeat(filled) + C.dim('░'.repeat(w - filled));
};

const pad = (s, n) => String(s).padEnd(n);

console.log('');
console.log(`  ${C.b('Puzzles')}      ${published.length} published` +
            (drafts.length ? C.dim(` · ${drafts.length} draft`) : '') +
            C.dim(`      target ${TARGET}`));

const weekColor = thisWeekCount >= WEEKLY_GOAL ? C.g : thisWeekCount >= WEEKLY_MIN ? C.y : C.r;
console.log(`  ${C.b('This week')}    ${bar(thisWeekCount, WEEKLY_GOAL, 5)}  ${weekColor(`${thisWeekCount} / ${WEEKLY_GOAL}`)}` +
            (thisWeekCount < WEEKLY_MIN ? C.dim(`   ${WEEKLY_MIN - thisWeekCount} more to hit pace`) : ''));

console.log(`  ${C.b('Streak')}       ${streak} week${streak === 1 ? '' : 's'} at ${WEEKLY_MIN}+`);
console.log(`  ${C.b('Pace')}         ${pace.toFixed(1)} / wk` +
            (eta !== null && remaining ? C.dim(`   ${remaining} to go → ~${eta} weeks`) : ''));
if (uncommitted) console.log(`  ${C.dim(`${uncommitted} file(s) not committed yet — commit to count them`)}`);

console.log('');
console.log(`  ${C.b('Coverage')}`);
const maxCount = Math.max(1, ...counts.values());
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [role, n] of sorted) {
  const thin = n < 2;
  const line = `    ${pad(role, 14)} ${bar(n, maxCount, 8)} ${String(n).padStart(2)}`;
  console.log(thin ? C.dim(line) + (n === 0 ? C.r('  ←') : C.y('  ←')) : line);
}

const gaps = sorted.filter(([, n]) => n === 0).map(([r]) => r);
console.log('');
if (gaps.length) console.log(`  ${C.b('Next')}         nothing yet for ${gaps.slice(0, 4).join(', ')}`);
else console.log(`  ${C.b('Next')}         every piece has coverage — go deeper on the thin ones`);
console.log('');
