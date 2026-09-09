---
id: Wizard
order: 11
title: Wizard
quote: “A wizard is never late. Nor is he early. He arrives precisely when he means to.” – Gandalf
---

@note Jump over the pawn, then capture the queen.

The Wizard moves up to two squares like a queen. Like a knight, the Wizard can jump over any pieces in the way.

```challenge
fen: "4kbq1/5n2/8/4p3/4W3/3K4/8/8 w - - 0 1"
line: e4e6 e8d8 e6g8
```

---

@note Escape the pin.

The Wizard has the ability to swap places with a friendly piece within its movement range. 
 This ability even disregards pins, contrary to standard chess rules which disallow moving “through“ check.

```challenge
fen: "7k/6b1/8/8/3W4/2K5/3P4/8 w - - 0 1"
line: d4d2
```

---

@note Escape the checkmate attempt.

The Wizard may be used to escape the King from dangerous places, including positions that are otherwise checkmate!

```challenge
fen: "rnb1kb1r/ppp1pppp/3p1n2/8/8/2N3Pp/PPPPPPqP/R2QW1KR w - - 0 1"
line: e1g1
```
