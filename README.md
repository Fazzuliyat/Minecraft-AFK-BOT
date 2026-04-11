# Fazz AFK Bot

A Minecraft AFK bot that keeps your Aternos server online 24/7 by simulating player activity. Includes a live web dashboard for monitoring and control.

## Features

- **Anti-AFK** — Walks in circles, looks around, and jumps randomly to avoid kicks
- **Bed Sleeping** — Automatically sleeps at night so other players can skip it
- **Auto-Reconnect** — Reconnects automatically; uses longer delay when Aternos is offline
- **Self-Ping** — Pings itself every 4 minutes to stay alive on free hosting
- **Mob Combat** — Attacks nearby hostile mobs
- **Auto-Eat** — Keeps health up automatically
- **Web Dashboard** — Live status page with logs and console

## Setup

### 1. Configure Aternos
- Enable **Cracked** mode in your Aternos server settings
- Use **Paper** or **Spigot** as your server software
- Start the server manually once before deploying the bot

### 2. Edit settings.json
Update `server.ip`, `server.port`, and `bot-account.username`.
Leave `utils.auto-auth.password` as `"USE_ENV_VAR"` — the real password goes in a Render environment variable (see step 4).

### 3. Push to GitHub
Create a new **private** GitHub repo and push all these files.
The included `.gitignore` keeps `node_modules` and secrets out automatically.

### 4. Deploy on Render
1. Go to [render.com](https://render.com) → New Web Service → connect your repo
2. Start Command: `npm start`
3. Under **Environment Variables**, add:
   - Key: `BOT_PASSWORD` | Value: your AuthMe password
4. Instance Type: Free → **Deploy**

The dashboard will be live at your Render URL (e.g. `https://fazz-afk-bot.onrender.com`).

## Troubleshooting

| Log message | Cause | Fix |
|---|---|---|
| `ETIMEDOUT` | Aternos server is offline | Bot auto-retries after ~2 minutes — this is normal |
| `ECONNRESET` | Kicked by server | Check `BOT_PASSWORD` env var on Render is correct |
| `No prompt detected after 25s` | Auth plugin slow to respond | Normal — bot handles this automatically |

## Stack

- Node.js + Express
- mineflayer + mineflayer-pathfinder
