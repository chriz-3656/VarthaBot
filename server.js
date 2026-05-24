const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cron = require('node-cron');
const { env } = require('./config');
const logger = require('./utils/logger');
const { initBot, getClient } = require('./bot');
const { createApiRouter } = require('./routes/api');
const { runFetchCycle } = require('./services/newsPipeline');
const { getNewsCache } = require('./services/rssService');
const { getSettings, setSettings, getAllGuildIds } = require('./services/runtimeService');
const { enqueueNews } = require('./services/discordService');
const supabase = require('./services/supabaseClient');

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- Auth Setup ---
const sessionMiddleware = session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in prod with HTTPS
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

io.use((socket, next) => {
  if (env.DISCORD_CLIENT_SECRET && !socket.request.session?.passport?.user) {
    return next(new Error('Unauthorized'));
  }
  next();
});

io.on('connection', (socket) => {
  socket.on('subscribe_logs', (guildId) => {
    socket.join(`logs_${guildId}`);
  });
});

logger.events.on('log', (entry) => {
  const guildId = entry.meta?.guildId || 'GLOBAL';
  io.to(`logs_${guildId}`).emit('new_log', entry);
  if (guildId !== 'GLOBAL') {
    io.to('logs_GLOBAL').emit('new_log', entry);
  }
});

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (env.DISCORD_CLIENT_SECRET && env.DISCORD_CALLBACK_URL) {
  passport.use(new DiscordStrategy({
      clientID: env.CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      callbackURL: env.DISCORD_CALLBACK_URL,
      scope: ['identify', 'guilds']
  }, async (accessToken, refreshToken, profile, done) => {
      try {
        if (env.SUPABASE_URL) {
          await supabase.from('users').upsert({
            discord_user_id: profile.id,
            username: profile.username,
            avatar: profile.avatar,
            email: profile.email,
            last_login: new Date().toISOString()
          }, { onConflict: 'discord_user_id' });
        }
        return done(null, profile);
      } catch (err) {
        return done(err, null);
      }
  }));

  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
      res.redirect('/dashboard/');
  });
  app.get('/auth/logout', (req, res, next) => {
      req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
      });
  });
}

function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/auth/discord');
}

// --- End Auth ---

app.use(express.json());

const state = {
  startedAt: new Date().toISOString(),
  locks: new Set(),
  lastRunAt: {}
};

async function guardedFetch(reason, opts = {}) {
  const guildId = opts.guildId || 'GLOBAL';
  if (state.locks.has(guildId)) {
    logger.warn('Fetch skipped: previous cycle still running', { reason, guildId });
    return { skipped: true, reason: 'busy', guildId };
  }

  state.locks.add(guildId);
  try {
    const result = await runFetchCycle(
      {
        getClient
      },
      {
        reason,
        force: opts.force || false,
        dispatchToDiscord: opts.dispatchToDiscord !== false,
        guildId
      }
    );

    state.lastRunAt[guildId] = Date.now();
    return result;
  } finally {
    state.locks.delete(guildId);
  }
}

async function sendLatestNews(count = 1, guildId = 'GLOBAL') {
  const settings = await getSettings(guildId);
  if (settings.deliveryEnabled === false) {
    return { sent: 0, reason: 'delivery_disabled', guildId };
  }

  const latest = getNewsCache(guildId).slice(0, Math.max(1, count));

  if (latest.length === 0) {
    return { sent: 0, reason: 'no_cached_news', guildId };
  }

  enqueueNews(latest, {
    settings,
    client: getClient()
  });

  return {
    sent: latest.length,
    titles: latest.map((item) => item.title),
    guildId
  };
}

async function startDelivery(guildId = 'GLOBAL') {
  const current = await getSettings(guildId);
  if (current.deliveryEnabled !== true) {
    await setSettings(
      {
        ...current,
        deliveryEnabled: true
      },
      guildId
    );
    logger.info('News delivery enabled', { guildId });
  }

  return { deliveryEnabled: true, guildId };
}

async function stopDelivery(guildId = 'GLOBAL') {
  const current = await getSettings(guildId);
  if (current.deliveryEnabled !== false) {
    await setSettings(
      {
        ...current,
        deliveryEnabled: false
      },
      guildId
    );
    logger.info('News delivery disabled', { guildId });
  }

  return { deliveryEnabled: false, guildId };
}

const apiContext = {
  manualFetch: (reason, opts) => guardedFetch(reason || 'manual', { ...opts, force: true, dispatchToDiscord: true }),
  sendLatest: (count, guildId) => sendLatestNews(count, guildId),
  startDelivery: (guildId) => startDelivery(guildId),
  stopDelivery: (guildId) => stopDelivery(guildId),
  getClient,
  startedAt: state.startedAt,
  getLastRunAt: (guildId) => state.lastRunAt[guildId || 'GLOBAL'] || 0
};

app.use(express.static(path.join(__dirname, 'public')));

const requireAuth = env.DISCORD_CLIENT_SECRET ? checkAuth : (req, res, next) => next();

const apiRouter = createApiRouter(apiContext);

// API route with selective protection
app.use('/api', (req, res, next) => {
  // Allow public access to these specific paths
  if (req.path === '/status' || req.path === '/news') {
    return next();
  }
  // All other /api/* routes require authentication
  return requireAuth(req, res, next);
}, apiRouter);

app.use('/dashboard', requireAuth, express.static(path.join(__dirname, 'dashboard')));

app.get('/', (_req, res) => {
  if (!env.DISCORD_CLIENT_SECRET) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user?.id,
      username: req.user?.username,
      avatar: req.user?.avatar
    },
    guilds: req.user?.guilds?.filter(g => (g.permissions & 0x8) === 0x8 || (g.permissions & 0x20) === 0x20 || g.owner) || []
  });
});

server.listen(env.PORT, () => {
  logger.info(`Dashboard/API server running on http://localhost:${env.PORT}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason: reason?.message || reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error: error.message, stack: error.stack });
});

cron.schedule('* * * * *', async () => {
  const allIds = await getAllGuildIds();
  const guildIds = ['GLOBAL', ...allIds];
  const now = Date.now();

  for (const guildId of guildIds) {
    try {
      const settings = await getSettings(guildId);
      if (settings.deliveryEnabled === false) {
        continue;
      }

      const intervalMs = Math.max(60, Number(settings.fetchIntervalSeconds || 1800)) * 1000;
      const lastRun = state.lastRunAt[guildId] || 0;

      if (lastRun > 0 && now - lastRun < intervalMs) {
        continue;
      }

      await guardedFetch('cron', { guildId });
      // Stagger fetches slightly to avoid rate limit spikes
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      logger.error('Error during cron processing for guild', { guildId, error: err.message });
    }
  }
});

initBot({
  onReload: async (guildId) => {
    logger.info('Reload requested from slash command', { guildId });
  },
  onNewsRequest: async (guildId) => {
    return guardedFetch('slash-news', { force: true, dispatchToDiscord: false, guildId });
  },
  onDeliveryStart: async (guildId) => startDelivery(guildId),
  onDeliveryStop: async (guildId) => stopDelivery(guildId),
  getRuntimeInfo: async (guildId) => {
    const settings = await getSettings(guildId || 'GLOBAL');
    return {
      startedAt: state.startedAt,
      lastFetchAt: state.lastRunAt[guildId || 'GLOBAL'] || 0,
      settings
    };
  }
}).catch((error) => {
  logger.error('Bot startup failed', { error: error.message });
});
