# VarthaBot - SaaS News Infrastructure

![Vartha Bot Logo](https://i.ibb.co/XM44rgy/logo.png)

A production-grade, multi-tenant Discord news platform. VarthaBot fetches RSS news, processes content, and delivers it to thousands of Discord servers via a robust, cloud-managed infrastructure.

## Table of Contents

- Overview
- Architecture & Tech Stack
- Core Infrastructure Features
- Premium Platform Features
- Setup and Installation
- Environment Variables
- Database Schema
- Run Commands
- Discord Setup & Commands
- SaaS Control Panel
- Recent Bug Fixes
- Developer Details
- License

## Overview

Transformed from a standalone bot into a SaaS platform, `vartha-bot-system` is built for reliable, scalable news delivery. It features isolated delivery queues, OAuth2 authentication, real-time logging, and Supabase PostgreSQL persistence.

## Architecture & Tech Stack

- **Backend**: Node.js + Express
- **Discord SDK**: `discord.js` v14
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Discord OAuth2 (`passport-discord`)
- **Real-Time**: Socket.IO for live terminal logs
- **Frontend**: Vanilla HTML5/CSS3 (No heavy frameworks, highly optimized SaaS UI)
- **Scheduler**: `node-cron`

## Core Infrastructure Features

- **Multi-Tenant Scalability**: Fully isolated settings, feeds, and delivery queues for every connected server.
- **Discord OAuth2**: Secure dashboard access. Users can only manage servers they own or administrate.
- **PostgreSQL Persistence**: No local JSON files. Fully cloud-native database design.
- **Real-Time Log Stream**: WebSocket-powered live terminal built into the dashboard.
- **Hybrid Failover**: Primary bot delivery with automatic per-guild webhook fallback to ensure 100% uptime.
- **Multi-Guild Stabilization**: Staggered fetch cycles with a 500ms delay per guild to prevent Discord API rate limits and CPU spikes.
- **Robust Admin Detection**: Triple-layer permission check (Owner, Administrator, and Manage Server) via `GuildMembers` intent.

## Premium Platform Features

- **Professional Landing Page**: Detailed infrastructure storytelling with real-time system status indicators.
- **Enterprise-Grade UI**: A dark-themed, high-performance dashboard styled after industry leaders like GitHub and Cloudflare.
- **Cache-Busting Assets**: Ensures zero UI lag by forcing immediate updates of CSS and JS assets on the client-side.
- **Global Guild Monitor**: Automatic live-sync with every Discord server the bot joins.

## Setup and Installation

### Prerequisites

- Node.js 20+
- A Discord Application (Bot Token + Client Secret)
- A Supabase Project (URL + Anon Key)

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
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_oauth_secret
DISCORD_CALLBACK_URL=https://your-domain.com/auth/discord/callback
SESSION_SECRET=a_very_secure_random_string
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_public_anon_key
PORT=3000
```

## Database Schema

You must run the SQL schema in your Supabase project before starting the bot. The schema file `supabase_schema.sql` is provided in the repository root.

Simply copy the contents of `supabase_schema.sql` and execute it in the Supabase SQL Editor to create the necessary tables (`users`, `guilds`, `guild_settings`, `feeds`, `seen_articles`, `logs`).

## Run Commands

- Start production: `npm start`
- Start development: `npm run dev`
- Register slash commands: `npm run register:commands`

## Discord Setup & Commands

- `/setup channel:<#channel>`: Configure the target news channel (Admin/Owner only).
- `/news`: Fetch latest news immediately.
- `/info`: Show server-specific bot runtime details.
- `/commands`: List all available commands.
- `/clear`: Bulk delete messages.
- `/reload`: Reload guild configuration.

## SaaS Control Panel

URL: `https://your-domain.com/`

### Features
- **OAuth Secured**: Login with Discord.
- **Guild Management**: View and configure authorized guilds via modular cards.
- **Real-time Status**: Monitor bot health, uptime, and last fetch times across the network.
- **Live Terminal**: Watch your server's fetch and delivery cycle happen in real-time.
- **Remote Configuration**: Update any server's feeds or filters instantly.

## Recent Bug Fixes

- **Migration Fix**: Corrected data retrieval logic to ensure guilds inherit global settings during the transition to Supabase.
- **Queue Isolation**: Refactored the delivery queue to prevent "context leaking," ensuring news is never sent to the wrong channel.
- **Frontend Stability**: Added defensive checks to the dashboard JS to prevent crashes on partial data loads.
- **Syntax Cleanup**: Fixed illegal `continue` statements and code duplication in `server.js` and `bot.js`.

## Developer Details

- Maintainer: `chriz3656`
- Focus: Scalable, production-grade news infrastructure.

## License

MIT


MIT
