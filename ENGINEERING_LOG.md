# 🚀 VarthaBot: Full Engineering & Architectural Walkthrough

This document serves as the official historical engineering log and feature breakdown for **VarthaBot**, tracing its origins from a standalone Discord bot to a fully realized, multi-tenant SaaS application.

---

## 📜 1. The Historical Evolution

VarthaBot was originally built to solve a simple problem: automating Malayalam news delivery to a single Discord server. It has since evolved through four distinct architectural phases:

### **Phase 1: The Standalone MVP (v1.0.0)**
*   **Architecture:** A monolithic Node.js script.
*   **Data Storage:** Hardcoded RSS feed links and a single local `settings.json` file.
*   **Features:** Basic XML parsing and linear Discord messaging. It lacked any web interface or dynamic configuration capabilities.

### **Phase 2: Multi-Server Scaling (v1.5.0)**
*   **Architecture:** Refactored to support multiple Discord servers (Guilds) simultaneously without cross-contamination of settings.
*   **Data Storage:** State was migrated to a keyed JSON flat-file format (`settings.json`, `feeds.json`, `seen.json`).
*   **Features:** Admins gained the ability to use the `/setup` Discord slash command to dynamically assign news channels. A primitive web dashboard was created for the bot owner to monitor multiple servers manually.

### **Phase 3: The SaaS Transformation (v2.0.0)**
*   **Architecture:** The local JSON flat-files could not survive cloud scaling or concurrent reads/writes. The backend was completely rewritten to support a live database.
*   **Data Storage:** Migrated to **Supabase (PostgreSQL)** in the cloud.
*   **Security & Auth:** Implemented **Discord OAuth2** (`passport-discord`). The dashboard was locked down so server admins could securely log in and only manage the feeds and settings for servers where they hold `MANAGE_GUILD` permissions.
*   **Real-Time Data:** Integrated **Socket.IO** to stream live terminal logs from the Node backend directly to the web dashboard UI.

### **Phase 4: The V2 Master Design & Analytics (v2.6.0 - Present)**
*   **Architecture:** Total frontend UI/UX overhaul focusing on enterprise-grade aesthetics and mobile responsiveness.
*   **Design System:** Stripped away all default Discord "blurple" (`#7C3AED`) and generic UI templates. Enforced a rigid, highly opinionated color palette (Charcoal, Teal, and Orange `#FF5A1F`) with custom typography (`Sora` and `Plus Jakarta Sans`).
*   **Data Visualization:** Added a new `/api/analytics` REST endpoint that queries Supabase for historical log data. Rendered these metrics using **Chart.js** on the dashboard to visualize "Fetched Articles" vs. "Delivered Unique Articles", proving the power of the internal deduplication engine.

---

## 🎨 2. The V2 Design System & UX Fixes

The transition to V2 was not just aesthetic; it involved deep user experience fixes across the board.

*   **Responsive Grids & Drawers:** The dashboard was constrained heavily on mobile devices. All CSS Grids were wrapped in aggressive `@media` queries to force 1-column layouts. The mobile sidebar was upgraded to a **Native Drawer** experience with a darkened backdrop overlay and automatic dismissal logic upon navigation.
*   **The "Ghost Purple" Database Fix:** During the V2 rollout, the bot persistently sent purple Discord embeds despite the local codebase being updated to Orange. It was discovered that the live Supabase PostgreSQL database had explicitly cached the old `#7C3AED` hex codes for legacy servers. A custom migration script was executed on the production VPS (`UPDATE guild_settings SET accent_color = '#FF5A1F' WHERE accent_color = '#7C3AED'`) to force all tenants onto the new V2 brand standard.
*   **Truth in Advertising:** The public landing page was purged of dummy SaaS templates (fake pricing, non-existent AI features). It was rebuilt to showcase genuine bot capabilities, complete with an interactive CSS replica of the bot's Discord embed, allowing users to preview the product instantly.

---

## ⚙️ 3. Core Engine Mechanics

Behind the sleek dashboard lies a robust automation engine designed for high throughput and strict Discord API compliance.

*   **Smart Deduplication Pipeline:** Fetched RSS articles are hashed and cross-referenced against a Supabase cache. Only genuinely fresh, non-duplicate articles are passed down the pipeline.
*   **Staggered Delivery Queues:** To prevent triggering Discord's aggressive global rate limits (HTTP 429), the delivery service buffers outgoing embeds and dispatches them with strict 500ms staggered delays across all connected guilds.
*   **Hybrid Failover Routing:** The system prioritizes delivering news via the primary Bot Client. If the bot lacks permissions in a target channel, it automatically falls back to an emergency Webhook.

---

### 📝 Operational Commands Reference
For future maintenance, the production VPS environment relies on the following stack:
*   **Process Manager:** `pm2` (Target Process: `varthabot`)
*   **Restart Command:** `export PATH=$PATH:/home/ubuntu/.nvm/versions/node/v24.14.1/bin && pm2 restart varthabot`
*   **Database Management:** Supabase SQL Editor and `supabase_schema.sql` migrations.
