const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");
const http = require("http");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
};

// Dashboard
app.get("/", (req, res) => {
  const status = botState.connected ? "online" : "offline";
  const icon = botState.connected ? "✓" : "✗";
  const label = botState.connected ? "Connected" : "Disconnected";
  const uptime = Math.floor((Date.now() - botState.startTime) / 1000);

  res.send(`<!DOCTYPE html>
<html>
<head><title>FANTOMAFK</title><style>
body{font-family:sans-serif;background:#0d1117;color:#e6edf3;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
main{width:400px;text-align:center}
h1{color:#f0f6fc;margin-bottom:10px}
.status{font-size:60px;margin:20px}
.online{color:#3fb950}.offline{color:#f85149}
.btn{padding:12px 24px;margin:5px;border:none;border-radius:8px;cursor:pointer;font-size:14px}
.start{background:#238636;color:#fff}.stop{background:#da3633;color:#fff}
.info{background:#161b22;padding:15px;border-radius:8px;margin:10px 0;text-align:left}
a{color:#58a6ff}
</style></head>
<body>
<main>
<h1>FANTOMAFK Bot</h1>
<div class="status ${status}">${icon}</div>
<h2>${label}</h2>
<div class="info">
<p><strong>Server:</strong> ${config.server.ip}:${config.server.port}</p>
<p><strong>Uptime:</strong> ${uptime}s</p>
</div>
<button class="btn start" onclick="fetch('/start',{method:'POST'});setTimeout(()=>location.reload(),500)">Start</button>
<button class="btn stop" onclick="fetch('/stop',{method:'POST'});setTimeout(()=>location.reload(),500)">Stop</button>
<br><br><a href="/logs">📋 View Logs</a>
</main>
</body></html>`);
});

app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
  });
});

app.get("/ping", (req, res) => res.send("pong"));

app.get("/logs", (req, res) => {
  const logs = getLogs();
  const entries = logs.map(l => `<div style="font-family:monospace;font-size:12px;padding:3px;border-bottom:1px solid #333;color:#${l.includes('✓')?'3fb950':l.includes('✗')||l.includes('Error')?'f85149':'e6edf3'}">${l}</div>`).join("");
  res.send(`<!DOCTYPE html><html><head><title>Logs</title><style>body{background:#0d1117;color:#e6edf3;padding:20px;font-family:sans-serif}a{color:#58a6ff}</style></head><body><h2>📋 FANTOMAFK Logs</h2><a href="/">← Back</a><hr><div style="background:#161b22;padding:10px;border-radius:8px">${entries || '<div style="color:#666">No logs yet...</div>'}</div><script>setTimeout(()=>location.reload(),5000)</script></body></html>`);
});

let botRunning = true;

app.post("/start", (req, res) => {
  if (botRunning) return res.json({ success: false, msg: "Already running" });
  botRunning = true;
  createBot();
  addLog("[Control] Bot started");
  res.json({ success: true });
});

app.post("/stop", (req, res) => {
  if (!botRunning) return res.json({ success: false, msg: "Already stopped" });
  botRunning = false;
  if (bot) { bot.end(); bot = null; }
  clearAllIntervals();
  addLog("[Control] Bot stopped");
  res.json({ success: true });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  addLog(`[Server] Started on port ${PORT}`);
});

setInterval(() => {
  http.get(`http://localhost:${PORT}/ping`, () => {}).on("error", () => {});
}, 4 * 60 * 1000);

let bot = null;
let activeIntervals = [];

function clearAllIntervals() {
  activeIntervals.forEach(id => clearInterval(id));
  activeIntervals = [];
}

function addInterval(fn, delay) {
  activeIntervals.push(setInterval(fn, delay));
}

function getReconnectDelay() {
  const base = config.utils["auto-reconnect-delay"] || 5000;
  const max = config.utils["max-reconnect-delay"] || 60000;
  const delay = Math.min(base * Math.pow(2, botState.reconnectAttempts), max);
  return delay + Math.random() * 3000;
}

function createBot() {
  if (bot) {
    clearAllIntervals();
    try { bot.removeAllListeners(); bot.end(); } catch (e) {}
    bot = null;
  }

  addLog(`[Bot] Connecting to ${config.server.ip}:${config.server.port}...`);

  try {
    bot = mineflayer.createBot({
      username: config["bot-account"].username,
      auth: config["bot-account"].type,
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version || false,
      hideErrors: true,
    });

    bot.loadPlugin(pathfinder);

    bot.once("spawn", () => {
      botState.connected = true;
      botState.reconnectAttempts = 0;
      addLog("[Bot] ✓ Connected successfully!");

      const mcData = require("minecraft-data")(bot.version);
      const moves = new Movements(bot, mcData);
      moves.canDig = false;
      moves.allowFreeMotion = true;
      bot.pathfinder.setMovements(moves);

      initModules(bot, mcData, moves);
    });

    bot.on("kicked", (reason) => {
      const r = typeof reason === "object" ? JSON.stringify(reason) : reason;
      addLog(`[Bot] ✗ Kicked: ${r}`);
      botState.connected = false;
      clearAllIntervals();
    });

    bot.on("end", () => {
      addLog("[Bot] Disconnected");
      botState.connected = false;
      clearAllIntervals();
      scheduleReconnect();
    });

    bot.on("error", (err) => {
      addLog(`[Bot] Error: ${err.message}`);
    });

  } catch (err) {
    addLog(`[Bot] Failed: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!botRunning) return;
  botState.reconnectAttempts++;
  const delay = getReconnectDelay();
  addLog(`[Bot] Reconnecting in ${Math.round(delay/1000)}s (attempt #${botState.reconnectAttempts})`);
  setTimeout(() => createBot(), delay);
}

function initModules(bot, mcData, moves) {
  // Auto-auth
  if (config.utils["auto-auth"]?.enabled) {
    const pass = config.utils["auto-auth"].password;
    bot.on("messagestr", (msg) => {
      const m = msg.toLowerCase();
      if (m.includes("/register")) { bot.chat(`/register ${pass} ${pass}`); addLog("[Auth] Registering"); }
      else if (m.includes("/login")) { bot.chat(`/login ${pass}`); addLog("[Auth] Logging in"); }
    });
  }

  // ANTI-AFK MOVEMENT - Simple and effective
  if (config.utils["anti-afk"]?.enabled) {

    // 1. Circle walk - moves constantly in small circles
    if (config.movement?.["circle-walk"]?.enabled) {
      const radius = config.movement["circle-walk"].radius || 3;
      let angle = 0;

      // Move every 2 seconds (faster than before)
      addInterval(() => {
        if (!bot || !botState.connected || !bot.entity) return;
        try {
          // Calculate next position in circle
          const cx = bot.entity.position.x;
          const cz = bot.entity.position.z;
          const x = cx + Math.cos(angle) * radius;
          const z = cz + Math.sin(angle) * radius;

          // Set goal
          bot.pathfinder.setGoal(
            new GoalBlock(Math.floor(x), Math.floor(bot.entity.position.y), Math.floor(z))
          );

          // Increment angle for next step
          angle += Math.PI / 3; // 60 degrees each step
          botState.lastActivity = Date.now();
        } catch (e) {}
      }, 2000); // Every 2 seconds

      addLog("[AntiAFK] Circle walk started");
    }

    // 2. Random jumps - every 10-20 seconds
    addInterval(() => {
      if (!bot || !botState.connected) return;
      try {
        bot.setControlState("jump", true);
        setTimeout(() => {
          if (bot) bot.setControlState("jump", false);
        }, 300);
      } catch (e) {}
    }, 10000 + Math.random() * 10000);

    // 3. Look around randomly - every 3-8 seconds
    addInterval(() => {
      if (!bot || !botState.connected) return;
      try {
        bot.look(Math.random() * Math.PI * 2, 0, false);
      } catch (e) {}
    }, 3000 + Math.random() * 5000);

    // 4. Swing arm occasionally - every 5-15 seconds
    addInterval(() => {
      if (!bot || !botState.connected) return;
      try { bot.swingArm(); } catch (e) {}
    }, 5000 + Math.random() * 10000);

    // 5. Random hotbar slot - every 20-40 seconds
    addInterval(() => {
      if (!bot || !botState.connected) return;
      try {
        bot.setQuickBarSlot(Math.floor(Math.random() * 9));
      } catch (e) {}
    }, 20000 + Math.random() * 20000);

    // 6. Sneak toggle - start sneaking
    if (config.utils["anti-afk"]?.sneak) {
      try { bot.setControlState("sneak", true); } catch (e) {}
    }
  }

  // Combat
  if (config.modules?.combat && config.combat?.["attack-mobs"]) {
    let lastAttack = 0;
    bot.on("physicsTick", () => {
      const now = Date.now();
      if (now - lastAttack < 1000) return;
      try {
        const mobs = Object.values(bot.entities).filter(e => 
          e.type === "mob" && e.position && bot.entity.position.distanceTo(e.position) < 3
        );
        if (mobs.length) { 
          bot.attack(mobs[0]); 
          lastAttack = now; 
        }
      } catch (e) {}
    });
  }

  // Auto-eat
  if (config.combat?.["auto-eat"]) {
    bot.on("health", () => {
      if (bot.food < 15) {
        const food = bot.inventory.items().find(i => i.foodPoints > 0);
        if (food) {
          bot.equip(food, "hand")
            .then(() => bot.consume())
            .catch(() => {});
        }
      }
    });
  }

  // Chat response
  if (config.modules?.chat && config.chat?.respond) {
    bot.on("chat", (username, msg) => {
      if (username === bot.username) return;
      if (msg.toLowerCase().includes("hello") || msg.toLowerCase().includes("hi")) {
        bot.chat(`Hello ${username}! I'm FANTOMAFK.`);
      }
    });
  }

  addLog("[Modules] All modules initialized!");
}

process.on("uncaughtException", (err) => {
  addLog(`[Crash] ${err.message}`);
  clearAllIntervals();
  botState.connected = false;
  setTimeout(() => scheduleReconnect(), 5000);
});

addLog("=".repeat(40));
addLog("  FANTOMAFK Bot v3.1 - Ready");
addLog(`  Server: ${config.server.ip}:${config.server.port}`);
addLog(`  Bot: ${config["bot-account"].username}`);
addLog("=".repeat(40));

createBot();
