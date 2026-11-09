import { useState, useSyncExternalStore } from "react";
import {
  SOUND_PACKS,
  getSoundPack,
  setSoundPack,
  subscribeSoundPack,
  playSound,
  type SoundPackId,
} from "../utils/sounds";

export default function SoundPackPicker() {
  const pack = useSyncExternalStore(subscribeSoundPack, getSoundPack);
  const [open, setOpen] = useState(false);

  const choose = (id: SoundPackId) => {
    setSoundPack(id);
    setOpen(false);
    playSound("capture", { pack: id }); // preview
  };

  return (
    <div
      style={{ position: "relative" }}
      tabIndex={0}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <span
        title="Sound"
        style={{ color: "#aaa", cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen((o) => !o)}
      >
        ♪ ▾
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
          minWidth: 220,
          zIndex: 100,
        }}
      >
        {Object.values(SOUND_PACKS).map((p) => (
          <div
            key={p.id}
            onClick={() => choose(p.id)}
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              color: p.id === pack ? "#fff" : "#aaa",
              background: p.id === pack ? "rgba(255,255,255,0.08)" : "transparent",
            }}
          >
            <div>{p.label}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{p.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
