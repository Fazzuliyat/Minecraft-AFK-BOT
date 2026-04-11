const { addLog } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalNear } = goals;
const config = require("./settings.json");

let bot = null;
let activeIntervals = [];

function clearAllIntervals() {
  activeIntervals.forEach(clearInterval);
  activeIntervals = [];
}

function addInterval(fn, delay) {
  activeIntervals.push(setInterval(fn, delay));
}

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
    addLog("[Bot] ✓ Connected");

    const mcData = require("minecraft-data")(bot.version);
    const moves = new Movements(bot, mcData);

    moves.allowFreeMotion = false;
    moves.allowSprinting = false;
    moves.canDig = false;

    bot.pathfinder.setMovements(moves);

    // 🔥 IMPORTANT DELAY (fixes 90% of "not moving")
    setTimeout(() => {
      startAntiAFK();
    }, 5000);
  });

  bot.on("end", () => {
    addLog("[Bot] Disconnected");
    clearAllIntervals();
    setTimeout(createBot, 5000);
  });

  bot.on("error", (e) => {
    addLog("[Bot] Error: " + e.message);
  });
}

function startAntiAFK() {
  let center = bot.entity.position.clone();
  let angle = 0;

  addLog("[AntiAFK] Started");

  // 🔥 MAIN MOVEMENT (pathfinder)
  addInterval(() => {
    if (!bot.entity) return;

    // update center (prevents stuck behavior)
    center = bot.entity.position.clone();

    if (!bot.pathfinder.isMoving()) {
      const x = center.x + Math.cos(angle) * 2;
      const z = center.z + Math.sin(angle) * 2;

      bot.pathfinder.setGoal(
        new GoalNear(x, center.y, z, 1)
      );

      angle += Math.PI / 4;
    }

  }, 4000);

  // 🔥 FALLBACK MOVEMENT (GUARANTEED movement)
  addInterval(() => {
    if (!bot.entity) return;

    const actions = ["forward", "left", "right"];
    const action = actions[Math.floor(Math.random() * actions.length)];

    bot.setControlState(action, true);

    setTimeout(() => {
      bot.setControlState(action, false);
    }, 1000 + Math.random() * 1000);

  }, 6000);

  // LOOK AROUND
  addInterval(() => {
    if (!bot.entity) return;

    bot.look(
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.5,
      true
    );

  }, 5000);

  // JUMP
  addInterval(() => {
    if (!bot.entity) return;

    bot.setControlState("jump", true);
    setTimeout(() => {
      bot.setControlState("jump", false);
    }, 300);

  }, 15000);

  // ARM SWING
  addInterval(() => {
    if (!bot.entity) return;
    bot.swingArm();
  }, 20000);

  // ⚠️ REMOVED clearControlStates (THIS WAS BREAKING EVERYTHING)
}

createBot();
