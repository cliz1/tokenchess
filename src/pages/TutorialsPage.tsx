// src/pages/TutorialsPage.tsx
import React, { useMemo, useState } from "react";
import TutorialLesson from "../components/TutorialLesson";
import { Link } from "react-router-dom";
import lessons from '../assets/lessons.json';

const LESSONS = lessons as Record<string, { title: string; quote: string; steps: { text: string }[] }>;

type LessonKey = keyof typeof LESSONS;

export default function TutorialsPage() {
  const groups = useMemo(
    () => [
      {
        heading: "1. Introduction",
        items: [
          { key: "standard-rules", label: "1.1 Chess" },
          { key: "fairy-chess", label: "1.2 Fairy Chess" },
          { key: "token-chess", label: "1.3 Token Chess" },
        ],
      },
      {
        heading: "2. Token Chess Pieces",
        items: [
          { key: "Champion", label: "2.1 Champion" },
          { key: "Princess", label: "2.2 Princess" },
          { key: "Amazon", label: "2.3 Amazon" },
          { key: "Commoner", label: "2.4 Commoner" },
          { key: "Painter", label: "2.5 Painter" },
          { key: "Snare", label: "2.6 Snare" },
          { key: "Wizard", label: "2.7 Wizard" },
          { key: "Archer", label: "2.8 Archer" }
        ],
      },
      {
        heading: "3. Token Chess Rules",
        items: [{ key: "token-values", label: "3.1 Token Values" },
          { key: "draft", label: "3.2 Drafting" } 
        ],
      },
      
    ],
    []
  );

  const [selected, setSelected] = useState<LessonKey>("standard-rules");

  const lesson = LESSONS[selected];

  return (
  <div
    style={{
      display: "flex",
      gap: 18,
      padding: 20,
      height: "100vh", 
      boxSizing: "border-box",
      overflow: "hidden",
    }}
  >
    {/* Sidebar TOC */}
    <aside
      style={{
        width: 280,
        padding: 12,
        borderRight: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        flexDirection: "column"
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
      <div style={{ marginTop: 18 }}>
        <Link to="/">← Back to Home</Link>
      </div>
    </aside>

    {/* Content area */}
    <section
      style={{
        flex: 1,
        overflowY: "auto",
        paddingRight: 8,
      }}
    >
      <TutorialLesson title={lesson.title} steps={lesson.steps} quote={lesson.quote} />
    </section>
  </div>
);

}

