import { useState } from "react";
import { useBoardTheme, BOARD_THEMES } from "../BoardThemeContext";

export default function BoardThemePicker() {
  const { theme, setTheme } = useBoardTheme();
  const [open, setOpen] = useState(false);
  const current = BOARD_THEMES.find((t) => t.id === theme)!;

  return (
    <div
      style={{ position: "relative" }}
      tabIndex={0}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <span
        style={{
          color: "#aaa",
          cursor: "pointer",
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: current.swatch[0],
            border: `1px solid ${current.swatch[1]}`,
            display: "inline-block",
          }}
        />
         ▾
      </span>
      <div
        style={{
          position: "absolute",
          top: "100%",
          right: 0,
          background: "rgba(30,30,30,0.95)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 6,
          display: open ? "flex" : "none",
          flexDirection: "column",
          padding: 4,
          minWidth: 150,
          zIndex: 100,
        }}
      >
        {BOARD_THEMES.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              setTheme(t.id);
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              color: t.id === theme ? "#fff" : "#aaa",
              background: t.id === theme ? "rgba(255,255,255,0.08)" : "transparent",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: t.swatch[0],
                border: `1px solid ${t.swatch[1]}`,
                display: "inline-block",
              }}
            />
            {t.label}
          </div>
        ))}
      </div>
    </div>
  );
}
