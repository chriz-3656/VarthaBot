# Repository Guidelines

## Project Structure & Module Organization

`server.js` is the main entry point for the API, dashboard, and scheduler. `bot.js` contains Discord client startup, slash command registration, and interaction handling. API routes live in `routes/`, while core behavior is split across `services/`:

- `rssService.js`, `newsPipeline.js`: fetch, normalize, sort, and queue news
- `discordService.js`, `presentationService.js`: embed rendering and Discord delivery
- `runtimeService.js`, `supabaseClient.js`: runtime config and persistence
- `filterService.js`, `dedupService.js`: filtering and duplicate prevention

Frontend files are in `dashboard/` (`index.html`, `style.css`, `app.js`, `favicon.svg`). Runtime data and caches are stored under `data/`. Utility logging lives in `utils/logger.js`.

## Build, Test, and Development Commands

- `npm install`: install dependencies
- `npm start`: run the production server
- `npm run dev`: start with `nodemon` and auto-reload on code changes
- `npm run bot`: run the Discord bot entry directly
- `npm run register:commands`: register slash commands without starting the full app

There is no `npm test` script yet. When validating changes, use targeted checks such as `node --check bot.js` or `node --check server.js`.

## Coding Style & Naming Conventions

Use CommonJS modules, 2-space indentation, and semicolons as already established. Prefer small service functions over large inline handlers. File names use lower camel case with a `Service` suffix where relevant, for example `presentationService.js`. Keep dashboard JavaScript framework-free and match the existing naming style in `dashboard/app.js`.

## Testing Guidelines

This repository does not currently include an automated test framework. For contributions, verify syntax with `node --check`, exercise affected routes or commands manually, and confirm dashboard behavior in the browser. If you add tests later, keep them close to the feature and name them after the module they validate.

## Commit & Pull Request Guidelines

Follow the existing commit history style: short, imperative messages such as `Add live activity rotation and /commands preview command`. Keep commits focused on one change set. PRs should include a summary, any config or environment changes, screenshots for dashboard UI work, and manual verification notes for bot commands or delivery behavior.

## Security & Configuration Tips

Never commit real `.env` secrets. Treat Discord tokens, session secrets, and Supabase credentials as sensitive. Keep `data/` out of PR noise unless a task explicitly changes seeded defaults or schema-related runtime files.
