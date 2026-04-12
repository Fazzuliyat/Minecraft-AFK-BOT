"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalNear } = goals;
const config = require("./settings.json");
const express = require("express");
const http = require("http");

// ============================================================
// EXPRESS SERVER — keeps Railway alive (required!)
// Railway kills any process that doesn't bind a port
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  const status = bot && botConnected ? "✅ Connected" : "❌ Disconnected";
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Fazz AFK Bot</title>
      <style>
        body { font-family: -apple-system, sans-serif; background: #0d1117; color: #e6edf3;
               display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #161b22; border: 1px solid #21262d; border-radius: 12px;
                padding: 32px 40px; max-width: 400px; width: 100%; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        p  { margin: 6px 0; color: #8b949e; font-size: 14px; }
        .status { font-size: 18px; font-weight: 700; margin: 20px 0 4px; }
        a { color: #58a6ff; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🤖 Fazz AFK Bot</h1>
        <p>Server: <strong>${config.server.ip}:${config.server.port}</strong></p>
        <div class="status">${status}</div>
        <p>Uptime: ${formatUptime(Math.floor((Date.now() - startTime) / 1000))}</p>
        <p style="margin-top:20px"><a href="/logs">View Logs →</a></p>
      </div>
    </body>
    </html>
  `);
});

app.get("/ping", (req, res) => res.send("pong"));

app.get("/health", (req, res) => res.json({
  status: bot && botConnected ? "connected" : "disconnected",
  uptime: Math.floor((Date.now() - startTime) / 1000),
  coords: bot?.entity?.position ?? null,
}));

app.get("/logs", (req, res) => {
  const logs = getLogs();
  const rows = logs.map(l => {
    const cls = l.includes("Error") || l.includes("error") ? "color:#ff7b72"
              : l.includes("✓") || l.includes("Connected") ? "color:#3fb950"
              : "color:#8b949e";
    const escaped = l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return `<div style="${cls};font-size:13px;padding:2px 0;white-space:pre-wrap">${escaped}</div>`;
  }).join("");

  res.send(`
    <!DOCTYPE html><html lang="en">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Logs – Fazz AFK Bot</title>
    <style>body{font-family:monospace;background:#0d1117;color:#e6edf3;margin:0;padding:24px}
    a{color:#58a6ff;text-decoration:none;font-size:13px}
    .box{background:#161b22;border:1px solid #21262d;border-radius:10px;padding:16px;margin-top:16px;
         max-height:80vh;overflow-y:auto}</style>
    </head><body>
    <a href="/">← Back</a>
    <h2 style="margin:12px 0 4px">Bot Logs</h2>
    <p style="color:#8b949e;font-size:13px">${logs.length} entries · auto-refreshes every 5s</p>
    <div class="box" id="log">${rows || '<div style="color:#484f58">No logs yet.</div>'}</div>
    <script>setTimeout(()=>location.reload(),5000);
    document.getElementById('log').scrollTop=9999999;</script>
    </body></html>
  `);
});

app.listen(PORT, "0.0.0.0", () => {
  addLog(`[Server] HTTP server started on port ${PORT}`);
});

// Self-ping every 4 minutes to prevent Railway from sleeping
setInterval(() => {
  http.get(`http://localhost:${PORT}/ping`).on("error", () => {});
}, 4 * 60 * 1000);

// ============================================================
// BOT STATE
// ============================================================
let bot = null;
let activeIntervals = [];
let isSleeping = false;
let botConnected = false;
let reconnectTimer = null;
const startTime = Date.now();

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function clearAllIntervals() {
  activeIntervals.forEach(clearInterval);
  activeIntervals = [];
}

function addInterval(fn, delay) {
  activeIntervals.push(setInterval(fn, delay));
}

// ============================================================
// BOT CREATION
// ============================================================
function createBot() {
  // Reset state on each new connection attempt
  isSleeping = false;
  botConnected = false;

  if (bot) {
    try { bot.removeAllListeners(); bot.end(); } catch {}
    bot = null;
  }
  clearAllIntervals();

  addLog("[Bot] Connecting to " + config.server.ip + ":" + config.server.port);

  try {
    bot = mineflayer.createBot({
      username: config["bot-account"].username,
      auth: config["bot-account"].type,
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version || false,
      hideErrors: false,
      checkTimeoutInterval: 60000,
    });
  } catch (e) {
    addLog("[Bot] Failed to create: " + e.message);
    scheduleReconnect(10000);
    return;
  }

  bot.loadPlugin(pathfinder);

  // ---- AUTH (AuthMe support) ----
  const password = process.env.BOT_PASSWORD || "";
  let authDone = false;

  if (password) {
    bot.on("messagestr", (msg) => {
      if (authDone) return;
      const m = msg.toLowerCase();
      if (m.includes("/register") || m.includes("register")) {
        authDone = true;
        bot.chat(`/register ${password} ${password}`);
        addLog("[Auth] Sent /register");
        setTimeout(() => {
          if (bot && botConnected) {
            bot.chat(`/login ${password}`);
            addLog("[Auth] Sent /login after register");
          }
        }, 1500);
      } else if (m.includes("/login") || m.includes("login")) {
        authDone = true;
        bot.chat(`/login ${password}`);
        addLog("[Auth] Sent /login");
      }
    });

    // Failsafe: send /login after 20s if no prompt received
    const authTimer = setTimeout(() => {
      if (!authDone && bot && botConnected) {
        authDone = true;
        addLog("[Auth] No prompt after 20s — sending /login as failsafe");
        bot.chat(`/login ${password}`);
      }
    }, 20000);

    bot.once("end",    () => clearTimeout(authTimer));
    bot.once("kicked", () => clearTimeout(authTimer));
  }

  // ---- SPAWN ----
  bot.once("spawn", () => {
    botConnected = true;
    addLog("[Bot] ✓ Spawned successfully (version: " + bot.version + ")");

    const mcData = require("minecraft-data")(bot.version);
    const moves = new Movements(bot, mcData);
    moves.allowFreeMotion = false;
    moves.allowSprinting = false;
    moves.canDig = false;
    bot.pathfinder.setMovements(moves);

    // Delay starting modules so auth finishes first
    setTimeout(() => {
      if (!bot || !botConnected) return;
      startAntiAFK();
      startSleepSystem();
      addLog("[Bot] All modules started");
    }, 6000);
  });

  // ---- DISCONNECT / RECONNECT ----
  bot.on("kicked", (reason) => {
    const r = typeof reason === "object" ? JSON.stringify(reason) : reason;
    addLog("[Bot] Kicked: " + r);
    botConnected = false;
    isSleeping = false;
  });

  bot.on("end", () => {
    addLog("[Bot] Disconnected — reconnecting in 5s");
    botConnected = false;
    isSleeping = false;
    clearAllIntervals();
    scheduleReconnect(5000);
  });

  bot.on("error", (e) => {
    const msg = e.message || "";
    addLog("[Bot] Error: " + msg);
    // Use longer delay if server is offline
    if (msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      scheduleReconnect(90000);
    }
  });

  bot.on("wake", () => {
    isSleeping = false;
    addLog("[Sleep] Woke up");
  });
}

function scheduleReconnect(delay) {
  if (reconnectTimer) return; // don't stack
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, delay || 5000);
}

// ============================================================
// SLEEP SYSTEM
// ============================================================
function isNight() {
  if (!bot?.time) return false;
  const t = bot.time.timeOfDay;
  return t > 12542 && t < 23460;
}

function startSleepSystem() {
  addLog("[Sleep] System started");

  addInterval(async () => {
    if (!bot?.entity || !botConnected) return;
    if (isSleeping) return;
    if (!isNight()) return;

    try {
      const bed = bot.findBlock({
        matching: block => bot.isABed(block),
        maxDistance: 32,
      });
      if (!bed) return;

      addLog("[Sleep] Bed found — walking to it");
      isSleeping = true;

      try {
        await bot.pathfinder.goto(
          new GoalNear(bed.position.x, bed.position.y, bed.position.z, 2)
        );
        await bot.sleep(bed);
        addLog("[Sleep] Now sleeping");
      } catch (err) {
        addLog("[Sleep] Failed: " + err.message);
        isSleeping = false;
      }
    } catch (e) {
      addLog("[Sleep] Error: " + e.message);
      isSleeping = false;
    }
  }, 10000);
}

// ============================================================
// ANTI-AFK — human-like, randomised, stops while sleeping
// ============================================================
function startAntiAFK() {
  let angle = 0;
  addLog("[AntiAFK] Started");

  // Guard — skips action if sleeping or disconnected
  function safe(fn) {
    return () => {
      if (!bot?.entity || !botConnected || isSleeping) return;
      try { fn(); } catch (e) { addLog("[AntiAFK] Error: " + e.message); }
    };
  }

  // 1. Circle walk via pathfinder every 4s
  addInterval(safe(() => {
    if (bot.pathfinder.isMoving()) return;
    const pos = bot.entity.position;
    const x = pos.x + Math.cos(angle) * 3;
    const z = pos.z + Math.sin(angle) * 3;
    bot.pathfinder.setGoal(new GoalNear(x, pos.y, z, 1));
    angle += Math.PI / 4 * (0.8 + Math.random() * 0.4); // slightly varied arc
  }), 4000);

  // 2. Random short walk bursts every 6-10s
  addInterval(safe(() => {
    const dirs = ["forward", "back", "left", "right"];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    bot.setControlState(dir, true);
    setTimeout(() => {
      if (bot?.entity) bot.setControlState(dir, false);
    }, 600 + Math.random() * 900);
  }), 6000 + Math.floor(Math.random() * 4000));

  // 3. Look around every 4-9s
  addInterval(safe(() => {
    bot.look(
      Math.random() * Math.PI * 2 - Math.PI,
      (Math.random() - 0.5) * 0.6,
      false
    );
  }), 4000 + Math.floor(Math.random() * 5000));

  // 4. Random jump every 12-20s
  addInterval(safe(() => {
    bot.setControlState("jump", true);
    setTimeout(() => {
      if (bot?.entity) bot.setControlState("jump", false);
    }, 200 + Math.floor(Math.random() * 150));
  }), 12000 + Math.floor(Math.random() * 8000));

  // 5. Arm swing every 15-25s
  addInterval(safe(() => {
    bot.swingArm();
  }), 15000 + Math.floor(Math.random() * 10000));

  // 6. Hotbar slot change every 30-60s
  addInterval(safe(() => {
    bot.setQuickBarSlot(Math.floor(Math.random() * 9));
  }), 30000 + Math.floor(Math.random() * 30000));

  // 7. Occasional crouch burst every 60-120s
  addInterval(safe(() => {
    if (Math.random() < 0.5) return; // only fires ~50% of the time
    bot.setControlState("sneak", true);
    setTimeout(() => {
      if (bot?.entity) bot.setControlState("sneak", false);
    }, 500 + Math.floor(Math.random() * 800));
  }), 60000 + Math.floor(Math.random() * 60000));
}

// ============================================================
// PROCESS SAFETY
// ============================================================
process.on("uncaughtException", (err) => {
  addLog("[FATAL] " + err.message);
  if (!reconnectTimer) scheduleReconnect(8000);
});

process.on("unhandledRejection", (reason) => {
  addLog("[FATAL] Unhandled rejection: " + String(reason));
});

// Ignore signals so Railway can't kill the process
process.on("SIGTERM", () => addLog("[System] SIGTERM ignored"));
process.on("SIGINT",  () => addLog("[System] SIGINT ignored"));

// ============================================================
// START
// ============================================================
addLog("=".repeat(48));
addLog("  Fazz AFK Bot — Starting");
addLog("  Server: " + config.server.ip + ":" + config.server.port);
addLog("=".repeat(48));

createBot();
