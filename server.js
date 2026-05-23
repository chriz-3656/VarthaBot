const path = require('path');
const express = require('express');
const cron = require('node-cron');
const { ensureDataFiles, env } = require('./config');
const logger = require('./utils/logger');
const { initBot, getClient } = require('./bot');
const { createApiRouter } = require('./routes/api');
const { runFetchCycle } = require('./services/newsPipeline');
const { getNewsCache } = require('./services/rssService');
const { getSettings, setSettings, getAllGuildIds } = require('./services/runtimeService');
const { enqueueNews } = require('./services/discordService');

ensureDataFiles();

const app = express();
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
  const settings = getSettings(guildId);
  if (settings.deliveryEnabled === false) {
    return { sent: 0, reason: 'delivery_disabled', guildId };
  }

  const latest = getNewsCache().slice(0, Math.max(1, count));

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
  const current = getSettings(guildId);
  if (current.deliveryEnabled !== true) {
    setSettings(
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
  const current = getSettings(guildId);
  if (current.deliveryEnabled !== false) {
    setSettings(
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

app.use(
  '/api',
  createApiRouter({
    manualFetch: (reason) => guardedFetch(reason || 'manual', { force: true, dispatchToDiscord: true }),
    sendLatest: (count) => sendLatestNews(count),
    startDelivery: () => startDelivery(),
    stopDelivery: () => stopDelivery(),
    getClient,
    startedAt: state.startedAt,
    getLastRunAt: () => state.lastRunAt['GLOBAL'] || 0
  })
);

app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));
app.get('/', (_req, res) => {
  res.redirect('/dashboard');
});

app.listen(env.PORT, () => {
  logger.info(`Dashboard/API server running on http://localhost:${env.PORT}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason: reason?.message || reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error: error.message, stack: error.stack });
  // In production, you might want to exit and let a process manager (like pm2) restart the app
  // process.exit(1);
});

cron.schedule('* * * * *', async () => {
  const guildIds = ['GLOBAL', ...getAllGuildIds()];
  const now = Date.now();

  for (const guildId of guildIds) {
    const settings = getSettings(guildId);
    if (settings.deliveryEnabled === false) {
      continue;
    }

    const intervalMs = Math.max(60, Number(settings.fetchIntervalSeconds || 1800)) * 1000;
    const lastRun = state.lastRunAt[guildId] || 0;

    if (lastRun > 0 && now - lastRun < intervalMs) {
      continue;
    }

    await guardedFetch('cron', { guildId });
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
  getRuntimeInfo: (guildId) => ({
    startedAt: state.startedAt,
    lastFetchAt: state.lastRunAt[guildId || 'GLOBAL'] || 0,
    settings: getSettings(guildId || 'GLOBAL')
  })
}).catch((error) => {
  logger.error('Bot startup failed', { error: error.message });
});

setTimeout(() => {
  logger.info('Startup complete. Waiting for dashboard confirmation to enable delivery.');
}, 4000);
