// src/components/TutorialLesson.tsx
import React from "react";
import TutorialBoard from "./TutorialBoard";

type Step = {
  text?: string;
  fen?: string;
  note?: string;
  boardSize?: number;
  challenge?: any;
};

type Props = {
  title: string;
  steps: Step[];
  quote?: string;
};

export default function TutorialLesson({ title, steps, quote }: Props) {
  return (
    <div style={{ padding: 16, maxWidth: 980 }}>
      <h2 style={{ marginTop: 6 }}>{title}</h2>
        {quote && (
  <div
    style={{
      fontStyle: "italic",
      color: "#aaa",
      fontSize: 16,
      marginTop: 6,
      textAlign: "center",
      borderLeft: "3px solid rgba(255,255,255,0.1)",
      paddingLeft: 12,
    }}
  >
    {quote}
  </div>
)}
      {steps.map((s, i) => {
        // boardFen: prefer explicit fen; fallback to challenge.initialFen; final fallback "start"
        const boardFen = s.fen ?? s.challenge?.initialFen ?? "start";

        // make a compact stable key so the board remounts when the step/challenge changes.
        // stringify only the challenge.steps if present to avoid massive keys.
        const challengeFingerprint = s.challenge ? JSON.stringify(s.challenge.steps ?? s.challenge) : "";
        const boardKey = `tutorial-${title.replace(/\s+/g, "_")}-${i}-${boardFen}-${challengeFingerprint}`;

        // small UI: show whether this step is a challenge
        const isChallenge = !!s.challenge;

        return (
          <div key={`${title}-${i}`} style={{ marginTop: 16 }}>
            <p className="lesson-text">{s.text}</p>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                justifyContent: "center",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Render the board for either fen or challenge */}
              <TutorialBoard
                key={boardKey}
                fen={boardFen}
                size={s.boardSize ?? 420}
                challenge={s.challenge ?? null}
                showControls={false}
                challengeLabel={isChallenge ? "Exercise" : "Demo"}
              />

              {s.note && (
                <div style={{ marginTop: 6, fontSize: 13, color: "#aaa", textAlign: "center" }}>{s.note}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
