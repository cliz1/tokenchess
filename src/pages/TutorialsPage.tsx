import { useMemo, useState, useEffect, useRef } from "react";
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

  // measure header height so we can size the tutorials container to exactly the viewport leftover
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  useEffect(() => {
    const measure = () => {
      const hdr = document.querySelector("header") as HTMLElement | null;
      setHeaderHeight(hdr ? hdr.offsetHeight : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // refs to manage independent scrolling
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // when selected changes, scroll the content pane to top
  useEffect(() => {
    if (contentRef.current) {
      // instant jump as requested; change to behavior: "smooth" if you prefer smooth scroll
      contentRef.current.scrollTo({ top: 0, behavior: "auto" });
      // also reset sidebar scroll to show the selected item (optional)
      const selBtn = sidebarRef.current?.querySelector<HTMLButtonElement>('button[aria-current="true"]');
      if (selBtn) {
        // ensure selected button is visible in sidebar
        selBtn.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selected]);

  const containerStyle: React.CSSProperties = {
    display: "flex",
    gap: 18,
    padding: 20,
    boxSizing: "border-box",
    // set height so that header + this container == viewport height.
    // fallback: if headerHeight is 0, don't set height (keeps existing behavior)
    height: headerHeight ? `calc(100vh - ${headerHeight}px)` : undefined,
    overflow: "hidden", // hide the page-level scrollbar for this route — side panes will scroll
  };

  return (
    <div style={containerStyle}>
      {/* Sidebar TOC */}
      <aside
        ref={sidebarRef}
        style={{
          width: 280,
          padding: 12,
          borderRight: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          // independent scrolling
          overflowY: "auto",
          maxHeight: "100%",
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
                  aria-current={selected === it.key ? "true" : undefined}
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
        ref={contentRef}
        style={{
          flex: 1,
          paddingRight: 8,
          boxSizing: "border-box",
          overflowY: "auto", // independent scrolling
          maxHeight: "100%",
        }}
      >
        <TutorialLesson title={lesson.title} steps={lesson.steps} quote={lesson.quote} />
      </section>
    </div>
  );
}


