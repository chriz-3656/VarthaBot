const { fetchFromEnabledFeeds, saveNewsCache } = require('./rssService');
const { getFeeds, getSettings } = require('./runtimeService');
const { isAllowed } = require('./filterService');
const dedupService = require('./dedupService');
const discordService = require('./discordService');
const { sortByPriority } = require('./presentationService');
const logger = require('../utils/logger');

async function runFetchCycle(context, opts = {}) {
  const guildId = opts.guildId || 'GLOBAL';
  const settings = await getSettings(guildId);
  const feeds = await getFeeds(guildId);
  const reason = opts.reason || 'scheduled';

  if (!settings.botEnabled && !opts.force) {
    logger.info('Fetch skipped: bot is disabled', { reason, guildId });
    return {
      reason,
      guildId,
      fetched: 0,
      filtered: 0,
      newItems: 0,
      sent: 0,
      skipped: true
    };
  }

  const fetched = await fetchFromEnabledFeeds(feeds, {
    maxArticlesPerFeed: settings.maxArticlesPerFeed,
    feedFetchDelayMs: settings.feedFetchDelayMs
  });
  const prioritized = sortByPriority(fetched, settings);
  saveNewsCache(prioritized, guildId);

  const filtered = prioritized.filter((item) => isAllowed(item, settings));
  const seenHashes = await dedupService.getSeen(guildId);
  
  const fresh = filtered.filter((item) => {
    const hash = dedupService.createHashFromItem(item);
    const duplicate = seenHashes.includes(hash);
    if (duplicate) {
      logger.debug('Duplicate skipped', { title: item.title, source: item.source, guildId });
    }
    return !duplicate;
  });

  const max = Number(settings.maxNewsPerCycle || 5);
  const batch = fresh.slice(0, Math.max(1, max));
  const shouldDispatch = opts.dispatchToDiscord !== false && settings.deliveryEnabled !== false;
  let sentCount = 0;

  if (batch.length > 0 && shouldDispatch) {
    await dedupService.addMany(batch, guildId);
    discordService.enqueueNews(batch, {
      settings: { ...settings, guildId },
      client: context.getClient()
    });
    sentCount = batch.length;
  }

  if (batch.length > 0 && !shouldDispatch) {
    logger.info('Delivery disabled: fetched items are cached but not sent', {
      reason,
      guildId,
      batch: batch.length
    });
  }

  logger.info('Fetch cycle completed', {
    reason,
    guildId,
    fetched: fetched.length,
    filtered: filtered.length,
    duplicatesSkipped: filtered.length - fresh.length,
    fresh: fresh.length,
    sent: sentCount
  });

  return {
    reason,
    guildId,
    fetched: fetched.length,
    filtered: filtered.length,
    newItems: fresh.length,
    sent: sentCount,
    latest: prioritized.slice(0, 5)
  };
}

module.exports = {
  runFetchCycle
};
