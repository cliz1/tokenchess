// Move-generation parity: chessops fork vs Fairy-Stockfish.
//
// Token Chess has two independent rules implementations — the chessops fork used
// by the app, and the Fairy-Stockfish build used for computer play. If they ever
// disagree, the engine will play or accept moves the app considers illegal.
// This asserts they don't.
//
//   node tools/engine-parity/parity.mjs
//
// Env overrides:
//   ENGINE_DIR   directory holding stockfish.js/.wasm/.worker.js  (default: public/)
//   VARIANTS     path to variants.ini                             (default: <ENGINE_DIR>/variants.ini)
//   FENS         path to the position corpus                      (default: ./fens.txt)
//   VARIANT      UCI_Variant name                                 (default: tokenvariant)
//   VERBOSE      set to 1 to print per-position move lists
//
// Exits non-zero on any divergence, so it works as a CI gate.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { parseFen } from 'chessops/fen';
import { Chess } from 'chessops/chess';
import { makeSquare } from 'chessops/util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const ENGINE_DIR = process.env.ENGINE_DIR ?? path.join(ROOT, 'public');
const VARIANTS = process.env.VARIANTS ?? path.join(ENGINE_DIR, 'variants.ini');
const FENS = process.env.FENS ?? path.join(HERE, 'fens.txt');
const VARIANT = process.env.VARIANT ?? 'tokenvariant';
const VERBOSE = process.env.VERBOSE === '1';

const require = createRequire(import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Legal from→to pairs according to the chessops fork. */
function chessopsMoves(fen) {
  const setup = parseFen(fen);
  if (setup.isErr) return { err: `fen: ${setup.error.message}` };
  const pos = Chess.fromSetup(setup.value);
  if (pos.isErr) return { err: `position: ${pos.error.message}` };
  const moves = new Set();
  for (const [from, dests] of pos.value.allDests()) {
    for (const to of dests) moves.add(makeSquare(from) + makeSquare(to));
  }
  return { moves: [...moves].sort() };
}

/** Boot the engine and return a `perft1(fen)` helper. */
async function startEngine() {
  const jsPath = path.join(ENGINE_DIR, 'stockfish.js');
  const wasmPath = path.join(ENGINE_DIR, 'stockfish.wasm');
  for (const p of [jsPath, wasmPath, VARIANTS]) {
    if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
  }

  // stockfish.js is a CommonJS UMD bundle, but this repo is "type": "module",
  // so node refuses to require() it from inside the project. Load it from a
  // scratch dir that declares commonjs. Only the small JS files are copied —
  // the wasm is handed over as a buffer, so nothing large is duplicated.
  const shim = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-engine-'));
  fs.writeFileSync(path.join(shim, 'package.json'), '{"type":"commonjs"}');
  fs.copyFileSync(jsPath, path.join(shim, 'stockfish.js'));
  const workerPath = path.join(ENGINE_DIR, 'stockfish.worker.js');
  if (fs.existsSync(workerPath)) {
    fs.copyFileSync(workerPath, path.join(shim, 'stockfish.worker.js'));
  }
  process.on('exit', () => fs.rmSync(shim, { recursive: true, force: true }));

  const Stockfish = require(path.join(shim, 'stockfish.js'));
  const wasmBinary = fs.readFileSync(wasmPath);

  let buf = [];
  // This build reports through addMessageListener; `print` is ignored.
  const sf = await Stockfish({
    wasmBinary,
    locateFile: f => path.join(shim, f),
    print: () => {},
    printErr: () => {},
  });
  sf.addMessageListener?.(line => buf.push(String(line)));

  sf.FS.writeFile('/variants.ini', fs.readFileSync(VARIANTS));
  for (const cmd of [
    'setoption name VariantPath value /variants.ini',
    'setoption name Threads value 1',
    `setoption name UCI_Variant value ${VARIANT}`,
  ]) sf.postMessage(cmd);
  await sleep(300);

  const banner = buf.find(l => l.startsWith('Fairy-Stockfish')) ?? '(no banner)';

  return {
    banner,
    async perft1(fen) {
      buf = [];
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage('go perft 1');
      for (let i = 0; i < 200; i++) {
        await sleep(25);
        if (buf.some(l => /Nodes searched/i.test(l))) break;
      }
      await sleep(20);
      const moves = new Set(
        buf
          .map(l => l.trim())
          .filter(l => /^[a-h][1-8][a-h][1-8]/.test(l))
          .map(l => l.split(/[:\s]/)[0].slice(0, 4)),
      );
      return [...moves].sort();
    },
  };
}

const fens = fs.readFileSync(FENS, 'utf8').split('\n').map(s => s.trim())
  .filter(l => l && !l.startsWith('#'));

const engine = await startEngine();

console.log(`\nMove-generation parity — chessops fork vs Fairy-Stockfish`);
console.log(`  engine   ${engine.banner.replace(/ LB by.*$/, '')}`);
console.log(`  variant  ${VARIANT}`);
console.log(`  corpus   ${fens.length} positions from ${path.relative(ROOT, FENS)}\n`);

let agree = 0;
const failures = [];

for (const fen of fens) {
  const co = chessopsMoves(fen);
  if (co.err) { failures.push({ fen, msg: `chessops error — ${co.err}` }); continue; }

  const sfMoves = await engine.perft1(fen);
  const A = new Set(sfMoves), B = new Set(co.moves);
  const engineOnly = sfMoves.filter(m => !B.has(m));
  const chessopsOnly = co.moves.filter(m => !A.has(m));

  if (!engineOnly.length && !chessopsOnly.length) {
    agree++;
    if (VERBOSE) console.log(`  ok   ${fen}  [${sfMoves.length}]`);
  } else {
    failures.push({
      fen,
      msg: `engine-only: ${engineOnly.join(',') || '—'}   chessops-only: ${chessopsOnly.join(',') || '—'}`,
    });
  }
}

for (const f of failures) console.log(`  FAIL ${f.fen}\n         ${f.msg}`);

console.log(`\n  ${agree}/${fens.length} agree, ${failures.length} divergent\n`);
process.exit(failures.length ? 1 : 0);
