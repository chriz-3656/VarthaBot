const express = require('express');
const { getNewsCache } = require('../services/rssService');
const { getFeeds, setFeeds, getSettings, setSettings, getAllGuildIds } = require('../services/runtimeService');
const logger = require('../utils/logger');

function createApiRouter(context) {
  const router = express.Router();

  function sanitizeSettingsInput(input) {
    const next = { ...input };
    if (Object.prototype.hasOwnProperty.call(next, 'maxNewsPerCycle')) {
      next.maxNewsPerCycle = Number(next.maxNewsPerCycle);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'rateLimitMs')) {
      next.rateLimitMs = Number(next.rateLimitMs);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'fetchIntervalSeconds')) {
      next.fetchIntervalSeconds = Number(next.fetchIntervalSeconds);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'maxArticlesPerFeed')) {
      next.maxArticlesPerFeed = Number(next.maxArticlesPerFeed);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'feedFetchDelayMs')) {
      next.feedFetchDelayMs = Number(next.feedFetchDelayMs);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'descriptionLength')) {
      next.descriptionLength = Number(next.descriptionLength);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'sourcePriority')) {
      if (!next.sourcePriority || typeof next.sourcePriority !== 'object') {
        delete next.sourcePriority;
      }
    }
    return next;
  }

  router.get('/guilds', (_req, res) => {
    const client = context.getClient();
    const storedIds = getAllGuildIds();
    const liveIds = client?.guilds?.cache?.map((g) => g.id) || [];

    // Unique combined list
    const allIds = [...new Set(['GLOBAL', ...storedIds, ...liveIds])];

    const guilds = allIds.map((id) => {
      const settings = getSettings(id);
      let name = id === 'GLOBAL' ? 'System Defaults' : (settings.guildName || `Server ${id}`);

      // Try to get fresh name from client if possible
      if (id !== 'GLOBAL' && client?.guilds?.cache?.has(id)) {
        name = client.guilds.cache.get(id).name;
      }

      return {
        id,
        name,
        deliveryEnabled: settings.deliveryEnabled !== false,
        channelId: settings.discordChannelId || ''
      };
    });
    res.json({ guilds });
  });

  router.get('/news', (_req, res) => {
    res.json({ items: getNewsCache().slice(0, 50) });
  });

  router.post('/fetch', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const result = await context.manualFetch('dashboard', { guildId });
      res.json({ ok: true, result });
    } catch (error) {
      logger.error('Manual fetch failed', { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.post('/send-latest', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const count = Number(req.body?.count || 1);
      const result = await context.sendLatest(Math.min(Math.max(count, 1), 5), guildId);
      res.json({ ok: true, result });
    } catch (error) {
      logger.error('Send latest failed', { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.post('/delivery/start', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const result = await context.startDelivery(guildId);
      res.json({ ok: true, result });
    } catch (error) {
      logger.error('Failed to start delivery', { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.post('/delivery/stop', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const result = await context.stopDelivery(guildId);
      res.json({ ok: true, result });
    } catch (error) {
      logger.error('Failed to stop delivery', { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.get('/feeds', (req, res) => {
    const guildId = req.query.guildId || 'GLOBAL';
    res.json({ items: getFeeds(guildId) });
  });

  router.post('/feeds', (req, res) => {
    const guildId = req.query.guildId || 'GLOBAL';
    const body = req.body || {};
    if (!body.name || !body.url) {
      return res.status(400).json({ ok: false, error: 'name and url are required' });
    }

    const feeds = getFeeds(guildId);
    const id = String(body.id || body.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (feeds.find((f) => f.id === id)) {
      return res.status(409).json({ ok: false, error: 'feed id already exists' });
    }

    const entry = {
      id,
      name: String(body.name).trim(),
      url: String(body.url).trim(),
      enabled: body.enabled !== false
    };

    feeds.push(entry);
    setFeeds(feeds, guildId);
    return res.status(201).json({ ok: true, item: entry });
  });

  router.patch('/feeds/:id', (req, res) => {
    const guildId = req.query.guildId || 'GLOBAL';
    const feeds = getFeeds(guildId);
    const idx = feeds.findIndex((f) => f.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: 'feed not found' });
    }

    const merged = {
      ...feeds[idx],
      ...req.body,
      id: feeds[idx].id
    };

    feeds[idx] = merged;
    setFeeds(feeds, guildId);
    return res.json({ ok: true, item: merged });
  });

  router.delete('/feeds/:id', (req, res) => {
    const guildId = req.query.guildId || 'GLOBAL';
    const feeds = getFeeds(guildId);
    const filtered = feeds.filter((f) => f.id !== req.params.id);
    if (filtered.length === feeds.length) {
      return res.status(404).json({ ok: false, error: 'feed not found' });
    }

    setFeeds(filtered, guildId);
    return res.json({ ok: true });
  });

  router.get('/settings', (req, res) => {
    const guildId = req.query.guildId || 'GLOBAL';
    res.json({ item: getSettings(guildId) });
  });

  router.post('/settings', (req, res) => {
    const guildId = req.query.guildId || 'GLOBAL';
    const current = getSettings(guildId);
    const incoming = sanitizeSettingsInput(req.body || {});
    const next = {
      ...current,
      ...incoming
    };

    setSettings(next, guildId);
    return res.json({ ok: true, item: next });
  });

  router.get('/logs', (req, res) => {
    const limit = Number(req.query.limit || 100);
    res.json({ items: logger.getRecent(Math.min(Math.max(limit, 1), 300)) });
  });

  router.get('/status', (req, res) => {
    const guildId = req.query.guildId || 'GLOBAL';
    const botClient = context.getClient();
    const settings = getSettings(guildId);
    const allGuilds = getAllGuildIds();

    res.json({
      botOnline: Boolean(botClient?.isReady?.()),
      startedAt: context.startedAt,
      lastFetchAt: context.getLastRunAt ? context.getLastRunAt(guildId) : 0,
      deliveryEnabled: settings.deliveryEnabled !== false,
      guildCount: allGuilds.length,
      activeGuildId: guildId
    });
  });

  return router;
}

module.exports = {
  createApiRouter
};
