// src/components/Flair.tsx — renders a flair emoji as a Twemoji SVG (the curated set lives in src/assets/twemoji)
const URLS = import.meta.glob("../assets/twemoji/*.svg", { query: "?url", import: "default", eager: true }) as Record<string, string>;

const toKey = (emoji: string) =>
  [...emoji].map((c) => c.codePointAt(0)!.toString(16)).filter((h) => h !== "fe0f").join("-");

export default function Flair({ emoji, size = "1.1em" }: { emoji: string; size?: string }) {
  const src = URLS[`../assets/twemoji/${toKey(emoji)}.svg`];
  // flairs saved before the curated set fall back to the system emoji
  if (!src) return <span style={{ flex: "0 0 auto" }}>{emoji}</span>;
  return <img src={src} alt={emoji} draggable={false} style={{ height: size, width: size, flex: "0 0 auto", display: "inline-block" }} />;
}
