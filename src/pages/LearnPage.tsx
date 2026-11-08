// src/pages/LearnPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import TutorialBoard from "../components/TutorialBoard";
import lessons from "../assets/lessons.json";
import { ROLE_DISPLAY_NAMES } from "../utils/chessHelpers";

type LessonStep = { text?: string; note?: string; fen?: string; image?: string; challenge?: React.ComponentProps<typeof TutorialBoard>["challenge"] };
type Lesson = { title: string; quote?: string; steps: LessonStep[] };
const LESSONS = lessons as unknown as Record<string, Lesson>;

// the guided track: the piece lessons, in teaching order
const TRACK = ["Champion", "Princess", "Amazon", "Baker", "Painter", "Snare", "Wizard", "Archer", "General"];

const DISPLAY_NAME_TO_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_DISPLAY_NAMES).map(([role, name]) => [name.toLowerCase(), role])
);

type Beat = LessonStep & { lesson: string; title: string; quote?: string; first: boolean; role: string };

const STORAGE_KEY = "tokenchess.learn.beat";

const readSaved = (max: number) => {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
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
  const [solved, setSolved] = useState(false);
  const beat = beats[index];
  const last = beats.length - 1;
  const gated = !!beat.challenge && !solved;

  useEffect(() => {
    setSolved(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(index));
    } catch {
      /* storage can be unavailable; progress just won't persist */
    }
  }, [index]);

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
        <div style={{ minWidth: 44 }} />
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
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 34, fontFamily: "Fraunces, Georgia, serif", fontWeight: 600 }}>
                {beat.title}
                <div className={`cg-piece ${beat.role} white`} style={{ width: 44, height: 44, backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "44px 44px" }} />
              </div>
              {beat.quote && (
                <div style={{ fontStyle: "italic", color: "#8a8171", fontSize: 15, marginTop: 4 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props) => <span {...props} /> }}>{beat.quote}</ReactMarkdown>
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
    </div>
  );
}
