// src/pages/LearnPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import TutorialBoard from "../components/TutorialBoard";
import lessons from "../assets/lessons.json";
import chapters from "../assets/chapters.json";
import { ROLE_DISPLAY_NAMES } from "../utils/chessHelpers";

type LessonStep = { text?: string; note?: string; fen?: string; image?: string; challenge?: React.ComponentProps<typeof TutorialBoard>["challenge"] };
type Lesson = { title: string; quote?: string; steps: LessonStep[] };
const LESSONS = lessons as unknown as Record<string, Lesson>;

// the guided track, grouped into chapters; generated from content/lessons/chapter-N/
const CHAPTERS = chapters as { chapter: number; title: string; lessons: string[] }[];
const TRACK = CHAPTERS.flatMap((c) => c.lessons);

const DISPLAY_NAME_TO_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_DISPLAY_NAMES).map(([role, name]) => [name.toLowerCase(), role])
);

type Beat = LessonStep & { lesson: string; title: string; quote?: string; first: boolean; role: string };

const STORAGE_KEY = "tokenchess.learn.beat";
// furthest beat ever reached; gated challenges mean everything before it is solved
const FURTHEST_KEY = "tokenchess.learn.furthest";

const readSaved = (max: number, key = STORAGE_KEY) => {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isInteger(n) && n >= 0 && n < max ? n : 0;
  } catch {
    return 0;
  }
};

const css = `
@keyframes learn-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.learn-copy > * { opacity: 0; animation: learn-rise 520ms ease-out forwards; }
.learn-copy > *:nth-child(1) { animation-delay: 60ms; }
.learn-copy > *:nth-child(2) { animation-delay: 260ms; }
.learn-copy > *:nth-child(3) { animation-delay: 460ms; }
.learn-copy > *:nth-child(n+4) { animation-delay: 660ms; }
.learn-copy p { margin: 0 0 14px; }
@media (prefers-reduced-motion: reduce) {
  .learn-copy > * { animation: none; opacity: 1; }
}
`;

export default function LearnPage() {
  const beats = useMemo<Beat[]>(
    () =>
      TRACK.flatMap((key) => {
        const l = LESSONS[key];
        if (!l) return [];
        const role = DISPLAY_NAME_TO_ROLE[l.title.toLowerCase()] ?? l.title.toLowerCase();
        return l.steps.map((s, i) => ({ ...s, lesson: key, title: l.title, quote: l.quote, first: i === 0, role }));
      }),
    []
  );

  const [index, setIndex] = useState(() => readSaved(beats.length));
  const [furthest, setFurthest] = useState(() => Math.max(readSaved(beats.length, FURTHEST_KEY), readSaved(beats.length)));
  const [showProgress, setShowProgress] = useState(false);
  const [solved, setSolved] = useState(false);
  const beat = beats[index];
  const last = beats.length - 1;
  // anything before the furthest beat reached was already solved (challenges gate progress), so revisits aren't gated
  const gated = !!beat.challenge && !solved && index >= furthest;

  useEffect(() => {
    setSolved(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(index));
      if (index > furthest) {
        localStorage.setItem(FURTHEST_KEY, String(index));
      }
    } catch {
      /* storage can be unavailable; progress just won't persist */
    }
    setFurthest((f) => Math.max(f, index));
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const lessonRows = useMemo(
    () =>
      TRACK.map((key) => {
        const start = beats.findIndex((b) => b.lesson === key);
        if (start < 0) return null;
        const count = beats.filter((b) => b.lesson === key).length;
        return { key, start, count, title: beats[start].title, role: beats[start].role };
      }).filter((r): r is NonNullable<typeof r> => r !== null),
    [beats]
  );

  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const wide = vp.w >= 860;
  // chessground needs a multiple of 8 px
  const boardSize = Math.max(240, Math.floor(Math.min(vp.h - 190, wide ? vp.w * 0.5 : vp.w - 32) / 8) * 8);

  const next = () => setIndex((i) => Math.min(last, i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight" && !gated) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gated]); // eslint-disable-line react-hooks/exhaustive-deps

  const boardFen = beat.fen ?? beat.challenge?.initialFen;
  const lessonStart = TRACK.indexOf(beat.lesson);

  const btn = (primary: boolean, disabled: boolean): React.CSSProperties => ({
    minHeight: 44,
    padding: "0 22px",
    borderRadius: 8,
    border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
    background: primary ? (disabled ? "rgba(216,169,74,0.25)" : "#d8a94a") : "transparent",
    color: primary ? (disabled ? "#8a7a55" : "#1a1408") : disabled ? "#555" : "#ddd",
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
  });

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#100e0a", color: "#ece4d6", zIndex: 10 }}>
      <style>{css}</style>

      <div style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", width: `${((index + 1) / beats.length) * 100}%`, background: "#d8a94a", transition: "width 300ms ease" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12 }}>
        <Link to="/" aria-label="Leave lesson" style={{ color: "#aaa", textDecoration: "none", fontSize: 22, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</Link>
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, color: "#8a8171", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {beat.title} · {lessonStart + 1} of {TRACK.length}
        </div>
        <button
          type="button"
          onClick={() => setShowProgress(true)}
          aria-label="View progress"
          style={{
            minHeight: 36, padding: "0 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            background: "rgba(216,169,74,0.1)", border: "1px solid rgba(216,169,74,0.4)", borderRadius: 999,
            color: "#d8a94a", fontSize: 13, fontWeight: 600,
          }}
        >
          <span aria-hidden style={{ position: "relative", width: 28, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
            <span style={{ position: "absolute", inset: 0, width: `${((furthest + 1) / beats.length) * 100}%`, background: "#d8a94a" }} />
          </span>
          Progress · {Math.round(((furthest + 1) / beats.length) * 100)}%
        </button>
      </div>

      <div
        key={index}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: wide ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: wide ? 48 : 12,
          padding: "0 16px",
          overflowY: "auto",
        }}
      >
        {boardFen && (
          <div style={{ flex: "0 0 auto" }}>
            <TutorialBoard
              key={`${index}-${boardFen}`}
              fen={boardFen}
              size={boardSize}
              challenge={beat.challenge ?? null}
              showControls={false}
              challengeLabel="Your move"
              onSolved={() => setSolved(true)}
            />
          </div>
        )}

        <div className="learn-copy" style={{ maxWidth: boardFen ? 460 : 620, fontSize: 18, lineHeight: 1.6 }}>
          {beat.first && (
            <div style={{ marginBottom: 14, textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 34, fontFamily: "Fraunces, Georgia, serif", fontWeight: 600 }}>
                {beat.title}
                <div className={`cg-piece ${beat.role} white`} style={{ width: 44, height: 44, backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "44px 44px" }} />
              </div>
              {beat.quote && (
                <div style={{ fontStyle: "italic", color: "#8a8171", fontSize: 15, marginTop: 4 }}>
                  {(() => {
                    // keep the attribution ("– Vincent van Gogh") together on its own line instead of wrapping mid-name
                    const m = beat.quote.match(/^([\s\S]*?)\s*[–—]\s*([^–—]+)$/);
                    const md = (t: string) => (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props) => <span {...props} /> }}>{t}</ReactMarkdown>
                    );
                    return m ? (
                      <>
                        <div style={{ textWrap: "balance" }}>{md(m[1])}</div>
                        <div style={{ whiteSpace: "nowrap", marginTop: 2 }}>– {md(m[2].trim())}</div>
                      </>
                    ) : md(beat.quote);
                  })()}
                </div>
              )}
            </div>
          )}
          {beat.text && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              skipHtml
              components={{ a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: "#d8a94a" }} /> }}
            >
              {beat.text}
            </ReactMarkdown>
          )}
          {beat.image && <img src={beat.image} alt="" style={{ maxWidth: "70%", maxHeight: "30vh", marginBottom: 14 }} />}
          {beat.note && <p style={{ color: "#d8a94a", fontWeight: 600 }}>{beat.note}</p>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "12px 16px 20px" }}>
        <button type="button" onClick={prev} disabled={index === 0} style={btn(false, index === 0)}>Back</button>
        {index === last ? (
          <Link to="/" style={{ ...btn(true, false), display: "flex", alignItems: "center", textDecoration: "none" }}>Finish</Link>
        ) : (
          <button type="button" onClick={next} disabled={gated} style={btn(true, gated)}>
            {gated ? "Solve to continue" : "Continue"}
          </button>
        )}
      </div>
      {showProgress && (
        <div
          onClick={() => setShowProgress(false)}
          style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            role="dialog"
            aria-label="Your progress"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#1a1610", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 460, maxHeight: "100%", overflowY: "auto", position: "relative" }}
          >
              <button type="button" onClick={() => setShowProgress(false)} aria-label="Close" style={{ background: "none", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", minWidth: 44, minHeight: 44, position: "absolute", top: 8, right: 8 }}>✕</button>
            {CHAPTERS.map((ch) => (
              <div key={ch.title} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 22, fontFamily: "Fraunces, Georgia, serif", fontWeight: 600, margin: "0 44px 12px 2px" }}>{ch.title}</div>
                {lessonRows.filter((r) => ch.lessons.includes(r.key)).map((r) => {
              const done = Math.min(r.count, Math.max(0, furthest - r.start));
              const unlocked = r.start <= furthest;
              const complete = done === r.count;
              const current = beat.lesson === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => { setIndex(r.start); setShowProgress(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "8px 10px", marginBottom: 6,
                    textAlign: "left", color: unlocked ? "#ece4d6" : "#5a5346", cursor: unlocked ? "pointer" : "default",
                    background: current ? "rgba(216,169,74,0.12)" : "transparent",
                    border: `1px solid ${current ? "rgba(216,169,74,0.5)" : "rgba(255,255,255,0.08)"}`, borderRadius: 8,
                  }}
                >
                  <div className={`cg-piece ${r.role} white`} style={{ width: 36, height: 36, flex: "0 0 auto", backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "36px 36px", opacity: unlocked ? 1 : 0.3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", marginTop: 6 }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${(done / r.count) * 100}%`, background: "#d8a94a" }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: complete ? "#d8a94a" : "#8a8171" }}>
                    {complete ? "Done" : unlocked ? `${done}/${r.count}` : "Locked"}
                  </div>
                </button>
              );
            })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
