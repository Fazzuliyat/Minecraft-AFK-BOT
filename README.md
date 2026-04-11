# 🤖 Minecraft AFK Bot

A lightweight Minecraft AFK bot built with **Mineflayer** that supports Anti-AFK movement and automatic sleeping at night.

---

## ✨ Features

- 🔄 Anti-AFK movement system (walking, jumping, looking around)
- 🛏️ Auto sleep at night (finds nearby bed)
- 🔁 Auto reconnect on disconnect
- 🎯 Smooth pathfinding movement
- 🧠 Human-like random actions
- ⚙️ Easy configuration via `settings.json`

---

## 📦 Installation

### 1. Clone the repo
```bash
git clone https://github.com/Fazzuliyat/Minecraft-AFK-BOT
cd Minecraft-AFK-BOT
```

### 2. Install dependencies
```bash
npm install
```

---

## ⚙️ Configuration

Edit `settings.json`:

```json
{
  "bot-account": {
    "username": "AFK_Bot",
    "type": "offline"
  },
  "server": {
    "ip": "localhost",
    "port": 25565,
    "version": false
  }
}
```

---

## 🚀 Run the bot

```bash
node index.js
```

---

## 💤 How Sleep Works

- Bot automatically detects night time
- Searches for a nearby bed
- Walks to the bed using pathfinder
- Sleeps until morning

---

## ⚠️ Notes

- Make sure a bed exists near spawn
- Bot will not sleep in Nether or End
- Some servers may block sleeping

---

## 📌 Requirements

- Node.js v16+
- Minecraft Java server

---

## 🧠 Built With

- Mineflayer
- mineflayer-pathfinder

---

## ⭐ Support

If you like this project, give it a star!
