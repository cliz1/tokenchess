// src/pages/TutorialsPage.tsx
import { useMemo, useState } from "react";
import TutorialLesson from "../components/TutorialLesson";
import lessons from '../assets/lessons.json';


const LESSONS = lessons as Record<string, { title: string; quote: string; steps: { text: string }[] }>;

type LessonKey = keyof typeof LESSONS;

export default function TutorialsPage() { 
  const groups = useMemo(
    () => [
      {
        heading: "Introduction",
        items: [
          { key: "welcome", label: "Welcome" },
          { key: "standard-rules", label: "Chess" },
          { key: "fairy-chess", label: "Fairy Pieces" },
          { key: "token-chess", label: "Token" },
        ],
      },
      {
        heading: "Token's Fairy Pieces",
        items: [
          { key: "Champion", label: "Champion" },
          { key: "Princess", label: "Princess" },
          { key: "Amazon", label: "Amazon" },
          { key: "Mann", label: "Mann" },
          { key: "Painter", label: "Painter" },
          { key: "Snare", label: "Snare" },
          { key: "Wizard", label: "Wizard" },
          { key: "Archer", label: "Archer" }
        ],
      },
      {
        heading: "Setup & Playing",
        items: [{ key: "token-values", label: "Tokens" },
          { key: "draft", label: "Drafting" },
          { key: "multiplayer", label: "Playing" }
        ],
      },
         {
        heading: "Other Features",
        items: [{ key: "board-editor", label: "Board Editor" },
          { key: "puzzles", label: "Puzzles" }
        ],
      },
        {
        heading: "More Info",
        items: [{ key: "source", label: "Source" },
          { key: "community", label: "Community" }
        ],
      },
      
    ],
    []
  );

  const [selected, setSelected] = useState<LessonKey>("welcome");

  const lesson = LESSONS[selected];

  return (
  <div
    style={{
      display: "flex",
      gap: 18,
      padding: 20,
      boxSizing: "border-box",
    }}
  >
    {/* Sidebar TOC */}
    <aside
      style={{
        width: 280,
        padding: 12,
        borderRight: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <h3 style={{ marginTop: 4 }}>Table of contents</h3>
      {groups.map((g) => (
        <div key={g.heading} style={{ marginTop: 12 }}>
          <div style={{ color: "#bbb", fontSize: 13, marginBottom: 8 }}>{g.heading}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.items.map((it) => (
              <button
                key={it.key}
                onClick={() => setSelected(it.key as LessonKey)}
                style={{
                  display: "block",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: selected === it.key ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "none",
                  color: selected === it.key ? "#fff" : "#ccc",
                  cursor: "pointer",
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>

    {/* Content area */}
    <section
      style={{
        flex: 1,
        paddingRight: 8,
        boxSizing: "border-box",
      }}
    >
      <TutorialLesson title={lesson.title} steps={lesson.steps} quote={lesson.quote} />
    </section>
  </div>
);

}

