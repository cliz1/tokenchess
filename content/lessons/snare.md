---
id: Snare
order: 10
title: Snare
quote: “It's a trap!” – Admiral Ackbar
---

@image /images/snarediagram.png

The Snare does not capture, but instead restricts the movement of opposing pieces **directly next to or in front of it.** 
 In the diagram below, the rooks *cannot* move, but the knights can.

---

@note Ensnare the opposing queen, then attack it with a pawn.

The Snare moves forward one square, straight or diagonally. 
 This example demonstrates the ability of a snare to assist in capturing a valuable target, such as a queen.

```challenge
fen: "rnb1kb1r/ppp1pppp/5n2/3q4/8/3S4/PPP2PPP/RNBQKBNR w - - 0 1"
line: d3d4 e7e5 c2c4 e5d4 c4d5
```

---

@note White to move, mate in two.

Note that since the Snare cannot capture, it cannot give check. 
 However, a Snare can trap a king, often leading to an easy checkmate!

```challenge
fen: "1r6/8/1k6/8/2S5/8/3B4/1K6 w - - 0 1"
line: c4b5 b8e8 d2a5
```

---

@note White to move, mate in three.

Like the Painter, the Snare does *not* promote like a pawn. 
 It promotes to a *Rolling Snare,* which moves like a queen, but still cannot capture. Unlike the Snare, it also traps pieces directly *behind* it.

```challenge
fen: "3K4/2S5/1N2k3/8/8/7p/8/8 w - - 0 1"
line: c7c8 e6e5 c8e6 h3h2 b6c4
alt: c7c8 e6e5 c8e6 h3h2 b6d7
```
