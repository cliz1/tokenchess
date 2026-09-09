# Token Chess curriculum

The narrative arc: what a new player learns, in what order, and which puzzles carry
each idea. This is the brainstorming surface — edit it freely. It versions alongside
the puzzles it describes, so the reasoning and the content never drift apart.

Run `npm run puzzles` for live coverage and pace.

---

## The arc

A player arriving from standard chess needs three things, in this order:

1. **Reassurance** — this is still chess. The pieces they know behave the way they expect.
2. **One surprise** — a single fairy piece that rewards thinking, not memorisation.
3. **A reason to draft** — the token budget only becomes interesting once they have
   an opinion about which pieces they like.

Everything after that is depth.

### Stage 1 · Arrival
Standard rules hold. Introduce the board, the notation, the idea of fairy pieces.
Lessons: `welcome`, `standard-rules`, `fairy-chess`, `token-chess`.
*No puzzles needed yet — reading, not solving.*

### Stage 2 · The first fairy piece
Pick **one** piece whose behaviour is startling but instantly graspable. The Painter
is the strongest candidate: it cannot capture, which inverts every instinct a chess
player has, and the "aha" is one move deep.
Target: **6–8 puzzles**, ordered easy → hard.

### Stage 3 · The compound pieces
Champion, Princess, Amazon. These are unions of familiar movement, so they teach
*evaluation* rather than movement — how much is knight+rook actually worth?
Target: **4–6 puzzles each**, at least one about over-valuing them.

### Stage 4 · The awkward pieces
Snare, Wizard, Archer, Mann, Centaur, General. Each has a quirk that punishes
pattern-matching from standard chess. These are where the game gets its identity.
Target: **4–6 puzzles each**.

### Stage 5 · Drafting
Token values, army composition, the horde. Puzzles here are *positional* — "which
of these two drafts is better and why".

---

## Writing puzzles that teach

A puzzle earns its place if it punishes a *specific* misunderstanding. The test:
can you name the wrong move a standard-chess player would make, and say why it loses?
If not, it's a tactics exercise that happens to contain a fairy piece — fine, but not
teaching.

- **One idea per puzzle.** Two ideas means neither lands.
- **Order matters more than volume.** Six well-ordered puzzles beat twenty shuffled.
- **Write the note first.** If the note is hard to write, the puzzle is muddled.
- **The refutation is the content.** The solution shows what works; the note explains
  what doesn't, and that's the part people remember.

---

## Gaps

Kept honest by `npm run puzzles`. As of the Markdown migration:

| Piece | Puzzles | Note |
|---|---|---|
| Amazon | 3 | |
| Wizard | 3 | |
| Painter | 2 | should be the deepest set — it's the introductory piece |
| Centaur | 1 | |
| General | 1 | |
| Princess | 1 | |
| Snare | 1 | |
| Archer | 0 | |
| Champion | 0 | a compound piece with no puzzles is a real hole |
| Mann | 0 | |
| Rolling Snare | 0 | experimental — may stay uncovered |
| Royal Painter | 0 | experimental — may stay uncovered |

---

## Parking lot

Ideas not yet placed in the arc.

- A puzzle where the Painter's inability to capture is the *only* reason a mate works.
- Something that teaches why the Amazon is worth less than queen+knight separately.
- A draft-comparison format — two armies, pick the better one, no board play.
- A "what went wrong" format built from real games, once there are real games.
