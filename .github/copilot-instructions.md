# Copilot Instructions for VarthaBot

## Quick Commands

**Development:**
```bash
npm run dev          # Start with nodemon (watches code changes, ignores data/)
npm start            # Production mode
npm run bot          # Bot-only mode (no API server)
npm run register:commands  # Register Discord slash commands only
```

**No linting, testing, or build step exists.** This is a runtime Node.js app.

## Architecture Overview

VarthaBot is a **modular Malayalam/English Discord news bot** with a dashboard. It fetches RSS feeds, filters/deduplicates content, and delivers formatted news to Discord via bot or webhook.

### Core Flow

1. **Scheduler** (cron, runs every minute) checks if fetch cycle should run based on `fetchIntervalSeconds`
2. **News Pipeline** (`newsPipeline.js`):
   - Fetches enabled RSS feeds in parallel
   - Extracts media (images) from enclosures, media tags, or HTML
   - Applies filters (include/exclude keywords)
   - Deduplicates against last 200 items
   - Sorts by priority (breaking-first heuristic)
   - Caches normalized results
3. **Discord Delivery** (`discordService.js`):
   - Queues messages with rate limiting
   - Tries bot send first (if `postMode: bot` or `hybrid`)
   - Falls back to webhook on failure (if `postMode: hybrid`)
   - Logs delivery method used
4. **Dashboard** (Express + vanilla JS):
   - Real-time status, feed management, log viewing
   - API-driven (`/api/*` endpoints)
   - Controls delivery on/off, fetch now, send latest

### Key Services

| Service | Purpose |
|---------|---------|
| `rssService.js` | Feed fetching, HTML cleanup, media extraction, caching |
| `filterService.js` | Include/exclude keyword matching |
| `dedupService.js` | SHA1-based duplicate detection (last 200 items) |
| `presentationService.js` | Discord embed building (card/compact style, buttons, relative time) |
| `discordService.js` | Queue-based delivery with bot/webhook failover |
| `newsPipeline.js` | Orchestrates fetch → filter → dedup → sort → cache flow |
| `runtimeService.js` | Getter/setter for feeds, settings (JSON files) |
| `storageService.js` | Low-level JSON file read/write |

### Data Flow

- **Input**: RSS feeds (10 default Malayalam/English sources in `config.js`)
- **Processing**: Filter → Dedup → Priority sort
- **Storage**: `data/` (JSON files, intentionally migration-friendly to MongoDB)
  - `feeds.json` - Feed definitions
  - `settings.json` - Runtime controls (postMode, fetchInterval, filters, embed style)
  - `seen.json` - Last 200 item hashes (dedup memory)
  - `newsCache.json` - Latest normalized items
  - `logs.jsonl` - JSONL log stream (persistent + in-memory last 300)
- **Output**: Discord embeds via bot or webhook

## Code Patterns

### Modular Service Design

Each service exports a focused set of functions. Keep services stateless where possible:
- `rssService.readFeeds()` → fetches all enabled feeds
- `filterService.isAllowed(item, settings)` → boolean filter
- `dedupService.isDuplicate(item, seen)` → check against history
- `discordService.enqueueNews(items, ...)` → adds to delivery queue

**Cross-service calls are OK** (e.g., `newsPipeline.js` calls all of them). Avoid circular dependencies.

### Settings Schema Pattern

All runtime controls live in `settings.json`. Changes must be synced to:
1. `config.js` defaults (initial values)
2. `data/settings.json` (actual storage)
3. Dashboard form bindings in `dashboard/app.js`

Example: adding a new setting like `maxTitleLength`:
```javascript
// config.js
maxTitleLength: 100,

// On dashboard: add input field, bind to GET/POST /api/settings
// In presentationService.js: truncate titles to this limit
```

### Discord Interaction Safety

Commands defer first, then edit reply:
```javascript
await interaction.deferReply();
// ... async work ...
await interaction.editReply({ content: '...' });
```

This prevents Discord timeout errors (10062). All commands in `bot.js` follow this pattern.

### Logging Convention

Use `logger` from `utils/logger.js`:
```javascript
logger.info('Fetch started', { feedCount: 10 });
logger.warn('Bot send failed, using webhook', { error: e.message });
logger.debug('Duplicate found', { title: item.title });  // Only if LOG_LEVEL=debug
```

Logs go to both:
- **Console** (clean by default, JSON metadata only if `LOG_VERBOSE=true`)
- **JSONL file** at `data/logs.jsonl` (always full metadata)
- **In-memory** (last 300 entries for dashboard)

Recommended dev settings: `LOG_LEVEL=info`, `LOG_VERBOSE=false`.

### Environment & Secrets

All config lives in `.env`:
```env
DISCORD_TOKEN=...      # Bot token from Developer Portal
CLIENT_ID=...          # Application ID
GUILD_ID=...           # Test server ID (guild commands)
WEBHOOK_URL=...        # Optional webhook for fallback
PORT=3000
LOG_LEVEL=info
LOG_VERBOSE=false
```

**Never commit `.env`** (`.gitignore` already excludes it). Use `.env.example` for template.

## Common Tasks

### Adding a New Feed Source

Edit `config.js` defaults:
```javascript
{
  id: 'bbc-world',
  name: 'BBC World',
  url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
  enabled: true
}
```

Also add favicon/fallback image in `sourceFallbackImages` if available. Priority can be set in `sourcePriority`.

### Changing Embed Style

Edit `settings.json`:
- `embedStyle: 'card'` | `'compact'` (default: `card`)
- `accentColor: '#7C3AED'` (hex color)
- `enableImages: true` | `false`
- `descriptionLength: 200` (char limit)

`presentationService.js` reads these at render time.

### Adjusting Fetch Schedule

`fetchIntervalSeconds` in `settings.json` (default: 1800 = 30 min). Scheduler checks every minute and runs if interval elapsed.

### Testing Delivery

Use dashboard buttons or API:
```bash
# Fetch now (updates cache but doesn't send unless new items exist)
curl -X POST http://localhost:3000/api/fetch

# Send latest cached item directly
curl -X POST http://localhost:3000/api/send-latest
```

For testing in dev, manually send items by:
1. Ensuring `deliveryEnabled: true` in settings
2. Using dashboard "Send Latest News" button
3. Or triggering `/fetch` then `/send-latest` from API

### Failover Behavior (Hybrid Mode)

Default `postMode: 'hybrid'`:
1. Bot tries to send to channel
2. On **any** error (permissions, rate limit, bot offline), falls back to webhook
3. Both methods logged separately
4. Optional retry settings: `retryBotAfterFallback`, `retryBotDelayMs`

If webhook not configured, hybrid degrades to bot-only.

## Important Notes

- **Nodemon setup**: `nodemon.json` ignores `data/**` and `node_modules/**` to prevent restart loops during runtime file changes
- **Dedup window**: Last 200 items (configurable `MAX_ITEMS` in `dedupService.js`). Older items may be fetched again if source cycles
- **Media extraction**: Tries `enclosure` → `media:content` → `media:thumbnail` → HTML `<img>` fallback. URLs normalized to absolute paths
- **Rate limiting**: Queue-based with `rateLimitMs` (default 1200ms between sends) to respect Discord rate limits
- **Command scope**: `/news`, `/info`, `/clear` are global (DM-enabled); `/reload` is guild-only + admin-only
- **Global command propagation**: Can take a few minutes after registering. Use guild commands for testing
- **Dashboard access**: No auth by default. Restrict in production via reverse proxy or IP allowlist
