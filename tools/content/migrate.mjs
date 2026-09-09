// One-time migration: src/assets/{puzzles,lessons}.json -> content/*.md
//
//   node tools/content/migrate.mjs
//
// Safe to re-run: it refuses to overwrite existing files unless FORCE=1.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeFrontmatter, stepsToUci, formatStep, fairyPiecesIn } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'src', 'assets');
const OUT = path.join(ROOT, 'content');
const FORCE = process.env.FORCE === '1';

const write = (file, text) => {
  if (fs.existsSync(file) && !FORCE) { console.log(`  skip (exists) ${path.relative(ROOT, file)}`); return false; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`  ${path.relative(ROOT, file)}`);
  return true;
};

const slug = s => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- puzzles ---------- */

const puzzles = JSON.parse(fs.readFileSync(path.join(SRC, 'puzzles.json'), 'utf8'));
console.log(`\npuzzles (${puzzles.length})`);

puzzles.forEach((p, i) => {
  const pieces = fairyPiecesIn(p.initialFen);
  const teaches = pieces[0] ?? 'tactics';
  const id = `${teaches}-${String(i + 1).padStart(2, '0')}`;
  const fm = {
    id,
    order: i + 1,
    teaches: pieces.length ? pieces.join(', ') : 'tactics',
    difficulty: '',
    status: 'published',
    fen: p.initialFen,
    ...(p.orientation ? { orientation: p.orientation } : {}),
    line: stepsToUci(p.steps),
    ...(p.label ? { label: p.label } : {}),
  };
  const alt = stepsToUci(p.alt_steps);
  if (alt) fm.alt = alt;

  const body = [
    `<!-- Author's note: what this puzzle teaches, why the natural move fails.`,
    `     Not shipped yet — see tools/content/README.md. -->`,
    '',
    `Teaches: **${fm.teaches}**.`,
  ].join('\n');

  write(path.join(OUT, 'puzzles', `${id}.md`), serializeFrontmatter(fm) + '\n' + body + '\n');
});

/* ---------- lessons ---------- */

const lessons = JSON.parse(fs.readFileSync(path.join(SRC, 'lessons.json'), 'utf8'));
console.log(`\nlessons (${Object.keys(lessons).length})`);

Object.entries(lessons).forEach(([key, lesson], i) => {
  const fm = {
    id: key,
    order: i + 1,
    title: lesson.title ?? key,
    quote: lesson.quote ?? '',
  };
  const body = (lesson.steps ?? []).map(formatStep).join('\n\n---\n\n');
  write(path.join(OUT, 'lessons', `${slug(key)}.md`), serializeFrontmatter(fm) + '\n' + body + '\n');
});

console.log('\nNext: node tools/content/build.mjs --check');
