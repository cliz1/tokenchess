export function playSound(type: "move" | "capture" | "check") {
  const src = {
    move: "../public/sounds/move.mp3",
    capture: "../public/sounds/capture.mp3",
    check: "../public/sounds/check.mp3",
  }[type];
  const audio = new Audio(src);
  audio.play().catch((err) => {
    console.warn("Sound playback failed:", err);
  });
}

