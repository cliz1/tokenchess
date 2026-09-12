// Fraunces for display, Karla for body, JetBrains Mono for FEN strings and
// other data — carried over from the plan artifact, which is set in this
// pairing. The family choices are settled; the numeric scale below is a
// first draft, not yet confirmed against real screens.

export const fontFamily = {
  display: '"Fraunces", "Iowan Old Style", Georgia, serif',
  body: '"Karla", "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
};

// Fixed sizes rather than the plan page's clamp()-based fluid type — native
// screens have no viewport units, so responsiveness happens per breakpoint
// in the consuming app instead of inside the token.
export const fontSize = {
  display: 34,
  h1: 28,
  h2: 22,
  h3: 17,
  body: 16,
  small: 13,
  micro: 11,
};

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const lineHeight = {
  tight: 1.15,
  body: 1.5,
  relaxed: 1.62,
};
