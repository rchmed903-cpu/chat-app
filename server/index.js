const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "https://chat-app-iota-seven-33.vercel.app",
];

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_change_in_production";
const MONGO_URL = process.env.MONGO_URL;
const PORT = process.env.PORT || 3001;

// ─── MongoDB ───────────────────────────────────
let db;
async function connectDB() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db("chatapp");
  console.log("✅ Connected to MongoDB");
}

// ─── In-memory online tracking ─────────────────
const onlineUsers = new Map(); // socketId → { userId, username }

function getRoomId(id1, id2) {
  return [id1, id2].sort().join("_");
}

// ─── Auth middleware ───────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ─── Routes ────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  const existing = await db.collection("users").findOne({ username });
  if (existing) return res.status(409).json({ error: "Username already taken" });

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.collection("users").insertOne({
    username,
    passwordHash,
    createdAt: new Date(),
  });

  const id = result.insertedId.toString();
  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id, username } });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.collection("users").findOne({ username });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const id = user._id.toString();
  const token = jwt.sign({ id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id, username: user.username } });
});

app.get("/api/users", authMiddleware, async (req, res) => {
  const users = await db.collection("users")
    .find({ _id: { $ne: new ObjectId(req.user.id) } })
    .project({ username: 1 })
    .toArray();

  const result = users.map((u) => ({
    id: u._id.toString(),
    username: u.username,
    isOnline: [...onlineUsers.values()].some((o) => o.userId === u._id.toString()),
  }));

  res.json(result);
});

app.get("/api/messages/:userId", authMiddleware, async (req, res) => {
  const roomId = getRoomId(req.user.id, req.params.userId);
  const msgs = await db.collection("messages")
    .find({ roomId })
    .sort({ timestamp: 1 })
    .toArray();

  res.json(msgs.map((m) => ({
    id: m._id.toString(),
    senderId: m.senderId,
    senderUsername: m.senderUsername,
    content: m.content,
    timestamp: m.timestamp,
  })));
});

// ─── Socket.io ─────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Auth error"));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("Auth error"));
  }
});

io.on("connection", (socket) => {
  const { id: userId, username } = socket.user;
  onlineUsers.set(socket.id, { userId, username });
  console.log(`✅ ${username} connected`);
  io.emit("users:online", [...onlineUsers.values()].map((u) => u.userId));

  socket.on("room:join", async (otherUserId) => {
    const roomId = getRoomId(userId, otherUserId);
    socket.join(roomId);
    const msgs = await db.collection("messages")
      .find({ roomId })
      .sort({ timestamp: 1 })
      .toArray();
    socket.emit("room:history", msgs.map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId,
      senderUsername: m.senderUsername,
      content: m.content,
      timestamp: m.timestamp,
    })));
  });

  socket.on("message:send", async ({ toUserId, content }) => {
    if (!content?.trim()) return;
    const roomId = getRoomId(userId, toUserId);
    const message = {
      roomId,
      senderId: userId,
      senderUsername: username,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    const result = await db.collection("messages").insertOne(message);
    const msg = { ...message, id: result.insertedId.toString() };
    io.to(roomId).emit("message:receive", { roomId, message: msg });
  });

  socket.on("typing:start", ({ toUserId }) => {
    const roomId = getRoomId(userId, toUserId);
    socket.to(roomId).emit("typing:update", { userId, isTyping: true });
  });

  socket.on("typing:stop", ({ toUserId }) => {
    const roomId = getRoomId(userId, toUserId);
    socket.to(roomId).emit("typing:update", { userId, isTyping: false });
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    console.log(`❌ ${username} disconnected`);
    io.emit("users:online", [...onlineUsers.values()].map((u) => u.userId));
  });
});

// ─── Start ─────────────────────────────────────
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("❌ MongoDB connection failed:", err);
  process.exit(1);
});
