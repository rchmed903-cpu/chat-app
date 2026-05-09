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
let client;

async function connectDB() {
  if (!MONGO_URL) {
    throw new Error("MONGO_URL is not defined in environment variables");
  }
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db("chatapp");

  // 🔑 Ensure unique index on username (case-insensitive)
  await db.collection("users").createIndex({ username: 1 }, { unique: true });

  console.log("✅ Connected to MongoDB");
}

// ─── In-memory online tracking ─────────────────
const onlineUsers = new Map();

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

// ─── Health Check ──────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    dbConnected: !!db,
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("[REGISTER] Attempt:", { username, hasPassword: !!password });

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid input types" });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      return res.status(400).json({ error: "Username and password cannot be empty" });
    }

    console.log("[REGISTER] Checking existing user:", trimmedUsername);
    const existing = await db.collection("users").findOne({ username: trimmedUsername });
    console.log("[REGISTER] Existing user result:", existing);

    if (existing) {
      console.log("[REGISTER] User already exists:", existing.username);
      return res.status(409).json({ error: "Username already taken" });
    }

    console.log("[REGISTER] Creating new user...");
    const passwordHash = await bcrypt.hash(trimmedPassword, 10);
    const result = await db.collection("users").insertOne({
      username: trimmedUsername,
      passwordHash,
      createdAt: new Date(),
    });

    const id = result.insertedId.toString();
    const token = jwt.sign({ id, username: trimmedUsername }, JWT_SECRET, { expiresIn: "7d" });
    console.log("[REGISTER] Success:", trimmedUsername);
    res.json({ token, user: { id, username: trimmedUsername } });

  } catch (err) {
    console.error("[REGISTER] ERROR:", err.message);
    if (err.code === 11000) {
      return res.status(409).json({ error: "Username already taken" });
    }
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("[LOGIN] Attempt:", { username });

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // 🔑 Case-insensitive lookup
    const trimmedUsername = username.trim().toLowerCase();
    const user = await db.collection("users").findOne({ username: trimmedUsername });

    if (!user) {
      console.log("[LOGIN] User not found:", trimmedUsername);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password.trim(), user.passwordHash);
    if (!valid) {
      console.log("[LOGIN] Wrong password for:", trimmedUsername);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const id = user._id.toString();
    const token = jwt.sign({ id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    console.log("[LOGIN] Success:", user.username);
    res.json({ token, user: { id, username: user.username } });

  } catch (err) {
    console.error("[LOGIN] ERROR:", err.message);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.get("/api/users", authMiddleware, async (req, res) => {
  try {
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
  } catch (err) {
    console.error("[USERS] ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/messages/:userId", authMiddleware, async (req, res) => {
  try {
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
  } catch (err) {
    console.error("[MESSAGES] ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
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
    try {
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
    } catch (err) {
      console.error("[SOCKET room:join] ERROR:", err.message);
    }
  });

  socket.on("message:send", async ({ toUserId, content }) => {
    try {
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
    } catch (err) {
      console.error("[SOCKET message:send] ERROR:", err.message);
    }
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
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });