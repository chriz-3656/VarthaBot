# VarthaBot Project Context

VarthaBot is a comprehensive Node.js-based news delivery system that fetches RSS feeds (primarily Malayalam and English) and publishes them to Discord channels. It includes a web dashboard for real-time management of feeds, filters, and delivery settings.

## Project Overview

- **Purpose**: Automated news delivery to Discord with a premium UI and failover reliability.
- **Tech Stack**:
    - **Runtime**: Node.js (v18+)
    - **Backend Framework**: Express
    - **Discord Integration**: `discord.js` (v14)
    - **Scheduling**: `node-cron`
    - **RSS Parsing**: `rss-parser`
    - **Frontend**: Vanilla HTML/CSS/JS (Dashboard)
    - **Storage**: JSON-based flat files in `./data/` (designed for future MongoDB migration).

## Multi-Server Architecture

The bot has been refactored to support multiple Discord servers (guilds) independently:

1.  **Keyed Storage**:
    - `settings.json`, `feeds.json`, and `seen.json` are now keyed by `guildId`.
    - A `GLOBAL` key is used for default settings and the dashboard's current management scope.
2.  **Per-Guild Processing**:
    - The cron scheduler in `server.js` iterates through all registered guild IDs in `settings.json`.
    - Each guild has its own fetch interval, filters, and delivery status.
3.  **Interaction Scoping**:
    - Slash commands and buttons in `bot.js` extract the `guildId` from the interaction context.
    - Settings and feeds are loaded/saved specifically for the guild where the command was issued.
4.  **Dashboard Note**:
    - The dashboard currently manages the `GLOBAL` settings. To manage specific guilds via the dashboard, future updates would require OAuth2 and guild selection.

## Key Commands

- `npm install`: Install project dependencies.
- `npm start`: Start the full system (API + Bot).
- `npm run dev`: Start in development mode with `nodemon`.
- `npm run bot`: Start only the Discord bot.
- `npm run register:commands`: Register slash commands to Discord (Global & Guild).

## Development Conventions

- **Environment Variables**: Managed via `.env` (see `.env.example`).
- **Data Persistence**: Always use `services/storageService.js` or `services/runtimeService.js` to interact with data files to ensure consistency.
- **Service Isolation**: Keep logic decoupled. For example, `presentationService.js` handles all UI/Embed formatting, while `rssService.js` focuses on fetching and parsing.
- **Delivery Safety**: The `deliveryEnabled` flag in `settings.json` (controlled via dashboard) must be `true` for the scheduler to send news.
- **Logging**: Use `utils/logger.js`. Log levels are configurable via `LOG_LEVEL` environment variable.

## Dashboard Access

- **Local**: `http://localhost:3000/dashboard` (default port).
- The dashboard allows manual fetching, enabling/disabling delivery, and managing RSS feeds without restarting the bot.

## Slash Commands

- `/setup channel:<#channel>`: Configure the target channel for automated news delivery (Admin only).
- `/news`: Fetch latest news immediately (ephemeral/public based on context).
- `/info`: Display bot uptime, status, and settings.
- `/clear`: Bulk delete messages (supports DM and Guild).
- `/commands`: List all available commands.
- `/reload`: Admin-only command to reload settings/feeds from disk.
