// "Aged brass and patina" — one crafted look, dark and light, no theme
// pickers. Ported 1:1 from the project plan's proposal, which the plan
// artifact itself is rendered in (toggle system appearance there to see
// both). These exact values are settled; see type.ts / spacing.ts /
// motion.ts / elevation.ts for the parts that aren't yet.

export interface ColorScale {
  ground: string;
  surface: string;
  raised: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineStrong: string;
  accent: string;
  accent2: string;
  accentWash: string;
  patina: string;
  patinaWash: string;
  alert: string;
  alertWash: string;
  squareDark: string;
  squareLight: string;
}

export const dark: ColorScale = {
  ground: "#100e0a",
  surface: "#191510",
  raised: "#221d16",
  ink: "#ece4d6",
  ink2: "#b0a695",
  ink3: "#7d7365",
  line: "#2d271e",
  lineStrong: "#443c2e",
  accent: "#d8a94a",
  accent2: "#b98f34",
  accentWash: "rgba(216,169,74,0.11)",
  patina: "#7fa08c",
  patinaWash: "rgba(127,160,140,0.12)",
  alert: "#cf7160",
  alertWash: "rgba(207,113,96,0.11)",
  squareDark: "rgba(216,169,74,0.13)",
  squareLight: "rgba(216,169,74,0.04)",
};

export const light: ColorScale = {
  ground: "#f0ece3",
  surface: "#f8f6f1",
  raised: "#fffefb",
  ink: "#1f1b14",
  ink2: "#57503f",
  ink3: "#8a8171",
  line: "#ddd6c8",
  lineStrong: "#c3baa8",
  accent: "#8a6413",
  accent2: "#b99537",
  accentWash: "rgba(184,149,55,0.12)",
  patina: "#3d6553",
  patinaWash: "rgba(61,101,83,0.12)",
  alert: "#9c4436",
  alertWash: "rgba(156,68,54,0.10)",
  squareDark: "rgba(138,100,19,0.16)",
  squareLight: "rgba(138,100,19,0.05)",
};

export const colors = { dark, light };
