// Self-play legality fuzz: engine plays random armies; every move must pass chessops isLegal.
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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseFen, makeFen } from 'chessops/fen';
import { Chess } from 'chessops/chess';
import { makeSquare, parseUci, makeUci } from 'chessops/util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const ENGINE_DIR = process.env.ENGINE_DIR ?? path.join(ROOT, 'public');
const VARIANTS = process.env.VARIANTS ?? path.join(ENGINE_DIR, 'variants.ini');
const VARIANT = 'tokenvariant';
const require = createRequire(import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GAMES = +(process.env.GAMES ?? 20), PLIES = +(process.env.PLIES ?? 80), DEPTH = +(process.env.DEPTH ?? 3);

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
    async bestmove(fen, depth) {
      buf = [];
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage(`go depth ${depth}`);
      for (let i = 0; i < 2000; i++) {
        await sleep(10);
        const l = buf.find(x => x.startsWith('bestmove'));
        if (l) return l.split(/\s+/)[1];
      }
      return null;
    },
    async perft1(fen) {
      buf = [];
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage('go perft 1');
      for (let i = 0; i < 200; i++) {
        await sleep(25);
        if (buf.some(l => /Nodes searched/i.test(l))) break;
      }
      await sleep(20);
      this.raw = buf.map(l => l.trim()).filter(l => /^[a-h][1-8][a-h][1-8]/.test(l)).map(l => l.split(/[:\s]/)[0]).sort();
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


// tiny seeded RNG so failures reproduce
let seed = +(process.env.SEED ?? 1);
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];

function randomArmy() {
  const pool = (process.env.POOL ?? 'nbrqciamywsx').split('');
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'].map((c, i) => (c === 'k' || rnd() < 0.5) ? c : pick(pool));
  const pawns = Array.from({ length: 8 }, () => pick(['p', 'p', 'p', 'y', 's']));
  const rank = (cs, up) => cs.map(c => up ? c.toUpperCase() : c).join('');
  const kRoyal = side => (rnd() < 0.3 ? 'g' : 'k');
  const wb = back.slice(); wb[4] = kRoyal();
  const bb = back.slice(); bb[4] = kRoyal();
  return `${rank(bb, false)}/${rank(pawns, false)}/8/8/8/8/${rank(pawns, true)}/${rank(wb, true)} w - - 0 1`;
}

// SPARSE=1: few pieces, wizards on their far rank next to p/s/y — exercises swap promotions
function sparseArmy() {
  const board = Array.from({ length: 64 }, () => null);
  const put = (c, sq) => { if (!board[sq]) { board[sq] = c; return true; } return false; };
  const empty = () => { for (;;) { const sq = Math.floor(rnd() * 64); if (!board[sq]) return sq; } };
  for (const white of [true, false]) {
    const up = c => white ? c.toUpperCase() : c;
    const far = white ? 7 : 0;
    put(up(rnd() < 0.3 ? 'g' : 'k'), (white ? Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 3)) * 8 + Math.floor(rnd() * 8));
    for (let w = 0; w < 1 + Math.floor(rnd() * 2); w++) put(up('w'), far * 8 + Math.floor(rnd() * 8));
    for (let i = 0; i < 2 + Math.floor(rnd() * 4); i++) {
      const rk = white ? 3 + Math.floor(rnd() * 5) : Math.floor(rnd() * 5);
      put(up(pick(['p', 's', 'y', 's'])), Math.min(7, Math.max(0, rk)) * 8 + Math.floor(rnd() * 8));
    }
    for (let i = 0; i < Math.floor(rnd() * 3); i++) put(up(pick('nbrqcx'.split(''))), empty());
  }
  let out = '';
  for (let r = 7; r >= 0; r--) {
    let run = 0;
    for (let f = 0; f < 8; f++) { const c = board[r * 8 + f]; if (c) { if (run) out += run; run = 0; out += c; } else run++; }
    if (run) out += run;
    if (r) out += '/';
  }
  return `${out} ${rnd() < 0.5 ? 'w' : 'b'} - - 0 1`;
}

const engine = await startEngine();
const failures = [];
let totalPlies = 0, patched = 0, replayBreaks = 0;
for (let g = 0; g < GAMES; g++) {
  let fen = process.env.SPARSE ? sparseArmy() : randomArmy();
  const setup = parseFen(fen);
  const first = setup.isOk ? Chess.fromSetup(setup.value) : null;
  if (!first || first.isErr) { g--; continue; }
  const pos = first.value;
  const history = [];
  for (let ply = 0; ply < PLIES; ply++) {
    if (pos.isEnd()) break;
    const uci = await engine.bestmove(makeFen(pos.toSetup()), DEPTH);
    if (!uci || uci === '(none)') break;
    let mv = parseUci(uci);
    // mirror ComputerGamePage.applyEngineMove: the engine omits the promotion letter on
    // wizard back-rank swaps, so the app fills it in (colour-aware: white rank 8, black rank 1)
    if (mv && 'from' in mv && !mv.promotion) {
      const mp = pos.board.get(mv.from), dp = pos.board.get(mv.to);
      if (mp?.role === 'wizard' && dp && dp.color === pos.turn &&
          ['pawn', 'painter', 'snare'].includes(dp.role) &&
          (mv.from >> 3) === (mp.color === 'white' ? 7 : 0)) {
        mv.promotion = { pawn: 'queen', painter: 'royalpainter', snare: 'rollingsnare' }[dp.role];
        patched++;
      }
    }
    if (!mv || !pos.isLegal(mv)) {
      failures.push({ game: g, ply, start: fen, history: history.join(' '), uci, fen: makeFen(pos.toSetup()) });
      break;
    }
    pos.play(mv);
    history.push(makeUci(mv));
    totalPlies++;
  }
  // replay exactly as AnalysisBoard does: parseUci + isLegal from the start position
  const rp = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  for (let i = 0; i < history.length; i++) {
    const m = parseUci(history[i]);
    if (!m || !rp.isLegal(m)) { replayBreaks++; failures.push({ game: g, replayBreakAt: i, of: history.length, move: history[i], start: fen, history: history.join(' ') }); break; }
    rp.play(m);
  }
}
console.log(`${GAMES} games, ${totalPlies} plies, ${failures.length} failures (${patched} wizard promotions auto-filled, ${replayBreaks} replay breaks)`);
for (const f of failures) console.log(JSON.stringify(f, null, 1));
process.exit(failures.length ? 1 : 0);
