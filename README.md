# 🤖 Fazz AFK Bot

> A smart Minecraft AFK bot that keeps your Aternos server alive 24/7 — with a live web dashboard, human-like movement, and auto-reconnect.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square&logo=node.js)
![Mineflayer](https://img.shields.io/badge/Mineflayer-4.x-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![Platform](https://img.shields.io/badge/Hosted%20on-Railway-purple?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🚶 **Human-like Movement** | Walks, looks around, jumps, crouches — all on randomised timers so anti-bot plugins can't detect a pattern |
| 🔄 **Auto-Reconnect** | Reconnects automatically; uses smart delays when Aternos is offline |
| 🔐 **Auto Auth** | Handles `/register` and `/login` for cracked servers with AuthMe |
| 🛏️ **Auto Sleep** | Sleeps in a bed at night so other players can skip it |
| ⚔️ **Combat Module** | Attacks nearby hostile mobs to stay safe |
| 🍖 **Auto Eat** | Eats food automatically to keep health up |
| 💓 **Self-Ping** | Pings itself every 4 minutes to prevent Railway from sleeping |
| 📊 **Web Dashboard** | Live status page with coordinates, uptime, and real-time log console |

---

## 🚀 Quick Start

### 1. Configure Aternos
- Enable **Cracked** mode in your Aternos server settings
- Use **Paper** or **Spigot** as your server software
- Make sure **Whitelist** is turned **OFF**
- Start the server manually once before deploying the bot

### 2. Edit `settings.json`
```json
"server": {
  "ip": "YourServer.aternos.me",
  "port": 12345
},
"bot-account": {
  "username": "YourBotName"
}
```
> ⚠️ Leave `"password": "USE_ENV_VAR"` — the real password is set as a Railway environment variable (see step 4).

### 3. Push to GitHub
Create a new **private** GitHub repository and push all the files.
The included `.gitignore` will automatically keep `node_modules/` and secrets out.

### 4. Deploy on Railway
1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your repository
3. Go to **Variables** and add:
   ```
   BOT_PASSWORD = your_authme_password
   ```
4. Railway auto-detects `npm start` and deploys automatically ✅

---

## ⚙️ Configuration

All settings are in `settings.json`:

### Server
| Key | Description |
|---|---|
| `server.ip` | Your Aternos server address |
| `server.port` | Server port (check Aternos panel — changes on every restart) |
| `server.version` | Minecraft version e.g. `1.21.1` |

### Bot Account
| Key | Description |
|---|---|
| `bot-account.username` | The bot's in-game name (no spaces) |
| `bot-account.type` | `offline` for cracked servers |

### Modules
| Key | Default | Description |
|---|---|---|
| `modules.combat` | `true` | Attack nearby hostile mobs |
| `modules.beds` | `true` | Sleep in beds at night |
| `modules.chat` | `true` | Respond to greetings in chat |
| `modules.avoidMobs` | `true` | Back away from mobs (disabled if combat is on) |

### Movement
| Key | Default | Description |
|---|---|---|
| `movement.circle-walk.enabled` | `true` | Walk in a circle using pathfinder |
| `movement.circle-walk.radius` | `4` | Radius of the circle in blocks |
| `utils.anti-afk.enabled` | `true` | Enable all human-like behaviour modules |

---

## 🛠️ Troubleshooting

| Log message | Cause | Fix |
|---|---|---|
| `ETIMEDOUT` | Aternos server is offline | Bot auto-retries after ~2 min — just wait |
| `ECONNRESET` | Kicked by server | Check `BOT_PASSWORD` env var is correct |
| `No prompt detected after 25s` | AuthMe was slow to respond | Normal — bot handles this automatically |
| `CircleWalk Error` | Bot spawned mid-air or in water | Teleport bot to solid ground in-game |
| Bot connects but doesn't move | Auth kicked before modules started | Check Aternos console for kick reason |

---

## 📁 File Structure

```
├── index.js          # Main bot logic, web server, all modules
├── logger.js         # Shared logging utility
├── settings.json     # All configuration (safe to push — no secrets)
├── package.json      # Dependencies
├── .gitignore        # Keeps node_modules and secrets out of git
└── README.md         # This file
```

---

## 📦 Dependencies

- [mineflayer](https://github.com/PrismarineJS/mineflayer) — Minecraft bot framework
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) — Pathfinding for movement
- [express](https://expressjs.com/) — Web dashboard server
- [minecraft-data](https://github.com/PrismarineJS/minecraft-data) — Minecraft data for item/block lookups

---

## 📄 License

MIT — free to use, modify, and share.

---

<p align="center">Made by Fazzuliyat &nbsp;·&nbsp; Powered by mineflayer</p>
