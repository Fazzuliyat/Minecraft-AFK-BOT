const { addLog } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalNear } = goals;
const config = require("./settings.json");

let bot = null;
let activeIntervals = [];
let isSleeping = false;

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

    setTimeout(() => {
      startAntiAFK();
      startSleepSystem();
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

  bot.on("wake", () => {
    isSleeping = false;
    addLog("[Sleep] Woke up");
  });
}

function isNight() {
  const time = bot.time.timeOfDay;
  return time > 13000 && time < 23000;
}

function startSleepSystem() {
  addLog("[Sleep] System started");

  addInterval(async () => {
    if (!bot?.entity) return;
    if (isSleeping) return;
    if (!isNight()) return;

    try {
      const bed = bot.findBlock({
        matching: block => bot.isABed(block),
        maxDistance: 32
      });

      if (!bed) return;

      addLog("[Sleep] Bed found, going to sleep");

      isSleeping = true;

      await bot.pathfinder.goto(
        new GoalNear(bed.position.x, bed.position.y, bed.position.z, 2)
      );

      try {
        await bot.sleep(bed);
        addLog("[Sleep] Sleeping now...");
      } catch (err) {
        addLog("[Sleep] Failed: " + err.message);
        isSleeping = false;
      }

    } catch (e) {
      addLog("[Sleep Error] " + e.message);
      isSleeping = false;
    }
  }, 10000);
}

function startAntiAFK() {
  let center = bot.entity.position.clone();
  let angle = 0;

  addLog("[AntiAFK] Started");

  // STOP movement while sleeping
  function safe(fn) {
    return () => {
      if (!bot?.entity || isSleeping) return;
      fn();
    };
  }

  addInterval(safe(() => {
    center = bot.entity.position.clone();

    if (!bot.pathfinder.isMoving() && !isSleeping) {
      const x = center.x + Math.cos(angle) * 2;
      const z = center.z + Math.sin(angle) * 2;

      bot.pathfinder.setGoal(
        new GoalNear(x, center.y, z, 1)
      );

      angle += Math.PI / 4;
    }

  }), 4000);

  addInterval(safe(() => {
    const actions = ["forward", "left", "right"];
    const action = actions[Math.floor(Math.random() * actions.length)];

    bot.setControlState(action, true);

    setTimeout(() => {
      bot.setControlState(action, false);
    }, 1000 + Math.random() * 1000);

  }), 6000);

  addInterval(safe(() => {
    bot.look(
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.5,
      true
    );
  }), 5000);

  addInterval(safe(() => {
    bot.setControlState("jump", true);

    setTimeout(() => {
      bot.setControlState("jump", false);
    }, 300);
  }), 15000);

  addInterval(safe(() => {
    bot.swingArm();
  }), 20000);
}

createBot();
