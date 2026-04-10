# Vartha Bot System

![Vartha Bot Logo](https://i.ibb.co/XM44rgy/logo.png)

Advanced Malayalam Discord news bot + modular dashboard control panel.

This project fetches RSS news, processes and prioritizes content, and publishes to Discord with a premium embed UI. It includes a web dashboard for feed management, filters, delivery settings, and live monitoring.

## Table of Contents

- Overview
- Core Features
- Architecture
- Tech Stack
- Project Structure
- Setup and Installation
- Environment Variables
- Run Commands
- Discord Setup (Invite + Slash Commands)
- Delivery Modes (Bot / Webhook / Hybrid Failover)
- Dashboard Guide
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

`vartha-bot-system` is built for reliable Malayalam/English mixed news delivery in Discord.

Key goals:
- Reliable delivery (bot-first with webhook failover)
- Clean, configurable embed format
- Duplicate prevention and feed filtering
- Real-time dashboard control
- Modular code, easy to scale (MongoDB-ready)

## Core Features

- Auto-fetch RSS feeds on schedule
- Premium Discord embeds with image support and fallback image
- Source-specific fallback image system (per news source branding)
- Category tagging (Breaking, Politics, Kerala, Tech, General)
- Description sanitization + truncation
- Relative timestamp formatting in embeds
- Slash commands:
  - `/news`
  - `/info` (works in DM)
  - `/clear` (works in DM + guild)
  - `/reload` (guild admin)
- Dashboard controls for:
  - feed management
  - filter settings
  - embed style and branding
  - fetch/send actions
- Hybrid failover delivery:
  - primary bot send
  - fallback webhook on error
- Last-100 duplicate prevention
- Feed priority sorting (breaking-first bias)
- Interaction-safe command handling (`deferReply` flow) to avoid Discord timeout errors

## Architecture

High-level flow:

1. Scheduler/API triggers fetch cycle
2. RSS parser fetches enabled feeds
3. Content sanitized and normalized
4. Filtering rules applied (include/exclude keywords)
5. Dedup check (last 100 IDs)
6. Priority sorting (breaking/news relevance)
7. Delivery queue dispatches to Discord
8. Bot send attempted first in hybrid mode
9. Webhook fallback only if bot fails
10. Dashboard and logs update via API polling

## Tech Stack

- Backend: Node.js + Express
- Discord SDK: `discord.js` v14
- Scheduler: `node-cron`
- RSS Parsing: `rss-parser`
- Frontend: HTML, CSS, Vanilla JavaScript
- Storage: JSON files (`data/`)
- Runtime env: `dotenv`

## Project Structure

```text
.
├── server.js
├── bot.js
├── config.js
├── package.json
├── README.md
├── routes/
│   └── api.js
├── services/
│   ├── dedupService.js
│   ├── discordService.js
│   ├── filterService.js
│   ├── newsPipeline.js
│   ├── presentationService.js
│   ├── rssService.js
│   ├── runtimeService.js
│   └── storageService.js
├── dashboard/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── utils/
│   └── logger.js
└── data/
    ├── feeds.json
    ├── settings.json
    ├── seen.json
    ├── newsCache.json
    └── logs.jsonl
```

## Setup and Installation

### Prerequisites

- Node.js 18+ (recommended 20+)
- A Discord application + bot token
- Optional: Discord webhook URL

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
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
WEBHOOK_URL=
PORT=3000
LOG_LEVEL=info
LOG_VERBOSE=false
```

## Environment Variables

- `DISCORD_TOKEN`: bot token from Discord Developer Portal
- `CLIENT_ID`: Discord application ID
- `GUILD_ID`: test/development server ID (guild commands)
- `WEBHOOK_URL`: optional webhook for fallback/webhook mode
- `PORT`: API/dashboard port (default `3000`)
- `LOG_LEVEL`: `debug | info | warn | error` (default `info`)
- `LOG_VERBOSE`: `true/false` to print JSON metadata in terminal (default `false`)

## Run Commands

- Start production mode:

```bash
npm start
```

- Start development mode (nodemon):

```bash
npm run dev
```

- Start bot-only entry:

```bash
npm run bot
```

- Register slash commands only:

```bash
npm run register:commands
```

## Discord Setup (Invite + Slash Commands)

### Invite URL

Replace `YOUR_CLIENT_ID`:

```text
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877975552&scope=bot%20applications.commands
```

### Command scope behavior

- Global commands (DM-enabled): `/info`, `/news`, `/clear`
- Guild commands (server): `/info`, `/news`, `/clear`, `/reload`

Note: Global command propagation can take a few minutes.

## Delivery Modes (Bot / Webhook / Hybrid Failover)

Configured via `settings.postMode`.

### `bot`
- Uses Discord bot identity (`channel.send`)
- Supports buttons/interactions
- Requires valid `discordChannelId` + permissions

### `webhook`
- Uses webhook identity
- Good fallback/manual mode
- No real bot presence status

### `hybrid` (recommended)
- Bot is primary sender
- Automatic webhook fallback on bot send failure
- Prevents duplicates in normal flow

Failover logs:
- `[INFO] Message sent via bot`
- `[WARN] Bot failed, sent via webhook`
- `[ERROR] Both bot and webhook failed`

Optional retry settings:
- `retryBotAfterFallback`
- `retryBotDelayMs`

## Dashboard Guide

Dashboard URL:

```text
http://localhost:3000/dashboard
```

### Main modules

- **Status**
  - bot online/offline
  - uptime
  - last fetch
  - active feed count
  - cached news count

- **Controls**
  - post mode
  - channel ID
  - fetch interval
  - rate limits
  - keyword filters
  - embed style controls
  - branding text

- **RSS Feeds**
  - add feed
  - enable/disable feed
  - remove feed

- **Latest News**
  - quick list with category/time
  - clickable card opens article

- **Live Logs**
  - color-coded log lines
  - auto-scroll to latest

### Quick action buttons

- `Start News Delivery`: unlocks scheduler + delivery after startup confirmation
- `Stop News Delivery`: pauses scheduler-triggered fetch/send and locks delivery
- `Fetch Now`: fetches feed cycle; if no new items sent, auto-sends latest cached item
- `Send Latest News`: sends latest cached item directly

### Theme

- Built-in Light/Dark mode toggle
- Preference saved in browser local storage

## API Reference

Base: `/api`

- `GET /api/news`
- `POST /api/fetch`
- `POST /api/send-latest`
- `POST /api/delivery/start`
- `POST /api/delivery/stop`
- `GET /api/feeds`
- `POST /api/feeds`
- `PATCH /api/feeds/:id`
- `DELETE /api/feeds/:id`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/logs?limit=120`
- `GET /api/status`

## News Processing Pipeline

- Feed fetch with retry
- HTML cleanup and normalization
- Image extraction from:
  - `enclosure`
  - `media:content`
  - `media:thumbnail`
  - html `<img>` fallback
- Filter pass (include/exclude keywords)
- Dedup pass (`seen.json`)
- Priority sorting (breaking-first heuristic)
- Queue-based Discord dispatch with delay (`rateLimitMs`)

## Embed UI (v2)

Renderer: `services/presentationService.js`

Supports:
- Card or compact style
- Accent color customization
- Category tag field
- Relative time in description
- Optional image + fallback image
- Branding footer text
- Buttons:
  - `📖 Read Full News`
  - `🔄 Refresh`
  - `🔗 Share`

## Scheduling and Intervals

- Scheduler runs every minute internally
- Actual fetch happens only when interval elapsed
- Controlled by `settings.fetchIntervalSeconds`
- Default is `1800` (30 minutes)
- Scheduler stays idle until delivery is enabled from dashboard (`Start News Delivery`)

## Data Storage

Files under `data/`:

- `feeds.json`: RSS sources
- `settings.json`: runtime controls
- `seen.json`: dedup memory (last 100 IDs)
- `newsCache.json`: latest normalized news cache
- `logs.jsonl`: persistent log stream

This design is intentionally migration-friendly to MongoDB.

## Logging and Monitoring

- In-memory recent logs + `logs.jsonl` persistence
- Dashboard log panel with color coding
- Delivery method and failover events logged explicitly
- Terminal logging is clean/minimal by default:
  - no JSON metadata unless `LOG_VERBOSE=true`
  - feed-attempt and duplicate-level noise moved to `debug`
- Recommended dev defaults:
  - `LOG_LEVEL=info`
  - `LOG_VERBOSE=false`

## Security Notes

- Never commit real `.env` secrets
- Rotate token/webhook if leaked
- Restrict dashboard access in production (reverse proxy/auth)
- Use role-based command permissions (`/reload` already admin-gated)

## Troubleshooting and Fixes

### 1) Bot appears offline sender identity in channel
Cause: message came from webhook mode.
Fix: set `postMode: bot` or keep `hybrid` and ensure bot channel permissions.

### 2) Feed fetch 200 but parser fails
Cause: URL points to HTML page, not XML feed.
Fix: use direct XML feed endpoints.

### 3) No embed images showing
Cause: parser did not map media fields initially.
Fix: media custom field extraction + URL normalization now implemented.

### 4) Dev server restarting repeatedly
Cause: nodemon watched data files changed during runtime.
Fix: `nodemon.json` ignores `data/**` and `node_modules/**`.

### 5) Dashboard settings appear to reset
Cause: periodic auto-refresh overwriting in-progress edits.
Fix: dirty/saving state guard in frontend prevents overwrite while editing.

### 6) `/reload` in DM fails
Expected: `/reload` is guild-only and admin-only by design.

### 7) Slash command not visible in DM immediately
Global command propagation can take a few minutes.

### 8) `/clear` fails in guild
Cause: missing `Manage Messages` permission.
Fix: grant `Manage Messages` to your role or run as admin.

### 9) `Unknown interaction (10062)` in logs
Cause: interaction response took too long.
Fix: commands/buttons now defer first and then edit reply (`deferReply` + `editReply`).

## Development Notes

- Keep services modular; avoid cross-layer coupling
- Prefer primary bot delivery with fallback webhook
- Preserve dedup guarantees before enqueueing sends
- If changing settings schema, update:
  - `config.js` defaults
  - `data/settings.json`
  - dashboard form bindings

## Developer Details

- Project: `vartha-bot-system`
- Maintainer/Developer: `chriz3656`
- Email: `chrizmonsaji@proton.me`
- Website: `https://chriz-3656.github.io`
- GitHub: `https://github.com/chriz-3656/VarthaBot`
- Language focus: Malayalam + English mixed newsroom delivery

## Roadmap

- AI summarization per article
- Multi-channel rules engine
- Role-based dashboard access
- Click analytics and delivery metrics
- MongoDB/PostgreSQL storage adapter
- WebSocket live dashboard updates

## License

MIT (or update as needed)
