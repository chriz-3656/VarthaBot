# Vartha Bot System

![Vartha Bot Logo](https://i.ibb.co/XM44rgy/logo.png)

Advanced Malayalam Discord news bot + Global Monitor dashboard control panel.

This project fetches RSS news, processes and prioritizes content, and publishes to Discord with a premium embed UI. It supports multiple servers independently and includes a centralized web dashboard for management.

## Table of Contents

- Overview
- Core Features
- Multi-Server Architecture
- Tech Stack
- Project Structure
- Setup and Installation
- Environment Variables
- Run Commands
- Discord Setup (Invite + Slash Commands)
- Delivery Modes (Bot / Webhook / Hybrid Failover)
- Global Monitor Dashboard
- API Reference
- News Processing Pipeline
- Embed UI (v2)
- Scheduling and Intervals
- Data Storage
- Logging and Monitoring
- Security Notes
- Troubleshooting and Fixes
- Development Notes
- Developer Details
- Roadmap
- License

## Overview

`vartha-bot-system` is built for reliable Malayalam/English mixed news delivery in Discord. It is designed to scale across multiple servers, allowing each server to have its own unique configuration while being monitored globally.

## Core Features

- **Multi-Server Support**: Independent settings, feeds, and filters for every server.
- **Auto-fetch RSS feeds** on customizable schedules per guild.
- **Dedicated Setup**: `/setup` command to lock news to a specific channel.
- **Premium Discord embeds** with image support and branding.
- **Category tagging** (Breaking, Politics, Kerala, Tech, General).
- **Global Monitor Dashboard**: Manage all connected servers and view live system logs from one interface.
- **Hybrid failover delivery**: Primary bot delivery with automatic per-guild webhook fallback.
- **Robust Admin Detection**: Triple-layer permission check (Owner, Administrator, and Manage Server).
- **Redundant Queue Isolation**: Per-guild delivery context ensures zero data leakage between servers.
- **Interaction-safe** handling (`deferReply`) to avoid Discord timeouts.

## Multi-Server Architecture

The bot uses a keyed storage system to isolate data:
- **`settings.json`**: Keyed by `guildId`, contains channel IDs, intervals, and UI preferences.
- **`feeds.json`**: Keyed by `guildId`, contains the RSS sources for each specific server.
- **`seen.json`**: Keyed by `guildId`, ensures news items aren't duplicated within a server.
- **`GLOBAL` fallback**: System-wide defaults for new servers.

## Tech Stack

- Backend: Node.js + Express
- Discord SDK: `discord.js` v14
- Scheduler: `node-cron`
- RSS Parsing: `rss-parser`
- Frontend: HTML, CSS, Vanilla JavaScript (Global Monitor)
- Storage: JSON files (`data/`)
- Runtime env: `dotenv`

## Project Structure

```text
.
├── server.js (API + Scheduler)
├── bot.js (Discord Client)
├── config.js (Defaults + Env)
├── routes/
│   └── api.js (Multi-guild API)
├── services/
│   ├── dedupService.js (Per-guild dedup)
│   ├── discordService.js (Hybrid delivery)
│   ├── newsPipeline.js (Fetch cycle)
│   ├── runtimeService.js (Guild data management)
│   └── storageService.js (JSON persistence)
├── dashboard/ (Global Monitor Frontend)
├── utils/
    └── logger.js (Centralized logging)
└── data/ (Ignored in Git, persistent in production)
```

## Setup and Installation

### Prerequisites

- Node.js 20+
- A Discord application + bot token

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_TOKEN=your_token
CLIENT_ID=your_id
PORT=3000
```
*Note: `GUILD_ID` and `WEBHOOK_URL` can be left empty for public/global use.*

## Run Commands

- Start production: `npm start`
- Start development: `npm run dev`
- Register slash commands: `npm run register:commands`

## Discord Setup

### Slash Commands
- `/setup channel:<#channel>`: Configure the news channel (Admin only).
- `/news`: Fetch latest news immediately.
- `/info`: Show server-specific bot runtime details.
- `/commands`: List all available commands.
- `/clear`: Bulk delete messages.
- `/reload`: Reload guild configuration.

## Global Monitor Dashboard

URL: `http://localhost:3000/dashboard`

### Features
- **Server Selector**: Switch between "System Defaults" and specific connected servers.
- **Real-time Status**: Monitor bot health, uptime, and last fetch times across the network.
- **Live Logs**: Stream system-wide logs with guild-level metadata.
- **Remote Configuration**: Update any server's feeds or filters without leaving the dashboard.

## Security Notes

- **Secret Protection**: `.env` and `data/*.json` are ignored by Git.
- **Admin Gated**: `/setup` and `/reload` require robust permission checks. The bot automatically detects Server Owners and users with the `Administrator` or `Manage Server` permissions.
- **Expanded Intents**: Uses `GuildMembers` and `Guilds` intents for accurate permission calculation.
- **Rate Limiting**: Built-in queue system prevents Discord API spam.

## Developer Details

- Maintainer: `chriz3656`
- Focus: Scalable Malayalam news delivery.

## License

MIT
