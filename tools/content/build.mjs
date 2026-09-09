// Compile content/*.md into the JSON the app already consumes.
//
//   node tools/content/build.mjs          write src/assets/{puzzles,lessons}.json
//   node tools/content/build.mjs --check  compare against what's on disk, exit 1 on drift
//
// --check is the CI gate: it proves the Markdown is still the faithful source
// of the shipped JSON, so the two can never quietly diverge.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMarkdownDir, uciToSteps, splitSteps, parseStep, sideToMove } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'src', 'assets');
const CHECK = process.argv.includes('--check');

const errors = [];

/* ---------- puzzles ---------- */

const puzzles = readMarkdownDir(path.join(CONTENT, 'puzzles'))
  .filter(f => (f.fm.status ?? 'draft') !== 'draft')
  .sort((a, b) => (a.fm.order ?? 1e9) - (b.fm.order ?? 1e9))
  .map(f => {
    try {
      const fen = f.fm.fen ?? '';
      const first = sideToMove(fen);
      return {
        initialFen: fen,
        ...(f.fm.orientation ? { orientation: f.fm.orientation } : {}),
        steps: uciToSteps(f.fm.line, first),
        alt_steps: f.fm.alt ? uciToSteps(f.fm.alt, first) : [],
        label: f.fm.label ?? '',
      };
    } catch (e) {
      errors.push(`puzzles/${f.file}: ${e.message}`);
      return null;
    }
  })
  .filter(Boolean);

/* ---------- lessons ---------- */

const lessonFiles = readMarkdownDir(path.join(CONTENT, 'lessons'))
  .sort((a, b) => (a.fm.order ?? 1e9) - (b.fm.order ?? 1e9));

const lessons = {};
for (const f of lessonFiles) {
  try {
    // every lesson carries a quote key, empty or not
    const lesson = { title: f.fm.title ?? f.id, quote: f.fm.quote ?? '' };
    // Key order matches the hand-written JSON: text, image, challenge, note.
    lesson.steps = splitSteps(f.body).map(parseStep).map(s => {
      const out = { text: s.text ?? '' };
      if (s.image) out.image = s.image;
      if (s.challenge) out.challenge = s.challenge;
      if (s.note) out.note = s.note;
      return out;
    });
    lessons[f.fm.id ?? f.id] = lesson;
  } catch (e) {
    errors.push(`lessons/${f.file}: ${e.message}`);
  }
}

if (errors.length) {
  console.error('\ncontent build failed:');
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

/* ---------- emit or check ---------- */

const targets = [
  ['puzzles.json', puzzles],
  ['lessons.json', lessons],
];

let drift = 0;
for (const [name, data] of targets) {
  const file = path.join(OUT, name);
  const next = JSON.stringify(data, null, 2) + '\n';

  if (!CHECK) {
    fs.writeFileSync(file, next);
    const n = Array.isArray(data) ? data.length : Object.keys(data).length;
    console.log(`  wrote src/assets/${name}  (${n} entries)`);
    continue;
  }

  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  // compare semantically — formatting of the committed file shouldn't matter
  const same = current && JSON.stringify(JSON.parse(current)) === JSON.stringify(data);
  console.log(`  ${same ? 'ok  ' : 'DRIFT'} src/assets/${name}`);
  if (!same) drift++;
}

if (CHECK && drift) {
  console.error('\n  Markdown and JSON disagree. Run: npm run content:build\n');
  process.exit(1);
}
if (CHECK) console.log('\n  content is in sync\n');
