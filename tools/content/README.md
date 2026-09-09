# Content authoring

Puzzles and lessons are authored as **Markdown** in `content/` and compiled into the
**JSON** the app already consumes in `src/assets/`. The runtime shape is unchanged —
no app code had to move for this.

The point is ergonomic: prose belongs in Markdown, not in JSON string literals with
escaped newlines. A solution is one line of UCI instead of thirty lines of nested
`{white: {from, to}}`.

```bash
npm run puzzles          # progress: pace, streak, coverage
npm run content:build    # content/*.md  ->  src/assets/*.json
npm run content:check    # verify they agree (CI gate)
npm run content:verify   # replay every solution through the rules engine
```

## Writing a puzzle

`content/puzzles/<id>.md`:

```markdown
---
id: painter-pin-01
order: 6
teaches: painter
difficulty: 2
status: draft
fen: "2k5/8/8/6b1/8/2n5/3Y4/2K5 w - - 0 1"
line: d2c3 c8c7 c3b4
---

The instinct is to trade the Painter off. That loses, because it's the only
piece that can convert c3 without giving Black a tempo to defend.
```

- **`line`** — the solution as space-separated UCI, alternating sides starting with
  whoever is to move in the FEN. Promotions get a piece letter: `a7a8q`.
- **`alt`** — an optional alternative accepted line, same format.
- **`status`** — `draft` puzzles are excluded from the build, so you can commit
  work-in-progress without shipping it.
- **`order`** — position in `puzzles.json`.
- The **body** is your note. Not shipped yet; to ship it, add it to the emitted
  object in `build.mjs` and read it in the puzzle UI.

## Writing a lesson

`content/lessons/<id>.md`. Frontmatter carries `id`, `order`, `title`, `quote`.
The body is split into steps by a line containing only `---`.

Inside a step:

| Syntax | Meaning |
|---|---|
| plain prose | the step's `text` |
| `@image /images/foo.png` | illustration |
| `@note White to move, mate in two.` | prompt shown with the challenge |
| ` ```challenge ` block | interactive position |

```markdown
@note White to move and win.

The Painter cannot capture, so the rook is not actually defended.

```challenge
fen: "8/8/YK6/8/8/8/6kp/8 w - - 0 1"
line: a6a7 h2h1q a7a8q
alt: a6a7 h2h1q a7a8b
```
```

A ` ```text ` block is also supported, for prose whose leading or trailing whitespace
is significant — such as the two trailing spaces that mean a hard line break in
Markdown. Ordinary steps don't need it and shouldn't use it.

## Guarantees

`content:check` proves the Markdown still compiles to exactly the JSON on disk, so
the two can never quietly diverge. It passed byte-for-byte across all 5 puzzles and
21 lessons at migration, including black-to-move move ordering, promotions, empty
quotes, and significant whitespace.

`content:verify` replays every solution through the chessops fork — the same authority
the app plays by — and fails on typos, illegal moves, and stale FENs. It found three
real problems in the existing lessons on its first run (fairy pieces promoting on the
back rank without a promotion piece named).

## Migration

`migrate.mjs` did the one-time JSON → Markdown conversion. It's kept for reference and
refuses to overwrite existing files unless `FORCE=1`. You shouldn't need it again.
