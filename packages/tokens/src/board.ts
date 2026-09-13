// Board theme is user-selectable (unlike the app's own dark/light chrome,
// which stays fixed) — these are the 4 existing desktop themes, ported
// 1:1 from src/BoardThemeContext.tsx and src/assets/chessground.<id>.css.
// Jade is the desktop default. check uses the same red radial gradient in
// every theme, so it's exported once rather than per-theme.
//
// coordOnLight/coordOnDark name the SQUARE the coordinate label sits on,
// not the label's own color — coordOnLight is the (dark) text used atop a
// light square, coordOnDark the (light) text used atop a dark square.

export interface BoardThemeColors {
  id: string;
  label: string;
  light: string;
  dark: string;
  lastMove: string;
  selected: string;
  coordOnLight: string;
  coordOnDark: string;
}

export const boardThemes: BoardThemeColors[] = [
  {
    id: "jade",
    label: "Jade Marble",
    light: "#93ab91",
    dark: "#3f5f3d",
    lastMove: "rgba(0, 155, 199, 0.41)",
    selected: "rgba(20, 85, 30, 0.5)",
    coordOnLight: "rgba(20, 50, 40, 0.85)",
    coordOnDark: "rgba(200, 230, 220, 0.9)",
  },
  {
    id: "classic",
    label: "Classic",
    light: "#f0d9b5",
    dark: "#b58863",
    lastMove: "rgba(155, 199, 0, 0.41)",
    selected: "rgba(20, 85, 30, 0.5)",
    coordOnLight: "rgba(72, 72, 72, 0.8)",
    coordOnDark: "rgba(255, 255, 255, 0.8)",
  },
  {
    id: "walnut",
    label: "Walnut",
    light: "#d3ad76",
    dark: "#8a6440",
    lastMove: "rgba(199, 130, 0, 0.41)",
    selected: "rgba(20, 85, 30, 0.5)",
    coordOnLight: "rgba(60, 38, 15, 0.85)",
    coordOnDark: "rgba(255, 244, 230, 0.9)",
  },
  {
    id: "ice",
    label: "Ice",
    light: "#dce6ef",
    dark: "#93aec4",
    lastMove: "rgba(0, 155, 199, 0.35)",
    selected: "rgba(10, 90, 140, 0.5)",
    coordOnLight: "rgba(25, 45, 65, 0.8)",
    coordOnDark: "rgba(240, 248, 255, 0.9)",
  },
];

export const defaultBoardTheme = "jade";

export const checkGradient =
  "radial-gradient(ellipse at center, rgba(255,0,0,1) 0%, rgba(231,0,0,1) 25%, rgba(169,0,0,0) 89%, rgba(158,0,0,0) 100%)";
