import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { WebSocketServer } from "ws";
import http from "http";
import { parseSquare} from "chessops/util";
import {parseFen, makeFen} from "chessops/fen";
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
    // create and register the room
    rooms[roomId] = {
      fen,
      clients: new Set(),
      lastMove: undefined,
      ownerId: req.user.id,
      players: [req.user.id],
      createdAt: Date.now(),
    };
    res.json({ roomId, fen});
  } catch (err){
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// ---------- start ----------
const server = http.createServer(app); // wrap Express

const wss = new WebSocketServer({ server });

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Room = { 
  fen: string; 
  clients: Set<any>; 
  lastMove?: [string,string] 
  ownerId?: string;
  players?: string[];
  createdAt?: number;
  concluded?: boolean;
  result?: "Checkmate: 1-0" | "Checkmate: 0-1" | "Stalemate: 1/2-1/2" | "ongoing" | "White Resigns: 0-1" | "Black Resigns: 1-0" | "Agreement: 1/2-1/2";
  rematchVotes?: Set<string>;
  drawVotes?: Set<string>; 
};
const rooms: Record<string, Room> = {};

wss.on("connection", (ws) => {
let roomId: string | null = null;

ws.on("message", async (msg) => {
  const data = JSON.parse(msg.toString());

  if (data.type === "join") {
    try {
      if (data.token){
        const payload = verifyToken(data.token);
        (ws as any).user = { id: payload.id, email: payload.email };

        // fetch username from DB
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (user) {
        (ws as any).user.username = user.username;
        }
      }
    } catch (err) {
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

    //assign player if authenticated and slots available
    const uid = (ws as any).user?.id;
    if (uid) {
      room.players = room.players ?? [];
      if (!room.players.includes(uid)){
        if (room.players.length < 2){
          (ws as any).role = "player";
          (ws as any).playerId = uid;
          if (room.players.length === 0){
            (ws as any).color = "white";
            room.players.push(uid);
          }
          else{
            (ws as any).color = "black"
            room.players.push(uid);
          }
        }
        else{
          (ws as any).role = "spectator";
        }
      }
      else {
        (ws as any).role = "player";
        (ws as any).playerId = uid;
      }
    }
    else {
      (ws as any).role = "spectator";
    }
    room.clients.add(ws);

    // --- broadcast recipient-specific update to everyone after the join for player color ---
    for (const client of room.clients) {
      try {
        const cliRole = (client as any).role ?? "spectator";
        let cliColor: "white" | "black" | undefined = undefined;
        if (cliRole === "player" && room.players) {
          const pid = (client as any).playerId;
          if (room.players[0] === pid) cliColor = "white";
          else if (room.players[1] === pid) cliColor = "black";
        }

        client.send(JSON.stringify({
          type: "update",
          fen: room.fen,
          lastMove: room.lastMove,
          role: cliRole,
          color: cliColor,
          players: room.players?.map(pid => {
          const clientSocket = [...room.clients].find(c => (c as any).playerId === pid);
          return {
            id: pid,
            username: (clientSocket as any)?.user?.username ?? "Unknown"
        };
   })
        }));
      } catch (_) { /* ignore send errors */ }
    }
      ws.send(JSON.stringify({
        type: "sync", 
        fen: room.fen, 
        lastMove: room.lastMove, 
        role: (ws as any).role, 
        color: (ws as any).color, 
        players: room.players?.map(pid => {
        const clientSocket = [...room.clients].find(c => (c as any).playerId === pid);
        return {
          id: pid,
          username: (clientSocket as any)?.user?.username ?? "Unknown"
        };
  })
      }));
        return;
  }

  if (data.type === "move" && roomId) {
    const room = rooms[roomId]!;
    const senderId = (ws as any).playerId;

    // only registered players may send moves
    if (!senderId || !room.players?.includes(senderId)) {
      ws.send(JSON.stringify({ type: "error", message: "not authorized to play move" }));
      return;
    }

    // server-side: require client to send only lastMove (from,to)
    const lastMove = data.lastMove as [string, string] | undefined;
    if (!lastMove || lastMove.length !== 2) {
      ws.send(JSON.stringify({ type: "error", message: "Missing lastMove" }));
      return;
    }

    // parse current canonical FEN from room
    const parsed = parseFen(room.fen);
    if (parsed.isErr) {
      ws.send(JSON.stringify({ type: "error", message: "Server has invalid FEN" }));
      return;
    }

    // build chess state and verify turn/order
    const chess = Chess.fromSetup(parsed.unwrap()).unwrap();

    const whitePlayer = room.players?.[0];
    const blackPlayer = room.players?.[1];
    const expectedPlayerId = chess.turn === "white" ? whitePlayer : blackPlayer;

    if (!expectedPlayerId) {
      if (chess.turn === "black") {
        ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
        return;
      }
      if (senderId !== whitePlayer) {
        ws.send(JSON.stringify({ type: "error", message: "Not authorized for this side" }));
        return;
      }
    } else {
      if (senderId !== expectedPlayerId) {
        ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
        return;
      }
    }

    // parse squares
    const from = parseSquare(lastMove[0]);
    const to = parseSquare(lastMove[1]);
    if (!from || !to) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid move squares" }));
      return;
    }

    const moveObj = { from, to };

    // legality check
    if (!chess.isLegal(moveObj)) {
      ws.send(JSON.stringify({ type: "error", message: "Illegal move" }));
      return;
    }

    chess.play(moveObj);

    room.drawVotes = new Set();

    let gameOver = false;
    let result: "Checkmate: 1-0" | "Checkmate: 0-1" | "Stalemate: 1/2-1/2" | "ongoing" | "Agreement: 1/2-1/2" | "White Resigns: 0-1" | "Black Resigns: 1-0" | undefined;

    if (chess.isCheckmate()){
      gameOver = true;
      if (chess.turn === "black") result = "Checkmate: 1-0";
      else result = "Checkmate: 0-1";
    }
    else if (chess.isStalemate()){
      gameOver = true;
      result = "Stalemate: 1/2-1/2"
    }

    const newFen = makeFen(chess.toSetup());
    room.fen = newFen;
    room.lastMove = lastMove;

    if (gameOver){
      room.concluded = true;
      room.result = result;
// send recipient-specific gameOver (include role/color per client)
     for (const client of room.clients) {
        try {
          const cliRole = (client as any).role ?? "spectator";
          let cliColor: "white" | "black" | undefined = undefined;
          if (cliRole === "player" && room.players) {
            const pid = (client as any).playerId;
            if (room.players[0] === pid) cliColor = "white";
            else if (room.players[1] === pid) cliColor = "black";
          }
          client.send(JSON.stringify({
            type: "gameOver",
            fen: room.fen,
            lastMove: room.lastMove,
            result,
            role: cliRole,
            color: cliColor,
          }));
        } catch (_) { /* ignore send errors */ }
      }
      return;
    }

    for (const client of room.clients) {
          try {
            // compute recipient-specific role/color to include
            const cliRole = (client as any).role ?? "spectator";
            let cliColor: "white" | "black" | undefined = undefined;
            if (cliRole === "player" && room.players) {
              const pid = (client as any).playerId;
              if (room.players[0] === pid) cliColor = "white";
              else if (room.players[1] === pid) cliColor = "black";
            }
            client.send(JSON.stringify({
              type: "update",
              fen: room.fen,
              lastMove: room.lastMove,
              role: cliRole,
              color: cliColor
            }));
          } catch (_) { /* ignore send errors */ }
        }
  }
    if (data.type === "rematch" && roomId) {
    const room = rooms[roomId]!;
    if (!room.concluded) return; // only after game over

    const uid = (ws as any).playerId;
    if (!uid) return;

    room.rematchVotes = room.rematchVotes ?? new Set();
    room.rematchVotes.add(uid);

    if (room.rematchVotes.size === 2) {
      // both agreed -> start new game and swap colors
      const [p1, p2] = room.players!;
      room.players = [p2, p1];
      room.fen = START_FEN;
      room.lastMove = undefined;
      room.concluded = false;
      room.rematchVotes.clear();

      for (const client of room.clients) {
        const pid = (client as any).playerId;
        let cliColor: "white" | "black" | undefined;
        if (pid === room.players[0]) cliColor = "white";
        else if (pid === room.players[1]) cliColor = "black";

        client.send(JSON.stringify({
          type: "newGame",
          fen: room.fen,
          role: (client as any).role,
          color: cliColor,
        }));
      }
    }
  }

  // resignation: a player resigns and the other wins immediately
  if (data.type === "resign" && roomId) {
    const room = rooms[roomId]!;
    if (room.concluded) return; // already finished

    const uid = (ws as any).playerId;
    if (!uid) return;

    // Determine winner: the opponent of uid
    const [p1, p2] = room.players ?? [undefined, undefined];
    let winnerId: string | undefined;
    if (p1 === uid) winnerId = p2;
    else if (p2 === uid) winnerId = p1;

    if (!winnerId) return; // spectators cannot resign a game

    room.drawVotes = new Set();

    room.concluded = true;
    // Determine winner color. Prefer using any connected client's `.color` property
    // (clients have their .color updated on join/rematch). Fallback to players ordering.
    let winnerColor: "white" | "black" | undefined = undefined;
    for (const client of room.clients) {
      try {
        const pid = (client as any).playerId;
        if (pid === winnerId) {
          winnerColor = (client as any).color as any;
          break;
        }
      } catch (_) {}
    }
    if (!winnerColor && room.players) {
      winnerColor = room.players[0] === winnerId ? "white" : "black";
    }
    room.result = winnerColor === "white" ? "Black Resigns: 1-0" : "White Resigns: 0-1";

    for (const client of room.clients) {
      try {
        const cliRole = (client as any).role ?? "spectator";
        let cliColor: "white" | "black" | undefined = undefined;
        if (cliRole === "player" && room.players) {
          const pid = (client as any).playerId;
          if (room.players[0] === pid) cliColor = "white";
          else if (room.players[1] === pid) cliColor = "black";
        }
        client.send(JSON.stringify({
          type: "gameOver",
          fen: room.fen,
          lastMove: room.lastMove,
          result: room.result,
          role: cliRole,
          color: cliColor,
          reason: "resignation",
          winnerId: winnerId,
        }));
      } catch (_) {}
    }
  }

if (data.type === "draw" && roomId) {
  const room = rooms[roomId]!;
  if (room.concluded) return;

  const uid = (ws as any).playerId;
  if (!uid || !room.players?.includes(uid)) return;

  room.drawVotes = room.drawVotes ?? new Set();
  room.drawVotes.add(uid);

  if (room.drawVotes.size === 2) {
    // Both players agreed
    room.concluded = true;
    room.result = "Agreement: 1/2-1/2";

    for (const client of room.clients) {
      try {
        const cliRole = (client as any).role ?? "spectator";
        let cliColor: "white" | "black" | undefined = undefined;
        if (cliRole === "player" && room.players) {
          const pid = (client as any).playerId;
          if (room.players[0] === pid) cliColor = "white";
          else if (room.players[1] === pid) cliColor = "black";
        }
        client.send(JSON.stringify({
          type: "gameOver",
          fen: room.fen,
          lastMove: room.lastMove,
          result: "1/2-1/2",
          role: cliRole,
          color: cliColor,
          reason: "draw-agreement",
        }));
      } catch (_) {}
    }
  }
}


if (data.type === "leave" && roomId) {
  const room = rooms[roomId];
  if (room) {
    // Remove ws from clients set
    room.clients.delete(ws);

    // Remove player ID from players array
    const uid = (ws as any).playerId;
    if (uid && room.players) {
      room.players = room.players.filter((p) => p !== uid);
    }

    // If room is empty, delete it
    if (room.clients.size === 0) {
      delete rooms[roomId];
    }
  }

  // Close the socket regardless of room existence
  ws.close();
}

});

ws.on("close", () => {
  if (roomId && rooms[roomId]) {
    rooms[roomId].clients.delete(ws);
    if (rooms[roomId].clients.size === 0) {
      delete rooms[roomId]; // clean up empty rooms
    }
  }
});

});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  console.log(`HTTP + WS server listening on ${port}`);
});