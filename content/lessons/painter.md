---
id: Painter
order: 9
title: Painter
quote: “I dream my paintings, and then I paint my dreams.” – Vincent van Gogh
---

@note Push the Painter, then paint the rook.

While similar to a pawn, a Painter has no violence in their heart. They are a dreamer, but not a fighter. 
 Rather than capture, the Painter *paints* pieces the opposite color.

```challenge
fen: "8/p1k1r1b1/1p4p1/1KPY1pN1/5P2/8/8/8 w - - 0 1"
line: d5d6 c7d7 d6e7
```

---

@note White to move and win.

Even when [promoting](https://en.wikipedia.org/wiki/Promotion_(chess)), the Painter refuses to pick up a sword. 
 Instead, they become the *Royal Painter*, which moves like a Queen but *paints* instead of capturing.

```challenge
fen: "8/8/YK6/8/8/8/6kp/8 w - - 0 1"
line: a6a7 h2h1q a7a8o g2g1 a8h1 g1f2 a8f3
```

---

@image /images/wetpaint.png

To prevent standoffs between two painters controlling the same square, Painters follow the *wet paint rule*: 
 **Once a piece is painted, it cannot be painted again on the opponent's next move.** The piece may only be painted again once the paint dries one turn later.

---

In the above diagram, White has just painted a queen on the previous move. 
 Now black's turn, black **cannot paint the queen** since the paint has yet to dry.
