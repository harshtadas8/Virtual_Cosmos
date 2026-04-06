import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { io } from "socket.io-client";

// How close avatars need to be (in pixels) to open the chat link
const PROXIMITY_RADIUS = 120;

// Simple login overlay to grab a username before entering the canvas
function EntryScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    try {
      // Hit our live Render backend
      const res = await fetch(
        "https://virtual-cosmos-5o0a.onrender.com/api/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim() }),
        },
      );
      const data = await res.json();

      if (data.success) {
        // Using sessionStorage instead of localStorage so we can test with multiple tabs
        // locally without the tabs sharing/overwriting the same username
        sessionStorage.setItem("cosmos_user", data.username);
        sessionStorage.setItem("cosmos_stats", data.messagesSent);
        onLogin(data.username, data.messagesSent);
      }
    } catch (err) {
      console.error("Login failed", err);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-[#050510] text-white selection:bg-sky-500/30 font-sans relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-sky-500/20 shadow-[0_0_50px_rgba(14,165,233,0.15)]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500 tracking-widest uppercase italic mb-2">
            Cosmos
          </h1>
          <p className="text-xs text-sky-400/80 font-mono tracking-[0.2em] uppercase">
            Initialize Link Sequence
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
              Callsign / Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter ID..."
              maxLength={12}
              className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 outline-none focus:border-sky-400 focus:shadow-[0_0_20px_rgba(14,165,233,0.2)] transition-all font-mono"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:shadow-[0_0_30px_rgba(14,165,233,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Authenticating..." : "Enter Cosmos"}
          </button>
        </form>
      </div>
    </div>
  );
}

// The main spatial arena
function App() {
  const [currentUser, setCurrentUser] = useState(
    sessionStorage.getItem("cosmos_user") || null,
  );
  const [lifetimeMessages, setLifetimeMessages] = useState(
    Number(sessionStorage.getItem("cosmos_stats")) || 0,
  );

  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const appRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const [nearbyPlayers, setNearbyPlayers] = useState([]);
  const nearbyRef = useRef([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const chatEndRef = useRef(null);

  // Auto-scroll to the bottom of the chat panel when new stuff comes in
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  useEffect(() => {
    if (!currentUser) return;

    socketRef.current = io("https://virtual-cosmos-5o0a.onrender.com");
    let isMounted = true;
    let app = null;
    const keys = {};
    const otherPlayers = {};

    async function setup() {
      try {
        // Initialize WebGL canvas
        app = new PIXI.Application();
        await app.init({
          background: "#050510",
          resizeTo: window,
          antialias: true,
        });

        if (!isMounted) {
          app.destroy(true, { children: true });
          return;
        }

        appRef.current = app;
        if (canvasRef.current) canvasRef.current.appendChild(app.canvas);

        // Generate the parallax starfield background
        const stars = [];
        for (let i = 0; i < 150; i++) {
          const star = new PIXI.Graphics();
          const radius = Math.random() * 1.5 + 0.5;
          const alpha = Math.random() * 0.7 + 0.1;

          star.circle(0, 0, radius).fill({ color: 0xffffff, alpha: alpha });
          star.x = Math.random() * app.screen.width;
          star.y = Math.random() * app.screen.height;
          star.speed = Math.random() * 0.3 + 0.05;

          app.stage.addChild(star);
          stars.push(star);
        }

        // Draw the local player (Blue dot with radar ring)
        const player = new PIXI.Graphics()
          .circle(0, 0, 18)
          .fill(0x0ea5e9)
          .circle(0, 0, PROXIMITY_RADIUS)
          .stroke({ width: 2, color: 0x0ea5e9, alpha: 0.15 });

        const localNameplate = new PIXI.Text({
          text: currentUser,
          style: {
            fontFamily: "monospace",
            fontSize: 10,
            fill: 0x7dd3fc,
            fontWeight: "bold",
            letterSpacing: 1,
          },
        });
        localNameplate.anchor.set(0.5, 1);
        localNameplate.y = -26;
        player.addChild(localNameplate);

        // Hardcode the spawn point so all devices drop in the same absolute location
        // We add a tiny random offset so people don't spawn perfectly on top of each other
        const offsetX = (Math.random() - 0.5) * 50;
        const offsetY = (Math.random() - 0.5) * 50;
        player.x = 400 + offsetX;
        player.y = 300 + offsetY;
        app.stage.addChild(player);

        // Factory function for when remote players join
        const createOtherPlayer = (info) => {
          if (otherPlayers[info.id]) return;

          const other = new PIXI.Graphics().circle(0, 0, 18).fill(0xf43f5e);
          other.x = info.x;
          other.y = info.y;

          const otherNameplate = new PIXI.Text({
            text: info.username,
            style: {
              fontFamily: "monospace",
              fontSize: 10,
              fill: 0xfca5a5,
              fontWeight: "bold",
              letterSpacing: 1,
            },
          });
          otherNameplate.anchor.set(0.5, 1);
          otherNameplate.y = -26;
          other.addChild(otherNameplate);

          // Floating WhatsApp-style typing dots
          const typingBubble = new PIXI.Graphics()
            .roundRect(-20, -65, 40, 20, 8)
            .fill(0x1e293b)
            .circle(-10, -55, 2)
            .fill(0x38bdf8)
            .circle(0, -55, 2)
            .fill(0x38bdf8)
            .circle(10, -55, 2)
            .fill(0x38bdf8);

          typingBubble.visible = false;
          other.addChild(typingBubble);

          app.stage.addChild(other);

          // Track targetX and targetY here so we can glide them smoothly in the ticker
          otherPlayers[info.id] = {
            sprite: other,
            username: info.username,
            typingBubble,
            targetX: info.x,
            targetY: info.y,
          };
        };

        // --- Socket Listeners ---

        socketRef.current.on("currentPlayers", (ps) => {
          Object.keys(ps).forEach(
            (id) => id !== socketRef.current.id && createOtherPlayer(ps[id]),
          );
        });

        socketRef.current.on("newPlayer", createOtherPlayer);

        socketRef.current.on("playerMoved", (info) => {
          if (otherPlayers[info.id]) {
            // Update their network target, NOT their actual sprite (the game loop handles that)
            otherPlayers[info.id].targetX = info.x;
            otherPlayers[info.id].targetY = info.y;
          }
        });

        socketRef.current.on("user_typing", ({ id, isTyping }) => {
          if (otherPlayers[id]) {
            if (otherPlayers[id].typingBubble) {
              otherPlayers[id].typingBubble.visible = isTyping;
            }

            setTypingUsers((prev) => {
              const updated = { ...prev };
              if (isTyping) {
                updated[id] = otherPlayers[id].username;
              } else {
                delete updated[id];
              }
              return updated;
            });
          }
        });

        socketRef.current.on("playerDisconnected", (id) => {
          if (otherPlayers[id]) {
            app.stage.removeChild(otherPlayers[id].sprite);
            delete otherPlayers[id];
            setTypingUsers((prev) => {
              const updated = { ...prev };
              delete updated[id];
              return updated;
            });
          }
        });

        socketRef.current.on("receive_message", (msg) => {
          if (msg.senderId === socketRef.current.id) {
            setMessages((prev) => [...prev, msg]);
            return;
          }

          // Spatial filtering: only accept messages if they are within our circle
          const senderData = otherPlayers[msg.senderId];
          if (senderData) {
            const dist = Math.sqrt(
              Math.pow(player.x - senderData.sprite.x, 2) +
                Math.pow(player.y - senderData.sprite.y, 2),
            );
            if (dist < PROXIMITY_RADIUS) {
              setMessages((prev) => [...prev, msg]);
            }
          }
        });

        socketRef.current.emit("requestPlayers", {
          x: player.x,
          y: player.y,
          username: currentUser,
        });

        // Input listeners
        const handleDown = (e) => {
          keys[e.code] = true;
        };
        const handleUp = (e) => {
          keys[e.code] = false;
        };
        window.addEventListener("keydown", handleDown);
        window.addEventListener("keyup", handleUp);

        // --- The Main 60FPS Game Loop ---
        app.ticker.add(() => {
          let moved = false;

          // Local Movement & Boundary Clamping
          if (keys["KeyW"] || keys["ArrowUp"]) {
            player.y = Math.max(18, player.y - 4);
            moved = true;
          }
          if (keys["KeyS"] || keys["ArrowDown"]) {
            player.y = Math.min(app.screen.height - 18, player.y + 4);
            moved = true;
          }
          if (keys["KeyA"] || keys["ArrowLeft"]) {
            player.x = Math.max(18, player.x - 4);
            moved = true;
          }
          if (keys["KeyD"] || keys["ArrowRight"]) {
            player.x = Math.min(app.screen.width - 18, player.x + 4);
            moved = true;
          }

          if (moved) {
            socketRef.current.emit("move", { x: player.x, y: player.y });
          }

          // Animate background stars drifting
          stars.forEach((star) => {
            star.x -= star.speed;
            if (star.x < 0) {
              star.x = app.screen.width;
              star.y = Math.random() * app.screen.height;
            }
          });

          // LERP (Linear Interpolation)
          // Smoothly glide remote players toward their target coordinates to hide network latency
          Object.values(otherPlayers).forEach((p) => {
            if (p.targetX !== undefined && p.targetY !== undefined) {
              p.sprite.x += (p.targetX - p.sprite.x) * 0.2;
              p.sprite.y += (p.targetY - p.sprite.y) * 0.2;
            }
          });

          // Check proximity to see who we are allowed to talk to right now
          let currentNearby = [];
          Object.keys(otherPlayers).forEach((id) => {
            const otherData = otherPlayers[id];
            const dist = Math.sqrt(
              Math.pow(player.x - otherData.sprite.x, 2) +
                Math.pow(player.y - otherData.sprite.y, 2),
            );
            if (dist < PROXIMITY_RADIUS) {
              currentNearby.push({ id, username: otherData.username });
            }
          });

          // Only update React state if the list of nearby people actually changed
          const currentSortedStr = JSON.stringify(
            currentNearby.map((n) => n.id).sort(),
          );
          const refSortedStr = JSON.stringify(
            nearbyRef.current.map((n) => n.id).sort(),
          );

          if (currentSortedStr !== refSortedStr) {
            nearbyRef.current = currentNearby;
            setNearbyPlayers(currentNearby);
          }
        });
      } catch (err) {
        console.error("Pixi Init Fail:", err);
      }
    }

    setup();

    return () => {
      isMounted = false;
      window.removeEventListener("keydown", null);
      window.removeEventListener("keyup", null);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTimeout(() => {
        if (appRef.current) {
          appRef.current.destroy(true, { children: true, texture: true });
          appRef.current = null;
        }
      }, 0);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [currentUser]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    // Broadcast that we started typing
    if (socketRef.current) {
      socketRef.current.emit("typing", true);

      // Debounce the typing indicator so it turns off after 2 seconds of no input
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit("typing", false);
      }, 2000);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || nearbyPlayers.length === 0) return;

    socketRef.current.emit("send_message", {
      message: inputText,
      senderName: currentUser,
    });

    setInputText("");

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current.emit("typing", false);

    // Bump the local stat counter so it feels instant
    setLifetimeMessages((prev) => {
      const newTotal = prev + 1;
      sessionStorage.setItem("cosmos_stats", newTotal);
      return newTotal;
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("cosmos_user");
    sessionStorage.removeItem("cosmos_stats");
    window.location.reload();
  };

  if (!currentUser) {
    return (
      <EntryScreen
        onLogin={(name, stats) => {
          setCurrentUser(name);
          setLifetimeMessages(stats);
        }}
      />
    );
  }

  // --- Render the main UI overlay ---
  return (
    <div className="relative w-screen h-screen bg-[#050510] overflow-hidden font-sans select-none">
      {/* Top Left Stats Panel */}
      <div className="absolute top-6 left-6 z-20 pointer-events-none">
        <div className="p-4 bg-slate-950/80 backdrop-blur-md rounded-xl border border-sky-500/30 shadow-[0_0_20px_rgba(14,165,233,0.15)] flex flex-col gap-1 pointer-events-auto">
          <div className="flex justify-between items-start gap-8">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500 tracking-widest uppercase">
              Cosmos{" "}
              <span className="text-xs text-sky-400 font-mono tracking-normal">
                v1.0
              </span>
            </h1>
            <button
              onClick={handleLogout}
              className="text-[9px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors mt-1"
            >
              [ Disconnect ]
            </button>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
              Active Agent: {currentUser}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800">
            <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
              Lifetime Transmissions:{" "}
              <span className="text-sky-400 font-bold">{lifetimeMessages}</span>
            </p>
          </div>
        </div>

        {/* Dynamic Radar Status */}
        <div
          className={`mt-4 px-4 py-2.5 rounded-lg border backdrop-blur-md transition-all duration-500 w-fit ${nearbyPlayers.length > 0 ? "bg-sky-500/20 border-sky-400/50 shadow-[0_0_15px_rgba(14,165,233,0.4)]" : "bg-slate-900/60 border-slate-700"}`}
        >
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.2em] font-mono ${nearbyPlayers.length > 0 ? "text-sky-300" : "text-slate-500"}`}
          >
            {nearbyPlayers.length > 0
              ? ">> Comm-Link Established"
              : ">> Radar Scanning..."}
          </p>
        </div>
      </div>

      {/* Right Side Chat Panel (Only mounts if someone is in range) */}
      {nearbyPlayers.length > 0 && (
        <div className="absolute top-1/2 -translate-y-1/2 right-8 z-30 w-[350px] h-[550px] bg-slate-950/80 backdrop-blur-xl rounded-2xl border border-sky-500/30 shadow-[0_0_40px_rgba(14,165,233,0.2)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="px-5 py-4 border-b border-sky-500/30 bg-gradient-to-r from-sky-900/40 to-transparent">
            <p className="text-[9px] font-black uppercase tracking-widest text-sky-400 font-mono">
              Area Comm-Link
            </p>
            <p className="text-sm font-bold text-white mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]"></span>
              Connected to: {nearbyPlayers.map((p) => p.username).join(", ")}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.senderId === socketRef.current.id ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2 rounded-xl text-sm ${m.senderId === socketRef.current.id ? "bg-sky-600/90 text-white rounded-tr-sm border border-sky-400/50 shadow-[0_0_10px_rgba(14,165,233,0.3)]" : "bg-slate-800/90 text-slate-200 rounded-tl-sm border border-slate-600"}`}
                >
                  {m.message}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 font-mono uppercase">
                  {m.senderId === socketRef.current.id ? "You" : m.senderName} •{" "}
                  {m.timestamp}
                </span>
              </div>
            ))}

            {/* Render typing indicators for nearby users */}
            {Object.entries(typingUsers).map(([id, name]) => {
              if (!nearbyPlayers.some((p) => p.id === id)) return null;
              return (
                <div
                  key={id}
                  className="flex items-end gap-2 mt-2 text-slate-400"
                >
                  <span className="text-[10px] font-mono italic">
                    {name} is typing
                  </span>
                  <div className="flex gap-1 mb-1.5 ml-1">
                    <span
                      className="h-1 w-1 bg-sky-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></span>
                    <span
                      className="h-1 w-1 bg-sky-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></span>
                    <span
                      className="h-1 w-1 bg-sky-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></span>
                  </div>
                </div>
              );
            })}

            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={sendMessage}
            className="p-4 bg-slate-900/50 border-t border-sky-500/30"
          >
            <div className="relative">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Enter command..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-sky-100 placeholder:text-slate-600 outline-none focus:border-sky-400 focus:shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-all font-mono"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-sky-500 hover:text-sky-300 bg-slate-900 rounded-md border border-slate-700 hover:border-sky-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PixiJS mounts the canvas here */}
      <div ref={canvasRef} className="absolute inset-0 z-10" />
    </div>
  );
}

export default App;
