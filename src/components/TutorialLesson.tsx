// src/components/TutorialLesson.tsx
import TutorialBoard from "./TutorialBoard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";


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
};

export default function TutorialLesson({ title, steps, quote }: Props) {
  const availablePieces = ["champion", "princess", "amazon", "mann", "painter", "snare", "wizard", "archer"];
  const lessonPiece = title.toLowerCase();
  const showPiece = availablePieces.includes(lessonPiece);

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto", marginBottom: 32}}>
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
          <div key={`${title}-${i}`} style={{ marginTop: 16 }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            skipHtml
            components={{
              a: ({ node, ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" />
              ),
              br: () => <br />,
              p: ({ node, ...props }) => <p {...props} />,
              em: ({ children }) => <i>{children}</i>,
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
