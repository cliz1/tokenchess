// Sound engine + packs.
//
// Two packs:
//   smooth    (default) Lichess Standard move/capture, Woodland game-end notify,
//             plus Token Chess special-mechanic effects (paint, wizard, archer, snare).
//   homegrown real-board recordings. Sound varies by the piece being moved.
//             No special-mechanic effects.
//
// Playback uses Web Audio with decoded, cached buffers (low latency, and it behaves
// better than `new Audio()` inside the iOS WebView).

export type SoundPackId = "smooth" | "homegrown";

export type SoundEvent =
  | "move"
  | "capture"
  | "castle"
  | "result" // game over (win / lose / draw)
  | "paint"
  | "wizard"
  | "archer"
  | "snare";

type Role = string; // chessops role name, e.g. "pawn", "knight", "painter"

type Pack = {
  id: SoundPackId;
  label: string;
  description: string;
  /** Events that play in this pack. Anything missing is silent. */
  events: Partial<Record<SoundEvent, string[]>>;
  /**
   * Per-piece overrides for move / capture. Falls back to `events.move` / `events.capture`.
   * Drop recordings in public/sounds/homegrown/ and list them here, e.g.
   *   moveByRole: { knight: ["/sounds/homegrown/knight-move1.mp3", ...] }
   */
  moveByRole?: Record<Role, string[]>;
  captureByRole?: Record<Role, string[]>;
};

const SPECIAL = {
  paint: ["/sounds/special/paint.mp3"],
  wizard: ["/sounds/special/wizard.mp3"],
  archer: ["/sounds/special/arrow.mp3", "/sounds/special/x_capture.mp3"], // layered
  snare: ["/sounds/special/snare.mp3"],
};

export const SOUND_PACKS: Record<SoundPackId, Pack> = {
  smooth: {
    id: "smooth",
    label: "Smooth",
    description: "Polished digital sounds, with special effects",
    events: {
      move: ["/sounds/smooth/Move.mp3"],
      capture: ["/sounds/smooth/Capture.mp3"],
      castle: ["/sounds/smooth/Move.mp3"],
      result: ["/sounds/smooth/GenericNotify.mp3"],
      ...SPECIAL,
    },
  },
  homegrown: {
    id: "homegrown",
    label: "Homegrown",
    description: "Real chess board recordings, by piece",
    events: {
      move: [1, 2, 3, 4].map((n) => `/sounds/homegrown/move${n}.mp3`),
      capture: [1, 2, 3].map((n) => `/sounds/homegrown/capture${n}.mp3`),
      castle: ["/sounds/homegrown/castle.mp3"],
      result: ["/sounds/homegrown/GenericNotify.mp3"],
    },
    // TODO(recordings): per-piece files go here as they are recorded.
    moveByRole: {},
    captureByRole: {},
  },
};

export const DEFAULT_SOUND_PACK: SoundPackId = "smooth";
const STORAGE_KEY = "soundPack";

// ---------- setting ----------

let currentPack: SoundPackId = readStoredPack();
const listeners = new Set<() => void>();

function readStoredPack(): SoundPackId {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && v in SOUND_PACKS) return v as SoundPackId;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_SOUND_PACK;
}

export function getSoundPack(): SoundPackId {
  return currentPack;
}

export function setSoundPack(id: SoundPackId) {
  currentPack = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  preloadPack(id);
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore. */
export function subscribeSoundPack(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------- engine ----------

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const lastPicked = new Map<string, string>();

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

// Browsers (and iOS especially) keep the context suspended until a user gesture.
function unlock() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}
if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "keydown", "touchend"]) {
    window.addEventListener(ev, unlock, { passive: true });
  }
}

function loadBuffer(url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    p = (async () => {
      const c = getCtx();
      if (!c) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        return await c.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        console.warn("Sound load failed:", url, err);
        buffers.delete(url); // allow retry
        return null;
      }
    })();
    buffers.set(url, p);
  }
  return p;
}

function packUrls(pack: Pack): string[] {
  const all = new Set<string>();
  Object.values(pack.events).forEach((l) => l?.forEach((u) => all.add(u)));
  Object.values(pack.moveByRole ?? {}).forEach((l) => l.forEach((u) => all.add(u)));
  Object.values(pack.captureByRole ?? {}).forEach((l) => l.forEach((u) => all.add(u)));
  return [...all];
}

export function preloadPack(id: SoundPackId = currentPack) {
  packUrls(SOUND_PACKS[id]).forEach((u) => void loadBuffer(u));
}

function pickVariant(key: string, files: string[]): string {
  if (files.length === 1) return files[0];
  // random, but never the same file twice in a row
  const last = lastPicked.get(key);
  const pool = files.length > 1 ? files.filter((f) => f !== last) : files;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  lastPicked.set(key, choice);
  return choice;
}

async function playUrl(url: string) {
  const c = getCtx();
  if (!c) return;
  unlock();
  const buf = await loadBuffer(url);
  if (!buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
}

/**
 * Play a game sound using the active pack.
 * `role` (the moving piece) only matters for packs with per-piece variants.
 */
export function playSound(event: SoundEvent, opts?: { role?: Role; pack?: SoundPackId }) {
  const pack = SOUND_PACKS[opts?.pack ?? currentPack];
  let files: string[] | undefined;
  if (event === "move" && opts?.role) files = pack.moveByRole?.[opts.role];
  if (event === "capture" && opts?.role) files = pack.captureByRole?.[opts.role];
  if (!files?.length) files = pack.events[event];
  if (!files?.length) return; // this pack has no sound for the event

  // Multi-file special events (e.g. archer) are layers; move/capture are variants.
  const layered = event === "archer";
  const key = `${pack.id}:${event}:${opts?.role ?? ""}`;
  if (layered) files.forEach((f) => void playUrl(f));
  else void playUrl(pickVariant(key, files));
}

/** True if the active pack defines a sound for this event (used for effect fallbacks). */
export function packHasSound(event: SoundEvent): boolean {
  return !!SOUND_PACKS[currentPack].events[event]?.length;
}

if (typeof window !== "undefined") preloadPack();
