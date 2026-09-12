// level2 is settled — ported directly from the plan's raised-surface shadow,
// per theme. level1 is extrapolated for lower-emphasis elements and, like
// the rest of this file's scale mechanics, not yet confirmed against real
// screens.
export const shadow = {
  dark: {
    level1: "0 1px 2px rgba(0,0,0,0.3)",
    level2: "0 1px 2px rgba(0,0,0,0.4), 0 10px 30px -14px rgba(0,0,0,0.7)",
  },
  light: {
    level1: "0 1px 2px rgba(31,27,20,0.05)",
    level2: "0 1px 2px rgba(31,27,20,0.06), 0 8px 24px -12px rgba(31,27,20,0.18)",
  },
};
