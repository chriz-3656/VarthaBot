const path = require('path');
const express = require('express');
const cron = require('node-cron');
const { ensureDataFiles, env } = require('./config');
const logger = require('./utils/logger');
const { initBot, getClient } = require('./bot');
const { createApiRouter } = require('./routes/api');
const { runFetchCycle } = require('./services/newsPipeline');
const { getNewsCache } = require('./services/rssService');
const { getSettings } = require('./services/runtimeService');
const { enqueueNews } = require('./services/discordService');

ensureDataFiles();

const app = express();
app.use(express.json());

const state = {
  startedAt: new Date().toISOString(),
  lock: false,
  lastRunAt: 0
};

async function guardedFetch(reason, force = false, dispatchToDiscord = true) {
  if (state.lock) {
    logger.warn('Fetch skipped: previous cycle still running', { reason });
    return { skipped: true, reason: 'busy' };
  }

  state.lock = true;
  try {
    const result = await runFetchCycle(
      {
        getClient
      },
      {
        reason,
        force,
        dispatchToDiscord
      }
    );

    state.lastRunAt = Date.now();
    return result;
  } finally {
    state.lock = false;
  }
}

async function sendLatestNews(count = 1) {
  const settings = getSettings();
  const latest = getNewsCache().slice(0, Math.max(1, count));

  if (latest.length === 0) {
    return { sent: 0, reason: 'no_cached_news' };
  }

  enqueueNews(latest, {
    settings,
    client: getClient()
  });

  return {
    sent: latest.length,
    titles: latest.map((item) => item.title)
  };
}

app.use(
  '/api',
  createApiRouter({
    manualFetch: (reason) => guardedFetch(reason || 'manual', true, true),
    sendLatest: (count) => sendLatestNews(count),
    getClient,
    startedAt: state.startedAt,
    getLastRunAt: () => state.lastRunAt
  })
);

app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));
app.get('/', (_req, res) => {
  res.redirect('/dashboard');
});

app.listen(env.PORT, () => {
  logger.info(`Dashboard/API server running on http://localhost:${env.PORT}`);
});

cron.schedule('* * * * *', async () => {
  const settings = getSettings();
  const intervalMs = Math.max(60, Number(settings.fetchIntervalSeconds || 1800)) * 1000;
  const now = Date.now();

  if (state.lastRunAt > 0 && now - state.lastRunAt < intervalMs) {
    return;
  }

  await guardedFetch('cron');
});

initBot({
  onReload: async () => {
    logger.info('Reload requested from slash command');
  },
  onNewsRequest: async () => {
    return guardedFetch('slash-news', true, false);
  },
  getRuntimeInfo: () => ({
    startedAt: state.startedAt,
    lastFetchAt: state.lastRunAt,
    settings: getSettings()
  })
}).catch((error) => {
  logger.error('Bot startup failed', { error: error.message });
});

setTimeout(() => {
  guardedFetch('startup').catch((error) => {
    logger.error('Startup fetch failed', { error: error.message });
  });
}, 4000);
