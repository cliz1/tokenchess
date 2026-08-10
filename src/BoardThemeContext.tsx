import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type BoardTheme = "jade" | "classic" | "walnut" | "ice";

export const BOARD_THEMES: { id: BoardTheme; label: string; swatch: [string, string] }[] = [
  { id: "jade", label: "Jade Marble", swatch: ["#93ab91", "#3f5f3d"] },
  { id: "classic", label: "Classic", swatch: ["#f0d9b5", "#b58863"] },
  { id: "walnut", label: "Walnut", swatch: ["#d3ad76", "#8a6440"] },
  { id: "ice", label: "Ice", swatch: ["#dce6ef", "#93aec4"] },
];

const STORAGE_KEY = "boardTheme";
const DEFAULT_THEME: BoardTheme = "jade";

type BoardThemeContextValue = {
  theme: BoardTheme;
  setTheme: (theme: BoardTheme) => void;
};

const BoardThemeContext = createContext<BoardThemeContextValue | undefined>(undefined);

function readStoredTheme(): BoardTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && BOARD_THEMES.some((t) => t.id === stored)) return stored as BoardTheme;
  return DEFAULT_THEME;
}

export function BoardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<BoardTheme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-board-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <BoardThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </BoardThemeContext.Provider>
  );
}

export function useBoardTheme() {
  const ctx = useContext(BoardThemeContext);
  if (!ctx) throw new Error("useBoardTheme must be used within BoardThemeProvider");
  return ctx;
}
