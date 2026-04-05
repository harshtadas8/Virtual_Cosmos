import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// --- DATABASE SETUP ---
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/virtual_cosmos")
  .then(() => console.log("📦 MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  lastActive: { type: Date, default: Date.now },
  messagesSent: { type: Number, default: 0 },
});
const User = mongoose.model("User", UserSchema);

// --- REST API: LOGIN ---
app.post("/api/login", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    let user = await User.findOne({ username });
    if (!user) {
      user = await User.create({ username });
    } else {
      user.lastActive = Date.now();
      await user.save();
    }
    res.json({
      success: true,
      username: user.username,
      messagesSent: user.messagesSent,
    });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// --- REAL-TIME STATE ---
const players = {};

io.on("connection", (socket) => {
  socket.on("requestPlayers", (spawnData) => {
    players[socket.id] = {
      id: socket.id,
      username: spawnData.username || "Guest", 
      x: spawnData ? spawnData.x : 400,
      y: spawnData ? spawnData.y : 300,
    };

    socket.emit("currentPlayers", players);
    socket.broadcast.emit("newPlayer", players[socket.id]);
  });

  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  socket.on("send_message", async ({ message, senderName }) => {
    const payload = {
      senderId: socket.id,
      senderName: senderName || "Unknown",
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    io.emit("receive_message", payload);

    if (senderName) {
      try {
        await User.updateOne(
          { username: senderName }, 
          { $inc: { messagesSent: 1 } }
        );
      } catch (err) {
        console.error("Failed to update stats:", err);
      }
    }
  });

  // --- UPGRADED: Typing Indicator Broadcast ---
  socket.on("typing", (isTyping) => {
    // Tell everyone ELSE that this socket is typing
    socket.broadcast.emit("user_typing", { id: socket.id, isTyping });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server: http://localhost:${PORT}`),
);