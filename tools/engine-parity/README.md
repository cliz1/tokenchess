# Engine parity check

Token Chess has **two independent rules implementations**:

- the **chessops fork** (`github:cliz1/chessops`) — what the app plays by
- the **Fairy-Stockfish build** in `public/` — what the computer opponent plays by

If they disagree, the engine will play or accept moves the app considers illegal.
This script asserts they don't, by comparing legal move generation across a corpus
of fairy-piece positions.

```bash
npm test                          # 27/27 agree, exit 0
node tools/engine-parity/parity.mjs
```

Exits non-zero on any divergence, so it works as a CI gate.

## Why this exists

`public/stockfish.wasm` is a **hand-compiled Fairy-Stockfish at commit `f975ce61`**.
It is *not* the `fairy-stockfish-nnue.wasm` package listed in `package.json`, which is
commit `5589ea54`. The two are not interchangeable — the npm build has weaker custom
piece support and diverges on **8 of the 27 positions here**, silently missing Painter
and Wizard moves:

```
ENGINE_DIR=node_modules/fairy-stockfish-nnue.wasm VARIANTS=public/variants.ini \
  node tools/engine-parity/parity.mjs
# → 19/27 agree, 8 divergent
```

That is the failure mode this guards against: a rules divergence that produces wrong
play rather than a crash. It is also the natural enforcement point for rules changes —
when a piece changes in the chessops fork, this tells you the engine needs rebuilding
to match.

## Options

| Env | Default | Purpose |
|---|---|---|
| `ENGINE_DIR` | `public/` | directory with `stockfish.js` / `.wasm` / `.worker.js` |
| `VARIANTS` | `<ENGINE_DIR>/variants.ini` | variant definition |
| `FENS` | `./fens.txt` | position corpus |
| `VARIANT` | `tokenvariant` | `UCI_Variant` name |
| `VERBOSE` | — | `1` prints per-position results |

## The corpus

`fens.txt` — mostly lifted from `src/fens.txt`, the hand-built fairy piece test cases,
plus standard and dense positions. Add a line whenever you add or change a piece.

Every position must be **legal**. An illegal one fails chessops' setup validation
rather than move generation, which is a false alarm rather than a finding.

## Notes

- The engine reports through `addMessageListener`; its `print` option is ignored.
- `stockfish.js` is CommonJS but this repo is `"type": "module"`, so the script loads
  it from a scratch directory declaring `commonjs`. Only the small JS files are copied —
  the wasm is passed as a buffer.
- Comparison is on from→to pairs. Promotion suffixes are stripped, since `allDests()`
  doesn't enumerate promotion pieces either.
