// src/components/TutorialLesson.tsx
import TutorialBoard from "./TutorialBoard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { ROLE_DISPLAY_NAMES } from "../utils/chessHelpers";
import { useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

// In-app routes a lesson can link to that are useless without an account: guests get a notice
// (with log in / sign up) instead of being sent there. Everything else just navigates.
const LOGIN_REQUIRED: Record<string, string> = {
  "/drafts": "Making a draft needs an account. Log in or sign up to build and save your own.",
};

// reverse of ROLE_DISPLAY_NAMES: displayed lesson title -> role slug used for piece CSS/asset lookup
const DISPLAY_NAME_TO_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_DISPLAY_NAMES).map(([role, name]) => [name.toLowerCase(), role])
);


type Step = {
  text?: string;
  fen?: string;
  note?: string;
  boardSize?: number;
  challenge?: any;
  image?: string;
};

type Props = {
  title: string;
  steps: Step[];
  quote?: string;
  onNavigate?: (slug: string) => void; // in-app links like /tutorials/token switch lessons instead of opening a tab
};

export default function TutorialLesson({ title, steps, quote, onNavigate }: Props) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  // a notice belongs to the lesson it was raised on
  useEffect(() => { setNotice(null); }, [title]);

  // Links starting with "/" stay in the app (same tab); anything else (wikipedia, etc.) opens a new tab.
  // Modified clicks (cmd/ctrl/shift/middle) are left to the browser so "open in new tab" still works.
  const handleInternalClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();

    const path = href.split(/[?#]/)[0];
    if (path.startsWith("/tutorials/") && onNavigate) {
      setNotice(null);
      onNavigate(path.slice("/tutorials/".length));
      return;
    }

    if (LOGIN_REQUIRED[path] && !user && !authLoading) {
      setNotice(LOGIN_REQUIRED[path]);
      return;
    }
    setNotice(null);
    navigate(href);
  };
  const availablePieces = ["champion", "princess", "amazon", "mann", "painter", "snare", "wizard", "archer", "general"];
  const lessonPiece = DISPLAY_NAME_TO_ROLE[title.toLowerCase()] ?? title.toLowerCase();
  const showPiece = availablePieces.includes(lessonPiece);

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto", marginBottom: 32}}>
      {notice && (
        <div
          role="alert"
          style={{
            position: "sticky", top: 0, zIndex: 5, marginBottom: 12, padding: "12px 14px", borderRadius: 8,
            background: "#2a2418", border: "1px solid #6b5a2a", color: "#e8d9a8", fontSize: 14,
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
          }}
        >
          <span style={{ flex: "1 1 260px" }}>{notice}</span>
          <button onClick={() => navigate("/login")} style={noticeBtn}>Log in</button>
          <button onClick={() => navigate("/register")} style={noticeBtn}>Sign up</button>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" style={{ ...noticeBtn, border: "none", color: "#aaa" }}>✕</button>
        </div>
      )}

      <h2 style={{ marginTop: 6, fontSize: 35, marginBottom:0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {title}
          {showPiece && (
          <div
            className={`cg-piece ${lessonPiece} white`}
            style={{
              width: 48,
              height: 48,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              backgroundSize: "48px 48px",
            }}
          />
        )}
      </h2>

      {quote && (
        <div
          style={{
            fontStyle: "italic",
            fontFamily: "Arial, serif",
            color: "#aaa",
            fontSize: 16,
            marginTop: 1,
            textAlign: "center",
            borderLeft: "3px solid rgba(255,255,255,0.1)",
            paddingLeft: 12,
          }}
        >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          children={quote}
          components={{
            p: ({ node, ...props }) => <span {...props} />,
          }}
        />
        </div>
      )}


      {steps.map((s, i) => {
        const boardFen = s.fen ?? s.challenge?.initialFen;

        const challengeFingerprint = s.challenge ? JSON.stringify(s.challenge.steps ?? s.challenge) : "";
        const boardKey = `tutorial-${title.replace(/\s+/g, "_")}-${i}-${boardFen}-${challengeFingerprint}`;

        const isChallenge = !!s.challenge;

        return (
          <div key={`${title}-${i}`} style={{ marginTop: 16, fontSize: 18, lineHeight: 1.55 }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            skipHtml
            components={{
              a: ({ node, ...props }) => {
                const href = props.href ?? "";
                if (href.startsWith("/")) {
                  return <a {...props} onClick={(e) => handleInternalClick(e, href)} />;
                }
                return <a {...props} target="_blank" rel="noopener noreferrer" />;
              },
              br: () => <br />,
              p: ({ node, ...props }) => <p {...props} />,
              em: ({ children }) => <i>{children}</i>,

              table: ({ children }) => (
                <table
                  style={{
                    margin: "16px auto",
                    borderCollapse: "collapse",
                  }}
                >
                  {children}
                </table>
              ),
              th: ({ children }) => (
                <th
                  style={{
                    padding: "6px 12px",
                    borderBottom: "1px solid #555",
                    textAlign: "center",
                    color: "#ddd",
                  }}
                >
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td
                  style={{
                    padding: "6px 12px",
                    textAlign: "center",
                  }}
                >
                  {children}
                </td>
              ),
            }}
          >
            {s.text}
          </ReactMarkdown>

            {s.image && (
              <div style={{ marginTop: 8, textAlign: "center" }}>
                <img src={s.image} alt="" style={{ maxWidth: "50%", marginTop: 8 }} />
              </div>
            )}

            {/* Render the board only if there’s a FEN or challenge */}
            {boardFen || isChallenge ? (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  justifyContent: "center",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <TutorialBoard
                  key={boardKey}
                  fen={boardFen}
                  size={s.boardSize ?? 460}
                  challenge={s.challenge ?? null}
                  showControls={false}
                  showReset={!isChallenge}
                  challengeLabel={isChallenge ? "Exercise" : "Demo"}
                />

                {s.note && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "#aaa", textAlign: "center" }}>
                    {s.note}
                  </div>
                )}
              </div>
            ) : (
              // Optional note-only rendering if no board
              s.note && <div style={{ marginTop: 6, fontSize: 13, color: "#aaa", textAlign: "center" }}>{s.note}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const noticeBtn: React.CSSProperties = {
  padding: "5px 12px", fontSize: 13, borderRadius: 6, cursor: "pointer",
  background: "transparent", border: "1px solid #6b5a2a", color: "#e8d9a8",
};
