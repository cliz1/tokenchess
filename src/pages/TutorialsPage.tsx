//src/pages/TutorialsPage.tsx
import { useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import TutorialLesson from "../components/TutorialLesson";
import lessons from '../assets/lessons.json';
import balanceChanges from '../assets/balance-changes.json';
import WikiPiece from "../components/WikiPiece";
import { WIKI_PIECES, wikiBySlug } from "../wiki/pieces";

const LESSONS = lessons as Record<string, { title: string; quote: string; steps: { text: string }[] }>;

// The Balance page is hand-written in balance-changes.json (not generated from content/lessons/balance.md).
// Add a new { heading, changes: [{ piece, title, text }] } entry at the TOP of that file for each balance patch.
const BALANCE_STEPS = (balanceChanges as { heading: string; changes: { piece: string; title: string; text: string }[] }[]).map(
  (s) => ({ text: s.heading, changes: s.changes })
);

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
        ],
      },
      {
        heading: "Setup & Playing",
        items: [{ key: "token", label: "Token Chess" },
          { key: "draft", label: "Drafts" },
          // { key: "multiplayer", label: "Playing" }, // chapter hidden; uncomment to restore
        ],
      },
      // Temporarily disabled; uncomment to restore:
      // {
      //   heading: "Other Features",
      //   items: [{ key: "board-editor", label: "Board Editor" },
      //     { key: "puzzles", label: "Puzzles" }
      //   ],
      // },
      {
        heading: "More Info",
        items: [{ key: "source", label: "Source" },
          { key: "community", label: "Community" },
          { key: "balance", label: "Balance" }
        ],
      },
    ],
    []
  );

  const { "*": lessonSlug } = useParams();
  // a lesson key, or "wiki/<piece slug>" for a piece-wiki page
  const [selected, setSelected] = useState<string>(
    lessonSlug && (lessonSlug in LESSONS || (lessonSlug.startsWith("wiki/") && wikiBySlug(lessonSlug.slice(5))))
      ? lessonSlug
      : "welcome"
  );
  const wikiEntry = selected.startsWith("wiki/") ? wikiBySlug(selected.slice(5)) : undefined;
  const [wikiOpen, setWikiOpen] = useState<boolean>(!!wikiEntry);
  const lesson = selected === "balance" ? { ...LESSONS.balance, steps: BALANCE_STEPS } : LESSONS[selected as LessonKey] ?? LESSONS.welcome;

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
      contentRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
    if (sidebarRef.current) {
      const sidebar = sidebarRef.current;
      const selBtn = sidebar.querySelector<HTMLButtonElement>('button[aria-current="true"]');
      if (selBtn) {
        const btnTop = selBtn.offsetTop;
        const btnBottom = btnTop + selBtn.offsetHeight;
        if (btnTop < sidebar.scrollTop) {
          sidebar.scrollTop = btnTop;
        } else if (btnBottom > sidebar.scrollTop + sidebar.clientHeight) {
          sidebar.scrollTop = btnBottom - sidebar.clientHeight;
        }
      }
    }
  }, [selected]);

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: "block",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 6,
    background: active ? "rgba(255,255,255,0.06)" : "transparent",
    border: "none",
    color: active ? "#fff" : "#ccc",
    fontSize: 16,
    cursor: "pointer",
  });

  const containerStyle: React.CSSProperties = {
    display: "flex",
    gap: 18,
    padding: 20,
    boxSizing: "border-box",
    height: headerHeight ? `calc(100vh - ${headerHeight}px)` : undefined,
    overflow: "hidden",
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
          marginBottom: 20
        }}
      >
        <h3 style={{ marginTop: 4 }}>Contents</h3>
        {groups.map((g) => (
          <div key={g.heading} style={{ marginTop: 12 }}>
            <div style={{ color: "#bbb", fontSize: 15, marginBottom: 8 }}>{g.heading}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map((it) => (
                <button key={it.key} aria-current={selected === it.key ? "true" : undefined} onClick={() => setSelected(it.key)} style={itemStyle(selected === it.key)}>
                  {it.label}
                </button>
              ))}

              {/* Piece Wiki: a chapter like the others, expanding into one page per piece */}
              {g.heading === "Setup & Playing" && (
                <>
                  <button onClick={() => setWikiOpen((o) => !o)} aria-expanded={wikiOpen} style={{ ...itemStyle(false), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Piece Wiki</span>
                    <span aria-hidden="true" style={{ fontSize: 13, color: "#999" }}>{wikiOpen ? "▾" : "▸"}</span>
                  </button>
                  {wikiOpen && WIKI_PIECES.map((p) => {
                    const key = `wiki/${p.slug}`;
                    return (
                      <button key={key} aria-current={selected === key ? "true" : undefined} onClick={() => setSelected(key)} style={{ ...itemStyle(selected === key), paddingLeft: 24 }}>
                        {p.name}
                      </button>
                    );
                  })}
                </>
              )}
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
        {wikiEntry ? (
          <WikiPiece entry={wikiEntry} />
        ) : (
          <TutorialLesson title={lesson.title} steps={lesson.steps} quote={lesson.quote} onNavigate={(slug) => {
            // lesson keys, or wiki/<piece slug> (also expands the Piece Wiki dropdown)
            if (slug in LESSONS) setSelected(slug);
            else if (slug.startsWith("wiki/") && wikiBySlug(slug.slice(5))) { setSelected(slug); setWikiOpen(true); }
          }} />
        )}
      </section>
    </div>
  );
}


