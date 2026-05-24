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

  function isUserAdminOfGuild(req, guildId) {
    if (guildId === 'GLOBAL') {
      return req.user?.id === context.env.OWNER_ID;
    }
    const userGuild = req.user?.guilds?.find((g) => g.id === guildId);
    if (!userGuild) return false;
    // Check for Administrator (0x8) or Manage Guild (0x20)
    return (userGuild.permissions & 0x8) === 0x8 || (userGuild.permissions & 0x20) === 0x20 || userGuild.owner;
  }

  router.get('/me', (req, res) => {
    const client = context.getClient();
    const botGuilds = client?.guilds?.cache;

    res.json({
      user: {
        id: req.user?.id,
        username: req.user?.username,
        avatar: req.user?.avatar
      },
      guilds: req.user?.guilds?.filter(g => {
        const isAdmin = (g.permissions & 0x8) === 0x8 || (g.permissions & 0x20) === 0x20 || g.owner;
        const botInGuild = botGuilds?.has(g.id);
        return isAdmin && botInGuild;
      }) || []
    });
  });

  router.get('/guilds', async (req, res) => {
    try {
      const client = context.getClient();
      const userGuilds = req.user?.guilds || [];
      const botGuilds = client?.guilds?.cache;

      // Filter user guilds to those where they are admin
      const adminGuildIds = userGuilds
        .filter((g) => (g.permissions & 0x8) === 0x8 || (g.permissions & 0x20) === 0x20 || g.owner)
        .map((g) => g.id);

      // Only show guilds where user is admin AND bot is present
      const authorizedIds = adminGuildIds.filter((id) => botGuilds?.has(id));

      // Include GLOBAL only if user is the bot owner
      const allIds = req.user?.id === context.env.OWNER_ID ? ['GLOBAL', ...authorizedIds] : authorizedIds;

      const guilds = await Promise.all(
        allIds.map(async (id) => {
          const settings = await getSettings(id);
          let name = id === 'GLOBAL' ? 'System Defaults' : (settings.guildName || `Server ${id}`);

          if (id !== 'GLOBAL' && botGuilds?.has(id)) {
            name = botGuilds.get(id).name;
          }

          return {
            id,
            name,
            deliveryEnabled: settings.deliveryEnabled !== false,
            channelId: settings.discordChannelId || ''
          };
        })
      );
      res.json({ guilds });
    } catch (error) {
      logger.error('Failed to get guilds', { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Authorization Middleware for guild-specific requests
  router.use((req, res, next) => {
    const guildId = req.query.guildId || 'GLOBAL';
    const isPublicPath = req.path === '/status' || req.path === '/news';
    
    // Allow public access to GLOBAL status/news for landing page pulse
    if (isPublicPath && guildId === 'GLOBAL') {
      return next();
    }

    if (!isUserAdminOfGuild(req, guildId)) {
      return res.status(403).json({ ok: false, error: 'Unauthorized: You do not have permission to manage this server.' });
    }
    next();
  });

  router.get('/news', (req, res) => {
    const guildId = req.query.guildId || 'GLOBAL';
    res.json({ items: getNewsCache(guildId).slice(0, 50) });
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

  router.get('/feeds', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const feeds = await getFeeds(guildId);
      res.json({ items: feeds });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.post('/feeds', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const body = req.body || {};
      if (!body.name || !body.url) {
        return res.status(400).json({ ok: false, error: 'name and url are required' });
      }

      const feeds = await getFeeds(guildId);
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
      await setFeeds(feeds, guildId);
      return res.status(201).json({ ok: true, item: entry });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.patch('/feeds/:id', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const feeds = await getFeeds(guildId);
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
      await setFeeds(feeds, guildId);
      return res.json({ ok: true, item: merged });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.delete('/feeds/:id', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const feeds = await getFeeds(guildId);
      const filtered = feeds.filter((f) => f.id !== req.params.id);
      if (filtered.length === feeds.length) {
        return res.status(404).json({ ok: false, error: 'feed not found' });
      }

      await setFeeds(filtered, guildId);
      return res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.get('/settings', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const settings = await getSettings(guildId);
      res.json({ item: settings });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.post('/settings', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const current = await getSettings(guildId);
      const incoming = sanitizeSettingsInput(req.body || {});
      const next = {
        ...current,
        ...incoming
      };

      await setSettings(next, guildId);
      return res.json({ ok: true, item: next });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.get('/logs', async (req, res) => {
    try {
      const limit = Number(req.query.limit || 100);
      const guildId = req.query.guildId || 'GLOBAL';
      // In a real scenario, we might want to query Supabase directly for logs
      // For now, we'll keep the memory logs or implement a fetch from DB
      const logs = await logger.getRecentAsync ? await logger.getRecentAsync(guildId, limit) : logger.getRecent(Math.min(Math.max(limit, 1), 300));
      res.json({ items: logs });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.get('/status', async (req, res) => {
    try {
      const guildId = req.query.guildId || 'GLOBAL';
      const botClient = context.getClient();
      const settings = await getSettings(guildId);
      const allGuilds = await getAllGuildIds();

      res.json({
        botOnline: Boolean(botClient?.isReady?.()),
        startedAt: context.startedAt,
        lastFetchAt: context.getLastRunAt ? context.getLastRunAt(guildId) : 0,
        deliveryEnabled: settings.deliveryEnabled !== false,
        guildCount: allGuilds.length,
        activeGuildId: guildId
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  return router;
}

module.exports = {
  createApiRouter
};
