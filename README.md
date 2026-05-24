# VarthaBot - Production-Grade News Infrastructure

![Vartha Bot Logo](https://i.ibb.co/XM44rgy/logo.png)

A comprehensive, multi-tenant Discord news platform. VarthaBot fetches RSS news, processes content, and delivers it to thousands of Discord servers via a robust, cloud-managed SaaS infrastructure.

---

## 📜 Project Evolution History

VarthaBot started as a small personal project and evolved into a full-scale SaaS platform.

### **Phase 1: The Standalone MVP**
The initial version was a single-guild bot that relied on hardcoded RSS links and a local `settings.json` file. It was designed for a single server and had no external management interface.

### **Phase 2: Multi-Server Evolution**
The bot was refactored to support multiple Discord servers independently. Data was stored in a keyed JSON format (`settings.json`, `feeds.json`, `seen.json`), allowing each server to have its own configuration. A basic dashboard was introduced for manual management.

### **Phase 3: SaaS Transformation**
To support public scaling, the bot transitioned into a SaaS platform. Local JSON files were removed in favor of **Supabase PostgreSQL**. **Discord OAuth2** was implemented to secure the dashboard, ensuring admins could only manage their own servers. **Socket.IO** was added for real-time log streaming.

### **Phase 4: Premium UI & Production Hardening**
The final evolution involved a total frontend rebuild using a **Vercel/Linear-inspired aesthetic**. The system was production-hardened with robust admin detection (Owner/Admin checks), isolated delivery queues, and staggered fetch cycles to prevent rate limits.

---

## 🗺️ Project Roadmap

### **Completed (Milestones Reached)**
- [x] Multi-server independent configuration.
- [x] Migration from local JSON to Supabase PostgreSQL.
- [x] Secure Discord OAuth2 Authentication for dashboard access.
- [x] Real-time live log terminal via WebSockets.
- [x] Fully responsive, mobile-first SaaS UI.
- [x] Staggered fetch queue (500ms delay) for rate-limit protection.
- [x] Isolated news cache per guild in-memory.
- [x] Robust Admin detection logic (Owner/Admin/Manage Server).
- [x] Global slash command registration with legacy cleanup.

### **Future (Upcoming Features)**
- [ ] **AI Summarization**: Optional per-guild feature to summarize long news articles using Gemini.
- [ ] **Custom Embed Editor**: Allow admins to fully customize the news embed layout via the dashboard.
- [ ] **Multilingual Support**: Expand beyond Malayalam and English to other Indian languages.
- [ ] **Advanced Analytics**: Charts showing delivery performance and click-through rates.
- [ ] **Premium Subscription Tiers**: Tiered limits for news frequency and feed counts.

---

## 💎 Core Platform Features

- **Multi-Tenant Scalability**: Independent settings and feeds for every connected server.
- **Enterprise-Grade UI**: A high-performance, professional dashboard for global management.
- **Hybrid Failover**: Primary bot delivery with automatic per-guild webhook fallback.
- **Live Monitoring**: Monitor bot health and view real-time terminal logs from any server.
- **Automatic Sync**: Real-time synchronization of server names, icons, and status.

---

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Discord SDK**: `discord.js` v14
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Discord OAuth2 (`passport-discord`)
- **Real-Time**: Socket.IO for live logs
- **Frontend**: Vanilla HTML5/CSS3 (Optimized for performance)
- **Runtime**: PM2 (Process Management)

---

## 📦 Installation & Deployment

### Prerequisites
- Node.js 20+
- A Discord Application (Bot Token + Client Secret)
- A Supabase Project (URL + Service Role Key)

### 1. Install
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file from the example:
```bash
cp .env.example .env
```
Fill in your `DISCORD_TOKEN`, `CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Initialize Database
Run the contents of `supabase_schema.sql` in your Supabase SQL Editor to create the required tables.

### 4. Run
```bash
# Production
npm start

# Development
npm run dev

# Command Sync
npm run register:commands
```

---

## 🤖 Discord Setup & Commands

- `/setup channel:<#channel>`: Configure the target news channel (Admin/Owner only). **Sets 30 min delivery interval by default.**
- `/stop`: Stop automated news delivery for this server (Admin/Owner only).
- `/news`: Fetch latest news immediately.
- `/info`: Show server-specific bot runtime details.
- `/commands`: List all available commands.
- `/clear count:<1-100>`: Bulk delete messages.
- `/reload`: Reload guild configuration.

---

## 📝 Changelog

### **v2.5.0 (Latest)**
- **Feature**: Added "Multi-Guild Stabilization" with staggered fetch cycles.
- **Fix**: Resolved critical circular dependency between logger and Supabase client.
- **Fix**: Isolated in-memory news cache per guild (zero data leakage).
- **UI**: Completely rebuilt dashboard with mobile-responsive hamburger menu.
- **Security**: Upgraded to `SUPABASE_SERVICE_ROLE_KEY` for secure backend access.

### **v2.0.0**
- **Migration**: Moved from JSON files to Supabase cloud database.
- **Auth**: Implemented Discord OAuth2 login for dashboard security.
- **Real-Time**: Added Socket.IO log streaming.

### **v1.5.0**
- **Architecture**: Refactored core bot logic to support multiple servers.
- **Feature**: Added `/setup` command for easy channel configuration.

### **v1.0.0**
- Initial release as a standalone Malayalam RSS news bot.

---

## 👨‍💻 Developer Details

- **Maintainer**: `chriz3656`
- **Identity**: VarthaBot Infrastructure Group.
- **Goal**: Reliable, scalable, and fast news automation.

## ⚖️ License

MIT
