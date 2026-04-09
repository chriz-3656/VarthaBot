const express = require('express');
const { getNewsCache } = require('../services/rssService');
const { getFeeds, setFeeds, getSettings, setSettings } = require('../services/runtimeService');
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

  router.get('/news', (_req, res) => {
    res.json({ items: getNewsCache().slice(0, 50) });
  });

  router.post('/fetch', async (_req, res) => {
    try {
      const result = await context.manualFetch('dashboard');
      res.json({ ok: true, result });
    } catch (error) {
      logger.error('Manual fetch failed', { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.post('/send-latest', async (req, res) => {
    try {
      const count = Number(req.body?.count || 1);
      const result = await context.sendLatest(Math.min(Math.max(count, 1), 5));
      res.json({ ok: true, result });
    } catch (error) {
      logger.error('Send latest failed', { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.post('/delivery/start', async (_req, res) => {
    try {
      const result = await context.startDelivery();
      res.json({ ok: true, result });
    } catch (error) {
      logger.error('Failed to start delivery', { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.get('/feeds', (_req, res) => {
    res.json({ items: getFeeds() });
  });

  router.post('/feeds', (req, res) => {
    const body = req.body || {};
    if (!body.name || !body.url) {
      return res.status(400).json({ ok: false, error: 'name and url are required' });
    }

    const feeds = getFeeds();
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
    setFeeds(feeds);
    return res.status(201).json({ ok: true, item: entry });
  });

  router.patch('/feeds/:id', (req, res) => {
    const feeds = getFeeds();
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
    setFeeds(feeds);
    return res.json({ ok: true, item: merged });
  });

  router.delete('/feeds/:id', (req, res) => {
    const feeds = getFeeds();
    const filtered = feeds.filter((f) => f.id !== req.params.id);
    if (filtered.length === feeds.length) {
      return res.status(404).json({ ok: false, error: 'feed not found' });
    }

    setFeeds(filtered);
    return res.json({ ok: true });
  });

  router.get('/settings', (_req, res) => {
    res.json({ item: getSettings() });
  });

  router.post('/settings', (req, res) => {
    const current = getSettings();
    const incoming = sanitizeSettingsInput(req.body || {});
    const next = {
      ...current,
      ...incoming
    };

    setSettings(next);
    return res.json({ ok: true, item: next });
  });

  router.get('/logs', (req, res) => {
    const limit = Number(req.query.limit || 100);
    res.json({ items: logger.getRecent(Math.min(Math.max(limit, 1), 300)) });
  });

  router.get('/status', (_req, res) => {
    const botClient = context.getClient();
    const settings = getSettings();
    res.json({
      botOnline: Boolean(botClient?.isReady?.()),
      startedAt: context.startedAt,
      lastFetchAt: context.getLastRunAt ? context.getLastRunAt() : 0,
      deliveryEnabled: settings.deliveryEnabled !== false
    });
  });

  return router;
}

module.exports = {
  createApiRouter
};
