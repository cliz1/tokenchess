// First draft, not yet confirmed against real screens. These are the
// motion-on values — the consuming app is responsible for checking
// prefers-reduced-motion (web) or AccessibilityInfo.isReduceMotionEnabled
// (native) and skipping to the end state instead of importing a "reduced"
// variant from here.
export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
};

export const easing = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  decelerate: "cubic-bezier(0, 0, 0.2, 1)",
  accelerate: "cubic-bezier(0.4, 0, 1, 1)",
};
