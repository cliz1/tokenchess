import { test, expect, type Page } from "@playwright/test";

// A handful of smoke tests over the real browser runtime, covering what
// TypeScript can't: chessground's CSS/DOM and drag interaction. Deliberately
// small — the analysis board needs no auth or backend, unlike a live game or
// a saved draft.

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

async function squareCenter(page: Page, square: string) {
  const board = page.locator(".cg-wrap");
  const box = await board.boundingBox();
  if (!box) throw new Error(".cg-wrap not found");
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const size = box.width / 8;
  return {
    x: box.x + (file + 0.5) * size,
    y: box.y + (8 - rank + 0.5) * size,
  };
}

test("loads the analysis board", async ({ page }) => {
  await page.goto("/analysis");
  await expect(page.locator(".cg-wrap")).toBeVisible();
  await expect(page.locator(".cg-wrap piece.king.white")).toBeVisible();
});

test("makes a move by dragging a piece", async ({ page }) => {
  await page.goto("/analysis");
  await expect(page.locator(".cg-wrap piece.king.white")).toBeVisible();

  const from = await squareCenter(page, "e1");
  const to = await squareCenter(page, "d1");

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();

  // Chessground re-renders the piece at its new square as a fresh `piece`
  // element positioned there; the origin square is left without one.
  await expect(page.locator(".cg-wrap square.last-move")).toHaveCount(2);
});
