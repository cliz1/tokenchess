import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { WebSocketServer } from "ws";
import http from "http";
import { parseSquare } from "chessops/util";
import { parseFen, makeFen } from "chessops/fen";
import { Chess } from "chessops";

const prisma = new PrismaClient();
const app = express();

// Dev: allow Vite + other local frontends. Keeps it explicit and simple.
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

// ---------- auth middleware ----------
function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing auth" });
  const token = auth.slice(7);
  try {
    const data = verifyToken(token);
    req.user = { id: data.id, email: data.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---------- routes: auth ----------
app.post("/api/auth/register", async (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username)
    return res.status(400).json({ error: "Missing email, password, or username" });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hash, username },
    });

    const token = signToken({ id: user.id, email: user.email });

    res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
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

// ---------- routes: drafts ----------
app.get("/api/drafts", authMiddleware, async (req: any, res) => {
  const drafts = await prisma.draft.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "asc" },
  });
  res.json(drafts);
});


app.post("/api/drafts", authMiddleware, async (req: any, res) => {
  const { name, data, isPublic } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  const draft = await prisma.draft.create({
    data: {
      name,
      data: data ?? {},
      isPublic: !!isPublic,
      isActive: false,   // default false on creation
      userId: req.user.id,
    },
  });

  res.json(draft);
});


app.get("/api/drafts/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const draft = await prisma.draft.findUnique({ where: { id }});
  if (!draft || draft.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
  res.json(draft);
});

app.put("/api/drafts/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const { name, data, isPublic, isActive } = req.body;

  const draft = await prisma.draft.findUnique({ where: { id }});
  if (!draft || draft.userId !== req.user.id) return res.status(404).json({ error: "Not found" });

  // If this draft is being set active, deactivate all others for this user
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
  const draft = await prisma.draft.findUnique({ where: { id }});
  if (!draft || draft.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
  await prisma.draft.delete({ where: { id }});
  res.json({ ok: true });
});

app.post("/api/rooms", authMiddleware, async (req: any, res) => {
  try {
    const { length = 6, fen = START_FEN } = req.body ?? {};
    let roomId: string;
    let attempts = 0;
    do {
      roomId = generateRoomCode(length);
      attempts++;
      if (attempts > 10) break;
    } while (rooms[roomId]);
    if (rooms[roomId]) roomId = `${roomId}-${Date.now().toString(36)}`; // fallback to ensure uniqueness

    // fetch username
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const username = dbUser?.username ?? "Unknown";

    // create and register the room
    rooms[roomId] = {
      fen,
      clients: new Set(),
      lastMove: undefined,
      ownerId: req.user.id,
      players: [req.user.id],
      usernames: { [req.user.id]: username }, 
      createdAt: Date.now(),
    };
    res.json({ roomId, fen});
  } catch (err){
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- start ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

type Room = {
  fen: string;
  clients: Set<any>;
  lastMove?: [string, string];
  ownerId?: string;
  players?: string[];
  usernames?: Record<string, string>;
  createdAt?: number;
  concluded?: boolean;
  result?: RoomResult;
  rematchVotes?: Set<string>;
  drawVotes?: Set<string>;
  cleanupTimeout?: NodeJS.Timeout | number;
  scores?: Record<string, number>;
};

type RoomResult =
  | "Checkmate: 1-0"
  | "Checkmate: 0-1"
  | "Stalemate: 1/2-1/2"
  | "ongoing"
  | "White Resigns: 0-1"
  | "Black Resigns: 1-0"
  | "Agreement: 1/2-1/2";

const rooms: Record<string, Room> = {};

// helper: safely award points
function applyResultToScores(room: Room, result: RoomResult, whiteId?: string, blackId?: string) {
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
    case "Stalemate: 1/2-1/2":
      room.scores[whiteId] = (room.scores[whiteId] ?? 0) + 0.5;
      room.scores[blackId] = (room.scores[blackId] ?? 0) + 0.5;
      break;
    default:
      break;
  }
}

// helper: build consistent player list
function serializePlayers(room: Room) {
  return room.players?.map((pid) => ({
    id: pid,
    username: room.usernames?.[pid] ?? "Unknown",
    score: room.scores?.[pid] ?? 0,
  }));
}

wss.on("connection", (ws) => {
  let roomId: string | null = null;

  ws.on("message", async (msg) => {
    let data: any;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "invalid-json" }));
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
      if (!rooms[requestedId]) {
        ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        return;
      }

      roomId = requestedId;
      const room = rooms[roomId]!;

      if (room.cleanupTimeout) clearTimeout(room.cleanupTimeout as NodeJS.Timeout);

      // ensure scores exist
      room.scores = room.scores ?? {};

      // assign player / spectator role
      const uid = (ws as any).user?.id;
      room.players = room.players ?? [];
      room.usernames = room.usernames ?? {};

      if (uid) {
        if (room.players.includes(uid)) {
          (ws as any).role = "player";
          (ws as any).playerId = uid;
          const idx = room.players.indexOf(uid);
          (ws as any).color = idx === 0 ? "white" : idx === 1 ? "black" : undefined;
        } else if (room.players.length < 2) {
          (ws as any).role = "player";
          (ws as any).playerId = uid;
          (ws as any).color = room.players.length === 0 ? "white" : "black";
          room.players.push(uid);
        } else {
          (ws as any).role = "spectator";
        }
        if ((ws as any).user?.username) room.usernames[uid] = (ws as any).user.username;
      } else {
        (ws as any).role = "spectator";
      }

      room.clients.add(ws);

      // broadcast update to all 
      for (const client of room.clients) {
        const cliRole = (client as any).role ?? "spectator";
        let cliColor: "white" | "black" | undefined;
        if (cliRole === "player") {
          const pid = (client as any).playerId;
          if (room.players?.[0] === pid) cliColor = "white";
          else if (room.players?.[1] === pid) cliColor = "black";
        }
        client.send(
          JSON.stringify({
            type: "update",
            fen: room.fen,
            lastMove: room.lastMove,
            role: cliRole,
            color: cliColor,
            players: serializePlayers(room),
            scores: room.scores,
          }),
        );
      }

      ws.send(
        JSON.stringify({
          type: "sync",
          fen: room.fen,
          lastMove: room.lastMove,
          result: room.result,
          role: (ws as any).role,
          color: (ws as any).color,
          players: serializePlayers(room),
          scores: room.scores,
        }),
      );
      return;
    }

    // ---------- MOVE ----------
    if (data.type === "move" && roomId) {
      const room = rooms[roomId]!;
      const senderId = (ws as any).playerId;
      if (!senderId || !room.players?.includes(senderId)) return;

      const lastMove = data.lastMove as [string, string];
      if (!lastMove) return;

      const parsed = parseFen(room.fen);
      if (parsed.isErr) return;
      const chess = Chess.fromSetup(parsed.unwrap()).unwrap();

      const whiteId = room.players?.[0];
      const blackId = room.players?.[1];
      const expected = chess.turn === "white" ? whiteId : blackId;
      if (senderId !== expected) return;

      const from = parseSquare(lastMove[0]);
      const to = parseSquare(lastMove[1]);
      if (!from || !to) return;
      const moveObj = { from, to };
      if (!chess.isLegal(moveObj)) return;

      chess.play(moveObj);
      room.drawVotes = new Set();
      let gameOver = false;
      let result: RoomResult = "ongoing";

      if (chess.isCheckmate()) {
        gameOver = true;
        result = chess.turn === "black" ? "Checkmate: 1-0" : "Checkmate: 0-1";
      } else if (chess.isStalemate()) {
        gameOver = true;
        result = "Stalemate: 1/2-1/2";
      }

      room.fen = makeFen(chess.toSetup());
      room.lastMove = lastMove;

      if (gameOver) {
        room.concluded = true;
        room.result = result;

        // Apply scores using the stable white/black IDs from room.players
        applyResultToScores(room, room.result, whiteId, blackId);

        for (const client of room.clients) {
          const cliRole = (client as any).role ?? "spectator";
          let cliColor: "white" | "black" | undefined;
          if (cliRole === "player") {
            const pid = (client as any).playerId;
            if (room.players?.[0] === pid) cliColor = "white";
            else if (room.players?.[1] === pid) cliColor = "black";
          }
          client.send(
            JSON.stringify({
              type: "gameOver",
              fen: room.fen,
              lastMove: room.lastMove,
              result,
              role: cliRole,
              color: cliColor,
              players: serializePlayers(room),
              scores: room.scores,
            }),
          );
        }
        return;
      }

      // normal update 
      for (const client of room.clients) {
        const cliRole = (client as any).role ?? "spectator";
        let cliColor: "white" | "black" | undefined;
        if (cliRole === "player") {
          const pid = (client as any).playerId;
          if (room.players?.[0] === pid) cliColor = "white";
          else if (room.players?.[1] === pid) cliColor = "black";
        }
        client.send(
          JSON.stringify({
            type: "update",
            fen: room.fen,
            lastMove: room.lastMove,
            role: cliRole,
            color: cliColor,
            players: serializePlayers(room),
            scores: room.scores,
          }),
        );
      }
      return;
    }

    // ---------- REMATCH ----------
    if (data.type === "rematch" && roomId) {
      const room = rooms[roomId]!;
      if (!room.concluded) return;

      const uid = (ws as any).playerId;
      if (!uid) return;

      room.rematchVotes = room.rematchVotes ?? new Set();
      room.rematchVotes.add(uid);

      if (room.rematchVotes.size === 2) {
        const [p1, p2] = room.players!;
        room.players = [p2, p1];
        room.fen = START_FEN;
        room.lastMove = undefined;
        room.concluded = false;
        room.result = "ongoing";
        room.rematchVotes.clear();

        for (const client of room.clients) {
          const pid = (client as any).playerId;
          let cliColor: "white" | "black" | undefined;
          if (pid === room.players[0]) cliColor = "white";
          else if (pid === room.players[1]) cliColor = "black";

          client.send(
            JSON.stringify({
              type: "newGame",
              fen: room.fen,
              role: (client as any).role,
              color: cliColor,
              players: serializePlayers(room),
              scores: room.scores,
            }),
          );
        }
      }
      return;
    }

    // ---------- RESIGN ----------
    if (data.type === "resign" && roomId) {
      const room = rooms[roomId]!;
      if (room.concluded) return;
      const uid = (ws as any).playerId;
      if (!uid) return;

      const [p1, p2] = room.players ?? [];
      const winnerId = uid === p1 ? p2 : p1;
      if (!winnerId) return;

      let winnerColor: "white" | "black" =
        room.players?.[0] === winnerId ? "white" : "black";
      room.result =
        winnerColor === "white" ? "Black Resigns: 1-0" : "White Resigns: 0-1";
      room.concluded = true;

      // Pass the stable white/black ids to the score helper
      applyResultToScores(room, room.result, room.players?.[0], room.players?.[1]);

      for (const client of room.clients) {
        const cliRole = (client as any).role ?? "spectator";
        let cliColor: "white" | "black" | undefined;
        if (cliRole === "player") {
          const pid = (client as any).playerId;
          if (room.players?.[0] === pid) cliColor = "white";
          else if (room.players?.[1] === pid) cliColor = "black";
        }
        client.send(
          JSON.stringify({
            type: "gameOver",
            fen: room.fen,
            lastMove: room.lastMove,
            result: room.result,
            role: cliRole,
            color: cliColor,
            reason: "resignation",
            players: serializePlayers(room),
            scores: room.scores, 
          }),
        );
      }
      return;
    }

    // ---------- DRAW ----------
    if (data.type === "draw" && roomId) {
      const room = rooms[roomId]!;
      if (room.concluded) return;
      const uid = (ws as any).playerId;
      if (!uid || !room.players?.includes(uid)) return;

      room.drawVotes = room.drawVotes ?? new Set();
      room.drawVotes.add(uid);
      if (room.drawVotes.size === 2) {
        room.concluded = true;
        room.result = "Agreement: 1/2-1/2";

        // Apply draw points using stable id
        applyResultToScores(room, room.result, room.players?.[0], room.players?.[1]);

        for (const client of room.clients) {
          const cliRole = (client as any).role ?? "spectator";
          let cliColor: "white" | "black" | undefined;
          if (cliRole === "player") {
            const pid = (client as any).playerId;
            if (room.players?.[0] === pid) cliColor = "white";
            else if (room.players?.[1] === pid) cliColor = "black";
          }
          client.send(
            JSON.stringify({
              type: "gameOver",
              fen: room.fen,
              lastMove: room.lastMove,
              result: "1/2-1/2",
              role: cliRole,
              color: cliColor,
              reason: "draw-agreement",
              players: serializePlayers(room),
              scores: room.scores,
            }),
          );
        }
      }
      return;
    }

    // ---------- LEAVE / CLEANUP ----------
    if (data.type === "leave" && roomId) {
      const room = rooms[roomId];
      if (!room) return;
      room.clients.delete(ws);

      const uid = (ws as any).playerId;
      if (uid && room.players) {
        room.players = room.players.filter((p) => p !== uid);
        delete room.usernames?.[uid];
      }

      if (room.clients.size === 0) {
        delete rooms[roomId];
      } else {
        for (const client of room.clients) {
          const cliRole = (client as any).role ?? "spectator";
          let cliColor: "white" | "black" | undefined;
          if (cliRole === "player") {
            const pid = (client as any).playerId;
            if (room.players?.[0] === pid) cliColor = "white";
            else if (room.players?.[1] === pid) cliColor = "black";
          }
          client.send(
            JSON.stringify({
              type: "update",
              fen: room.fen,
              lastMove: room.lastMove,
              role: cliRole,
              color: cliColor,
              players: serializePlayers(room),
              scores: room.scores,
            }),
          );
        }
      }
      try {
        ws.close();
      } catch {}
      return;
    }
  });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`HTTP + WS server listening on ${port}`));
// ---------- end ----------
