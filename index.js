const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalNear } = goals;
const config = require("./settings.json");
const express = require("express");
const http = require("http");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

let bot = null;
let activeIntervals = [];

let botState = {
  connected: false,
  reconnectAttempts: 0,
};

// ================= SERVER =================
app.get("/ping", (req, res) => res.send("pong"));

app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    coords: bot?.entity?.position || null,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  addLog(`[Server] Running on ${PORT}`);
});

// keep alive
setInterval(() => {
  http.get(`http://localhost:${PORT}/ping`, () => {});
}, 240000);

// ================= UTIL =================
function clearAllIntervals() {
  activeIntervals.forEach(clearInterval);
  activeIntervals = [];
}

function addInterval(fn, delay) {
  activeIntervals.push(setInterval(fn, delay));
}

// ================= BOT =================
function createBot() {
  if (bot) {
    try { bot.end(); } catch {}
    clearAllIntervals();
  }

  addLog("[Bot] Connecting...");

  bot = mineflayer.createBot({
    username: config["bot-account"].username,
    auth: config["bot-account"].type,
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version || false,
  });

  bot.loadPlugin(pathfinder);

  bot.once("spawn", () => {
    botState.connected = true;
    addLog("[Bot] ✓ Connected");

    const mcData = require("minecraft-data")(bot.version);
    const moves = new Movements(bot, mcData);

    // 🔥 Anti-cheat safe settings
    moves.allowFreeMotion = false;
    moves.allowSprinting = false; // sprinting can flag anti-cheat
    moves.canDig = false;

    bot.pathfinder.setMovements(moves);

    startAntiAFK(bot);
  });

  bot.on("end", () => {
    addLog("[Bot] Disconnected");
    botState.connected = false;
    clearAllIntervals();
    setTimeout(createBot, 5000);
  });

  bot.on("kicked", (r) => {
    addLog("[Bot] Kicked: " + r);
  });

  bot.on("error", (e) => {
    addLog("[Bot] Error: " + e.message);
  });
}

// ================= ANTI-AFK =================
function startAntiAFK(bot) {

  const center = bot.entity.position.clone();
  let angle = 0;

  // SAFE WALKING (anti-cheat friendly)
  addInterval(() => {
    if (!bot.entity) return;

    if (bot.pathfinder.isMoving()) return;

    const radius = 2 + Math.random(); // random radius

    const x = center.x + Math.cos(angle) * radius;
    const z = center.z + Math.sin(angle) * radius;

    bot.pathfinder.setGoal(
      new GoalNear(x, center.y, z, 1)
    );

    angle += Math.PI / 6;

  }, 3000); // slower = safer

  // HUMAN-LIKE IDLE MOVEMENT
  addInterval(() => {
    if (!bot.entity) return;

    const actions = ["forward", "left", "right"];
    const action = actions[Math.floor(Math.random() * actions.length)];

    bot.setControlState(action, true);

    setTimeout(() => {
      bot.setControlState(action, false);
    }, 800 + Math.random() * 1200);

  }, 7000);

  // RANDOM LOOK (very important for anti-cheat)
  addInterval(() => {
    if (!bot.entity) return;

    bot.look(
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.5,
      true
    );

  }, 5000);

  // OCCASIONAL JUMP (not spam)
  addInterval(() => {
    if (!bot.entity) return;

    bot.setControlState("jump", true);

    setTimeout(() => {
      bot.setControlState("jump", false);
    }, 250);

  }, 15000);

  // RARE ARM SWING
  addInterval(() => {
    if (!bot.entity) return;
    bot.swingArm();
  }, 20000);

  // RANDOM PAUSE (VERY HUMAN)
  addInterval(() => {
    if (!bot.entity) return;

    bot.clearControlStates();

  }, 12000);

  addLog("[AntiAFK] Running (anti-cheat safe)");
}

// ================= START =================
addLog("=================================");
addLog("FANTOMAFK v4 (Anti-Cheat Edition)");
addLog("=================================");

createBot();
