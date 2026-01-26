import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { parseSquare } from "chessops/util";
import { parseFen, makeFen } from "chessops/fen";
import { Chess } from "chessops";
import path from "path";
import { fileURLToPath } from "url";
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();

// Dev: allow Vite + other local frontends. Keeps it explicit and simple.
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://radiant-haupia-edd849.netlify.app",
      "https://tokenchess.net",
      "https://www.tokenchess.net",
      "http://tokenchess.net",
      "http://www.tokenchess.net",
      "https://ffd2e328.tokenchess.pages.dev",
    ],
    credentials: true,
  }),
);

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// ---------- helpers ----------
function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as any;
}

function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ---------- types & in-memory store ----------
export type RoomStatus = "open" | "playing" | "finished";

type ClockState = {
  initialMs: number;            // e.g. 5 * 60 * 1000
  incrementMs: number;          // e.g. 2000
  whiteMs: number;
  blackMs: number;
  running: "white" | "black" | null;
  lastStartTs: number | null;   // Date.now() when current clock started
};

export type Room = {
  id: string;
  fen: string;
  status: RoomStatus;

  createdAt: number;

  players: string[]; // user IDs
  usernames: Record<string, string>; // uid -> username

  clients: Set<WebSocket>;

  clock?: ClockState;

  // legacy fields
  lastMove?: [string, string];
  ownerId?: string;
  concluded?: boolean;
  result?: RoomResult | string;
  rematchVotes?: Set<string>;
  drawVotes?: Set<string>;
  cleanupTimeout?: NodeJS.Timeout | number;
  scores?: Record<string, number>;

  timeControl?: {
    length: number;    // in minutes
    increment: number; // in seconds
  };

  private?: boolean;

  whitePlayerId?: string;
  blackPlayerId?: string;


};

export const rooms = new Map<string, Room>();

const CLOCK_TICK_MS = 250; // resolution (ms)

setInterval(() => {
  const now = Date.now();

  for (const room of rooms.values()) {
    if (room.status !== "playing") continue;
    const clock = room.clock;
    if (!clock || !clock.running || !clock.lastStartTs) continue;

    const elapsed = now - clock.lastStartTs;

    const remaining =
      clock.running === "white"
        ? clock.whiteMs - elapsed
        : clock.blackMs - elapsed;

    if (remaining > 0) continue;

    // ---- FLAG FALL ----
    const flaggedSide = clock.running;

    clock.whiteMs = Math.max(0, clock.whiteMs);
    clock.blackMs = Math.max(0, clock.blackMs);
    clock.running = null;
    clock.lastStartTs = null;

    room.concluded = true;
    room.status = "finished";

    room.result =
      flaggedSide === "white"
        ? "White flagged: 0-1"
        : "Black flagged: 1-0";


    applyResultToScores(room, room.result, room.whitePlayerId, room.blackPlayerId);
    broadcastLobby();

    sendRoomUpdate(
      room,
      { result: room.result, reason: "time" },
      "gameOver",
    );
  }
}, CLOCK_TICK_MS);


// ---------- lobby helpers ----------
const lobbyClients = new Set<WebSocket>();

function serializeLobby() {
  return [...rooms.values()]
    .filter((r) => (r.status === "open" || r.status === "playing") && !r.private)
    .map((r) => ({
      roomId: r.id,
      owner: r.usernames[r.players[0]] ?? "Unknown",
      createdAt: r.createdAt,
      status: r.status,
      players:
        r.status === "playing"
          ? r.players.map((id) => r.usernames[id] ?? "Unknown")
          : undefined, // only send players if in progress
      timeControl: r.timeControl ?? { length: 10, increment: 0 },
    }));
}

function broadcastLobby() {
  const payload = JSON.stringify({ type: "lobby", rooms: serializeLobby() });
  for (const ws of lobbyClients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

// ---------- auth middleware ----------
function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing auth" });
  const token = auth.slice(7);
  try {
    const data = verifyToken(token);
    req.user = { id: data.id, email: data.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ---------- routes: auth ----------
import { Prisma } from "@prisma/client";

app.post("/api/auth/register", async (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username)
    return res.status(400).json({ error: "Missing email, password, or username" });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ error: "EMAIL_TAKEN" });

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hash, username },
    });

    const token = signToken({ id: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const target = err.meta?.target;

    if (
      (Array.isArray(target) && target.includes("username")) ||
      target === "username"
    ) {
      return res.status(409).json({ error: "USERNAME_TAKEN" });
    }
  }

  console.error(err);
  res.status(500).json({ error: "SERVER_ERROR" });
}

});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body; // <-- login by username
  if (!username || !password)
    return res.status(400).json({ error: "Missing username or password" });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, email: user.email });

  res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
});

app.get("/api/me", authMiddleware, async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, email: user.email, username: user.username });
});

// ---------- routes: drafts (unchanged) ----------
app.get("/api/drafts", authMiddleware, async (req: any, res) => {
  const drafts = await prisma.draft.findMany({
    where: { userId: req.user.id },
    orderBy: { slot: "asc" }, // slot, not createdAt
  });

  res.json(drafts);
});

app.post("/api/drafts", authMiddleware, async (req: any, res) => {
  const { name, data, isPublic, slot } = req.body;

  if (!slot || slot < 1 || slot > 5) {
    return res.status(400).json({ error: "Slot (1–5) is required" });
  }
  if (!name) {
    return res.status(400).json({ error: "Missing name" });
  }

  try {
    const draft = await prisma.draft.create({
      data: {
        slot,
        name,
        data: data ?? {},
        isPublic: !!isPublic,
        isActive: false,
        userId: req.user.id,
      },
    });

    res.json(draft);
  } catch (err: any) {
    // Slot collision → 409 Conflict
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slot already taken" });
    }
    throw err;
  }
});

app.get("/api/drafts/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft || draft.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
  res.json(draft);
});

app.put("/api/drafts/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const { name, data, isPublic, isActive } = req.body;

  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft || draft.userId !== req.user.id) {
    return res.status(404).json({ error: "Not found" });
  }
  if (isActive) {
    await prisma.draft.updateMany({
      where: { userId: req.user.id, NOT: { id } },
      data: { isActive: false },
    });
  }

  const updated = await prisma.draft.update({
    where: { id },
    data: {
      name: name ?? draft.name,
      data: data ?? draft.data,
      isPublic: isPublic ?? draft.isPublic,
      isActive: isActive ?? draft.isActive,
    },
  });

  res.json(updated);
});

app.delete("/api/drafts/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft || draft.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
  await prisma.draft.delete({ where: { id } });
  res.json({ ok: true });
});

// ---------- rooms HTTP API (updated to use Map & lobby) ----------
app.get("/api/rooms/:id", (req, res) => {
  const id = req.params.id;
  const room = rooms.get(id);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json({ roomId: id, players: room.players, createdAt: room.createdAt, result: room.result ?? null });
});

// create room (open room visible in lobby)
app.post("/api/rooms", authMiddleware, async (req: any, res) => {
  try {
    const { length = 10, increment = 0, fen = START_FEN } = req.body ?? {};
    let roomId: string;
    let attempts = 0;
    do {
      roomId = generateRoomCode(6);
      attempts++;
      if (attempts > 10) break;
    } while (rooms.has(roomId));
    if (rooms.has(roomId)) roomId = `${roomId}-${Date.now().toString(36)}`; // fallback to ensure uniqueness

    // fetch username
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const username = dbUser?.username ?? "Unknown";

    // create and register the room
    const room: Room = {
      id: roomId,
      fen,
      status: "open",
      createdAt: Date.now(),
      players: [req.user.id],
      usernames: { [req.user.id]: username },
      clients: new Set(),
      timeControl: { length, increment },
      rematchVotes: new Set(),
      drawVotes: new Set(),
      private: req.body.isPrivate ?? false,
    };

    rooms.set(roomId, room);

    // notify lobby clients
    broadcastLobby();

    res.json({ roomId, fen });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// lobby poll fallback
app.get("/api/lobby", (_req, res) => {
  res.json(serializeLobby());
});

// ---------- start server & websocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Result type preserved from previous code
type RoomResult =
  | "Checkmate: 1-0"
  | "Checkmate: 0-1"
  | "Stalemate: 1/2-1/2"
  | "ongoing"
  | "White Resigns: 0-1"
  | "Black Resigns: 1-0"
  | "Insufficient Material: 1/2-1/2"
  | "Agreement: 1/2-1/2";

// helper: safely award points
function applyResultToScores(room: Room, result: RoomResult | string, whiteId?: string, blackId?: string) {
  if (!whiteId || !blackId) return;
  if (!room.players || room.players.length < 2) return;
  room.scores = room.scores ?? {};

  switch (result) {
    case "Checkmate: 1-0":
    case "Black Resigns: 1-0":
      room.scores[whiteId] = (room.scores[whiteId] ?? 0) + 1;
      room.scores[blackId] = room.scores[blackId] ?? 0;
      break;
    case "Checkmate: 0-1":
    case "White Resigns: 0-1":
      room.scores[whiteId] = room.scores[whiteId] ?? 0;
      room.scores[blackId] = (room.scores[blackId] ?? 0) + 1;
      break;
    case "Agreement: 1/2-1/2":
    case "Insufficient Material: 1/2-1/2":
    case "Stalemate: 1/2-1/2":
      room.scores[whiteId] = (room.scores[whiteId] ?? 0) + 0.5;
      room.scores[blackId] = (room.scores[blackId] ?? 0) + 0.5;
      break;
    case "Black flagged: 1-0":
    room.scores[whiteId] = (room.scores[whiteId] ?? 0) + 1;
    room.scores[blackId] = room.scores[blackId] ?? 0;
    break;

    case "White flagged: 0-1":
    room.scores[whiteId] = room.scores[whiteId] ?? 0;
    room.scores[blackId] = (room.scores[blackId] ?? 0) + 1;
    break;
    default:
      break;
  }
}

// helper: build consistent player list
function serializePlayers(room: Room) {
  return room.players?.map((pid) => ({ id: pid, username: room.usernames?.[pid] ?? "Unknown", score: room.scores?.[pid] ?? 0 }));
}

// helper: broadcast a room update to all clients, computing role/color per-client from room.players
function sendRoomUpdate(
  room: Room,
  payload: { fen?: string; lastMove?: [string, string]; result?: RoomResult | string; reason?: string } = {},
  msgType: "update" | "gameOver" | "newGame" | "sync" = "update",
) {
  for (const client of room.clients) {
    const pid = (client as any).playerId as string | undefined;
    const isPlayer = !!(pid && room.players?.includes(pid));
    const cliColor = isPlayer ? pid === room.whitePlayerId ? "white" : pid === room.blackPlayerId? "black": undefined: undefined;

    const out = {
      type: msgType,
      fen: payload.fen ?? room.fen,
      lastMove: payload.lastMove ?? room.lastMove,
      result: payload.result ?? room.result,
      role: isPlayer ? "player" : "spectator",
      color: cliColor,
      players: serializePlayers(room),
      scores: room.scores,
      reason: payload.reason,
      clock: room.clock? {
        whiteMs: room.clock.whiteMs,
        blackMs: room.clock.blackMs,
        running: room.clock.running,
        lastStartTs: room.clock.lastStartTs,
        initialMs: room.clock.initialMs,
        incrementMs: room.clock.incrementMs
      }
    : undefined,
      rematchOffers: room.rematchVotes ? Array.from(room.rematchVotes) : [],
      drawOffers: room.drawVotes ? Array.from(room.drawVotes) : [],
    } as any;

    try {
      client.send(JSON.stringify(out));
    } catch (e) {
      // ignore send errors; closed sockets will be removed by close handler
      console.warn("Failed to send room update to client", e);
    }
  }
}

wss.on("connection", (ws: WebSocket, req) => {
  let roomId: string | null = null;

  // cleanup closed sockets from room.clients and schedule room deletion with grace period
  ws.on("close", () => {
    // remove from lobby clients (if present)
    lobbyClients.delete(ws);

    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    room.clients.delete(ws);

    if (room.clients.size === 0) {
      if (room.cleanupTimeout) clearTimeout(room.cleanupTimeout as NodeJS.Timeout);
      // schedule deletion after 30s grace
      room.cleanupTimeout = setTimeout(() => {
        rooms.delete(roomId!);
        // update lobby since an open room might have been removed
        broadcastLobby();
      }, 30_000);
    }
  });

  ws.on("message", async (msg) => {
    let data: any;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "invalid-json" }));
      return;
    }

    // ---------- LOBBY JOIN (ws channel for lobby updates) ----------
    if (data.type === "lobby-join") {
      lobbyClients.add(ws);
      ws.send(JSON.stringify({ type: "lobby", rooms: serializeLobby() }));
      return;
    }

    // ---------- JOIN ----------
    if (data.type === "join") {
      try {
        if (data.token) {
          const payload = verifyToken(data.token);
          (ws as any).user = { id: payload.id, email: payload.email };
          const user = await prisma.user.findUnique({ where: { id: payload.id } });
          if (user) (ws as any).user.username = user.username;
        }
      } catch {
        console.warn("Invalid token on join");
      }

      const requestedId = data.roomId as string;
      if (!requestedId) {
        ws.send(JSON.stringify({ type: "error", message: "Missing roomId" }));
        return;
      }
      if (!rooms.has(requestedId)) {
        ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        return;
      }

      roomId = requestedId;
      const room = rooms.get(roomId)!;

      // ensure clients set and arrays exist
      room.clients = room.clients ?? new Set();
      room.players = room.players ?? [];
      room.usernames = room.usernames ?? {};
      room.scores = room.scores ?? {};

      if (room.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout as NodeJS.Timeout);
        room.cleanupTimeout = undefined;
      }

      // assign player / spectator role based on token uid
      const uid = (ws as any).user?.id as string | undefined;

      if (uid) {
        // if uid already present in players array, reattach to that slot
        if (room.players.includes(uid)) {
          (ws as any).playerId = uid;
        } else if (room.players.length < 2) {
          // claim next available slot
          (ws as any).playerId = uid;
          room.players.push(uid);
          // when second player joins, transition to playing
          if (room.players.length === 2 && room.status === "open") {
            room.status = "playing";
            const { length, increment } = room.timeControl ?? { length: 10, increment: 0 };
            room.clock = {
            initialMs: length * 60 * 1000,
            incrementMs: increment * 1000,
            whiteMs: length * 60 * 1000,
            blackMs: length * 60 * 1000,
            running: null,
            lastStartTs: null,
          };

            // compute start fen from drafts 
            try {
              const [p1, p2] = room.players;
              const bit = Math.floor(Math.random() * 2);
              room.whitePlayerId = bit === 0 ? p1 : p2;
              room.blackPlayerId = bit === 0 ? p2 : p1;
              const { normalFen } = await getCombinedStartFens(room.whitePlayerId, room.blackPlayerId);
              room.fen = normalFen
            } catch (err) {
              // keep existing fen (usually START_FEN)
              console.warn("Failed to compute combined start fen for rematch/start:", err);
            }
            broadcastLobby();
          }
        } else {
          // full -> spectator
          (ws as any).playerId = undefined;
        }
        if ((ws as any).user?.username) room.usernames[uid] = (ws as any).user.username;
      } else {
        (ws as any).playerId = undefined;
      }

      // Close any previous socket that belonged to the same playerId (avoid duplicates)
      if ((ws as any).playerId) {
        const pid = (ws as any).playerId;
        for (const client of Array.from(room.clients)) {
          const clientPid = (client as any).playerId as string | undefined;
          if (client !== ws && clientPid && clientPid === pid) {
            try {
              client.close();
            } catch {}
            room.clients.delete(client);
          }
        }
      }

      // Add the new ws to the room clients
      room.clients.add(ws);

      // Broadcast update to all clients (computes role/color from room.players)
      sendRoomUpdate(room, {}, "update");

      // Send sync specifically to joining client with their role/color
      {
        const pid = (ws as any).playerId as string | undefined;
        const isPlayer = !!(pid && room.players?.includes(pid));
        const cliColor = isPlayer ? pid === room.whitePlayerId ? "white" : pid === room.blackPlayerId? "black": undefined: undefined;
        ws.send(
          JSON.stringify({
            type: "sync",
            fen: room.fen,
            lastMove: room.lastMove,
            result: room.result,
            role: isPlayer ? "player" : "spectator",
            color: cliColor,
            players: serializePlayers(room),
            scores: room.scores,
            clock: room.clock
            ? {
                whiteMs: room.clock.whiteMs,
                blackMs: room.clock.blackMs,
                running: room.clock.running,
                lastStartTs: room.clock.lastStartTs,
                initialMs: room.clock.initialMs,
                incrementMs: room.clock.incrementMs,
              }
            : undefined,
            rematchOffers: room.rematchVotes ? Array.from(room.rematchVotes) : [],
            drawOffers: room.drawVotes ? Array.from(room.drawVotes) : [],
          }),
        );
      }

      return;
    }

    // ---------- MOVE ----------
    if (data.type === "move" && roomId) {
      const room = rooms.get(roomId)!;
      if (room.concluded) return;
      // Start the clock on first move
      if (room.clock && room.clock.running === null) {
        room.clock.running = "white";
        room.clock.lastStartTs = Date.now();
      }
      const senderId = (ws as any).playerId;
      if (!senderId || !room.players?.includes(senderId)) return;

      // Support promotion: [from, to, promotion?]
      const lastMove = data.lastMove as [string, string, string?];
      if (!lastMove) return;

      const parsed = parseFen(room.fen);
      if (parsed.isErr) return;
      const chess = Chess.fromSetup(parsed.unwrap()).unwrap();

      const whiteId = room.whitePlayerId;
      const blackId = room.blackPlayerId;
      const expected = chess.turn === "white" ? whiteId : blackId;
      if (senderId !== expected) return;

      const [fromStr, toStr, promotion] = lastMove;
      const from = parseSquare(fromStr);
      const to = parseSquare(toStr);
      if (from == null || to == null) return;

      const moveObj: any = { from, to };
      if (typeof promotion === "string") moveObj.promotion = promotion;
      if (!chess.isLegal(moveObj)) return;

      // clear draw votes every move
      room.drawVotes = new Set();

      chess.play(moveObj);
      // ----- CLOCK UPDATE -----
      const sideToMove = room.clock?.running;
      const flagged = applyClockAfterMove(room);

      if (flagged) {
        freezeClock(room);
        room.concluded = true;
        room.status = "finished";

        room.result =
          sideToMove === "white"
            ? "White flagged: 0-1"
            : "Black flagged: 1-0";
          
        room.drawVotes = new Set();
        room.rematchVotes = new Set();

        applyResultToScores(room, room.result, room.whitePlayerId, room.blackPlayerId);
        broadcastLobby();
        sendRoomUpdate(room, { result: room.result, reason: "time" }, "gameOver");
        return;
      }
      room.drawVotes = new Set();
      let gameOver = false;
      let result: RoomResult | string = "ongoing";

      if (chess.isCheckmate()) {
        gameOver = true;
        result = chess.turn === "black" ? "Checkmate: 1-0" : "Checkmate: 0-1";
      } else if (chess.isStalemate()) {
        gameOver = true;
        result = "Stalemate: 1/2-1/2";
      }
      else if (chess.isInsufficientMaterial()){
        gameOver = true;
        result = "Insufficient Material: 1/2-1/2";
      }

      room.fen = makeFen(chess.toSetup());
      room.lastMove = [fromStr, toStr];

      if (gameOver) {
        freezeClock(room);
        room.concluded = true;
        room.result = result;
        room.drawVotes = new Set();
        room.rematchVotes = new Set();
        applyResultToScores(room, room.result, room.whitePlayerId, room.blackPlayerId);
        // when a game finishes, mark finished and update lobby
        room.status = "finished";
        broadcastLobby();
        sendRoomUpdate(room, { fen: room.fen, lastMove: room.lastMove, result }, "gameOver");
        return;
      }

      sendRoomUpdate(room, { fen: room.fen, lastMove: room.lastMove }, "update");
      return;
    }

    // ---------- REMATCH ----------
    if (data.type === "rematch" && roomId) {
      const room = rooms.get(roomId)!;
      if (!room.concluded) return;

      const uid = (ws as any).playerId;
      if (!uid) return;

      room.rematchVotes = room.rematchVotes ?? new Set();
      room.rematchVotes.add(uid);

      if (room.rematchVotes.size !== 2) {
        sendRoomUpdate(room, {}, "update");
        return;
      }

      const prevWhite = room.whitePlayerId!;
      const prevBlack = room.blackPlayerId!;

      // swap colors
      room.whitePlayerId = prevBlack;
      room.blackPlayerId = prevWhite;
      

      // RECOMPUTE FEN FROM ACTIVE DRAFTS
      let startFen: string;
      try {
        const { normalFen } = await getCombinedStartFens(room.whitePlayerId, room.blackPlayerId);
        // alternate orientation implicitly via player order
        startFen = normalFen;
      } catch (err) {
        console.error("Failed to compute start FEN:", err);
        startFen = START_FEN;
      }

      room.fen = startFen;
      room.lastMove = undefined;
      room.concluded = false;
      room.result = undefined;

      room.rematchVotes.clear();
      room.drawVotes = new Set();

      // set status back to playing
      room.status = "playing";
      const INITIAL_MS = room.timeControl.length * 60 * 1000;
      const INCREMENT_MS = 0;

      room.clock = {
        initialMs: INITIAL_MS,
        incrementMs: INCREMENT_MS,
        whiteMs: INITIAL_MS,
        blackMs: INITIAL_MS,
        running: null,
        lastStartTs: null,
      };

      broadcastLobby();

      sendRoomUpdate(room, { fen: room.fen }, "newGame");
      return;
    }

    // ---------- RESIGN ----------
    if (data.type === "resign" && roomId) {
      const room = rooms.get(roomId)!;
      if (room.concluded) return;
      const uid = (ws as any).playerId;
      if (!uid) return;

      const [p1, p2] = room.players ?? [];
      const winnerId = uid === p1 ? p2 : p1;
      if (!winnerId) return;

      const winnerColor: "white" | "black" = room.whitePlayerId === winnerId ? "white" : "black";
      freezeClock(room);
      room.result = winnerColor === "white" ? "Black Resigns: 1-0" : "White Resigns: 0-1";
      room.concluded = true;

      room.drawVotes = new Set();
      room.rematchVotes = new Set();

      // Apply result to scores
      applyResultToScores(room, room.result, room.whitePlayerId, room.blackPlayerId);

      // mark finished in lobby
      room.status = "finished";
      broadcastLobby();

      sendRoomUpdate(room, { fen: room.fen, lastMove: room.lastMove, result: room.result, reason: "resignation" }, "gameOver");
      return;
    }

    // ---------- DRAW ----------
    if (data.type === "draw" && roomId) {
      const room = rooms.get(roomId)!;
      if (room.concluded) return;
      const uid = (ws as any).playerId;
      if (!uid || !room.players?.includes(uid)) return;

      room.drawVotes = room.drawVotes ?? new Set();
      room.drawVotes.add(uid);

      if (room.drawVotes.size !== 2) {
        sendRoomUpdate(room, {}, "update");
        return;
      }

      if (room.drawVotes.size === 2) {
        room.concluded = true;
        freezeClock(room);
        room.result = "Agreement: 1/2-1/2";

        // Apply draw points using stable ids
        applyResultToScores(room, room.result, room.whitePlayerId, room.blackPlayerId);

        room.drawVotes = new Set();
        room.rematchVotes = new Set();

        // mark finished
        room.status = "finished";
        broadcastLobby();

        sendRoomUpdate(room, { fen: room.fen, lastMove: room.lastMove, result: room.result, reason: "draw-agreement" }, "gameOver");
      }
      return;
    }

    // ---------- LEAVE / CLEANUP ----------
    if (data.type === "leave" && roomId) {
      const room = rooms.get(roomId);
      if (!room) return;

      // remove this socket from the clients
      room.clients.delete(ws);

      const uid = (ws as any).playerId;
      if (uid && room.players) {
        // explicit leave: remove player from the players list and usernames mapping
        room.players = room.players.filter((p) => p !== uid);
        delete room.usernames?.[uid];
      }

      if (room.clients.size === 0) {
        if (room.cleanupTimeout) clearTimeout(room.cleanupTimeout as NodeJS.Timeout);
        room.cleanupTimeout = setTimeout(() => {
          rooms.delete(roomId!);
          broadcastLobby();
        }, 30_000);
      } else {
        sendRoomUpdate(room, {}, "update");
      }

      try {
        ws.close();
      } catch {}
      return;
    }
  });
});

const port = Number(process.env.PORT) || 4000;

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});

// ---------- helpers continued: combine drafts into a start FEN ----------
async function getCombinedStartFens(player1Id: string, player2Id: string) {
  const drafts = await prisma.draft.findMany({
    where: { userId: { in: [player1Id, player2Id] }, isActive: true },
    select: { userId: true, data: true },
  });

  if (drafts.length !== 2) {
    throw new Error("Both players must have an active draft");
  }

  const fens: Record<string, string> = {};
  for (const draft of drafts) {
    const data = draft.data as { fen?: unknown } | null;
    if (!data || typeof data.fen !== "string") {
      throw new Error(`Draft for user ${draft.userId} does not contain a valid FEN`);
    }
    fens[draft.userId] = data.fen;
  }

  const fenA = fens[player1Id];
  const fenB = fens[player2Id];

  // helper to extract last 2 rows from a player's fen
  function extractWhiteRows(fen: string) {
    const placement = fen.split(" ")[0];
    const rows = placement.split("/");
    if (rows.length !== 8) throw new Error("Invalid FEN (expected 8 ranks)");
    return rows.slice(-2);
  }

  const whiteRowsA = extractWhiteRows(fenA);
  const whiteRowsB = extractWhiteRows(fenB);

  // helper to lowercase + reverse the *order* of two rows (not the string characters)
  function mirrorAndLower(rows: string[]) {
    return rows.slice().reverse().map((r) => r.toLowerCase());
  }

  // --- Normal color version ---
  const normalBlackTop = mirrorAndLower(whiteRowsB);
  const normalWhiteBottom = whiteRowsA;

  const normalCombined = [...normalBlackTop, "8", "8", "8", "8", ...normalWhiteBottom].join("/");
  const normalFen = `${normalCombined} w KQkq - 0 1`;

  // --- Reversed color version ---
  const reversedBlackTop = mirrorAndLower(whiteRowsA);
  const reversedWhiteBottom = whiteRowsB;

  const reversedCombined = [...reversedBlackTop, "8", "8", "8", "8", ...reversedWhiteBottom].join("/");
  const reversedFen = `${reversedCombined} w KQkq - 0 1`;

  return { normalFen, reversedFen };
}

// clock helpers
function applyClockAfterMove(room: Room): boolean {
  const clock = room.clock;
  if (!clock || !clock.running || !clock.lastStartTs) return false;

  const now = Date.now();
  const elapsed = now - clock.lastStartTs;

  if (clock.running === "white") {
    clock.whiteMs -= elapsed;
    clock.whiteMs += clock.incrementMs;
    if (clock.whiteMs <= 0) return true; // flag fall
  } else {
    clock.blackMs -= elapsed;
    clock.blackMs += clock.incrementMs;
    if (clock.blackMs <= 0) return true; // flag fall
  }

  clock.running = clock.running === "white" ? "black" : "white";
  clock.lastStartTs = now;

  return false;
}

function freezeClock(room: Room) {
  if (!room.clock) return;
  room.clock.running = null;
  room.clock.lastStartTs = null;
}



