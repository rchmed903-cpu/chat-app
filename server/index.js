const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "https://chat-app-git-main-rchmed903-cpus-projects.vercel.app",
  "https://chat-3iu1hiqdi-rchmed903-cpus-projects.vercel.app",
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_change_in_production";
const PORT = process.env.PORT || 3001;

const users = new Map();
const messages = new Map();
const onlineUsers = new Map();

function getRoomId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}

function getMessagesForRoom(roomId) {
  return messages.get(roomId) || [];
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  const existing = [...users.values()].find((u) => u.username === username);
  if (existing) return res.status(409).json({ error: "Username already taken" });

  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const user = { id, username, passwordHash, createdAt: new Date().toISOString() };
  users.set(id, user);

  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id, username } });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = [...users.values()].find((u) => u.username === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.get("/api/users", authMiddleware, (req, res) => {
  const allUsers = [...users.values()]
    .filter((u) => u.id !== req.user.id)
    .map((u) => ({
      id: u.id,
      username: u.username,
      isOnline: [...onlineUsers.values()].some((o) => o.userId === u.id),
    }));
  res.json(allUsers);
});

app.get("/api/messages/:userId", authMiddleware, (req, res) => {
  const roomId = getRoomId(req.user.id, req.params.userId);
  res.json(getMessagesForRoom(roomId));
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const { id: userId, username } = socket.user;
  onlineUsers.set(socket.id, { userId, username });

  console.log(`✅ ${username} connected (${socket.id})`);

  io.emit("users:online", [...onlineUsers.values()].map((u) => u.userId));

  socket.on("room:join", (otherUserId) => {
    const roomId = getRoomId(userId, otherUserId);
    socket.join(roomId);
    socket.emit("room:history", getMessagesForRoom(roomId));
  });

  socket.on("message:send", ({ toUserId, content }) => {
    if (!content?.trim()) return;
    const roomId = getRoomId(userId, toUserId);
    const message = {
      id: uuidv4(),
      senderId: userId,
      senderUsername: username,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    if (!messages.has(roomId)) messages.set(roomId, []);
    messages.get(roomId).push(message);

    io.to(roomId).emit("message:receive", { roomId, message });

    const recipientSockets = [...onlineUsers.entries()]
      .filter(([, u]) => u.userId === toUserId)
      .map(([sid]) => sid);

    recipientSockets.forEach((sid) => {
      if (!io.sockets.sockets.get(sid)?.rooms.has(roomId)) {
        io.to(sid).emit("notification:new_message", {
          fromUserId: userId,
          fromUsername: username,
          preview: content.slice(0, 50),
        });
      }
    });
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

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
