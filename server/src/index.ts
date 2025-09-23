import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { WebSocketServer } from "ws";
import http from "http";

const prisma = new PrismaClient();
const app = express();

// Dev: allow Vite + other local frontends. Keeps it explicit and simple.
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// ---------- helpers ----------
function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as any;
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
  // Return drafts in stable order (oldest first) so front-end slots remain consistent.
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
      isActive: isActive ?? draft.isActive,  // NEW
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

// ---------- start ----------
const server = http.createServer(app); // wrap Express

const wss = new WebSocketServer({ server });

type Room = { fen: string; clients: Set<any> };
const rooms: Record<string, Room> = {};

wss.on("connection", (ws) => {
let roomId: string | null = null;

ws.on("message", (msg) => {
  const data = JSON.parse(msg.toString());

  if (data.type === "join") {
    roomId = data.roomId as string;
    if (!rooms[roomId]) rooms[roomId] = { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", clients: new Set() };
    rooms[roomId]!.clients.add(ws);

    ws.send(JSON.stringify({ type: "sync", fen: rooms[roomId]!.fen }));
  }

  if (data.type === "move" && roomId) {
    rooms[roomId]!.fen = data.fen;
    for (const client of rooms[roomId]!.clients) {
      if (client !== ws) {
        client.send(JSON.stringify({ type: "update", fen: data.fen }));
      }
    }
  }
});

ws.on("close", () => {
  if (roomId) {
    rooms[roomId]!.clients.delete(ws);
    if (rooms[roomId]!.clients.size === 0) delete rooms[roomId];
  }
});

});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  console.log(`HTTP + WS server listening on ${port}`);
});
