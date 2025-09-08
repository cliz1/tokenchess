import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

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

// ---------- routes: armies ----------
app.get("/api/armies", authMiddleware, async (req: any, res) => {
  const armies = await prisma.army.findMany({ where: { userId: req.user.id }, orderBy: { updatedAt: "desc" }});
  res.json(armies);
});

app.post("/api/armies", authMiddleware, async (req: any, res) => {
  const { name, data, isPublic } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });
  const army = await prisma.army.create({ data: { name, data: data ?? {}, isPublic: !!isPublic, userId: req.user.id } });
  res.json(army);
});

app.get("/api/armies/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const army = await prisma.army.findUnique({ where: { id }});
  if (!army || army.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
  res.json(army);
});

app.put("/api/armies/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const { name, data, isPublic } = req.body;
  const army = await prisma.army.findUnique({ where: { id }});
  if (!army || army.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.army.update({ where: { id }, data: { name: name ?? army.name, data: data ?? army.data, isPublic: isPublic ?? army.isPublic }});
  res.json(updated);
});

app.delete("/api/armies/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const army = await prisma.army.findUnique({ where: { id }});
  if (!army || army.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
  await prisma.army.delete({ where: { id }});
  res.json({ ok: true });
});

// ---------- start ----------
const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
