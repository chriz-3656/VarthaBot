const { fetchFromEnabledFeeds, saveNewsCache } = require('./rssService');
const { getFeeds, getSettings } = require('./runtimeService');
const { isAllowed } = require('./filterService');
const dedupService = require('./dedupService');
const discordService = require('./discordService');
const { sortByPriority } = require('./presentationService');
const logger = require('../utils/logger');

async function runFetchCycle(context, opts = {}) {
  const settings = getSettings();
  const feeds = getFeeds();
  const reason = opts.reason || 'scheduled';

  if (!settings.botEnabled && !opts.force) {
    logger.info('Fetch skipped: bot is disabled', { reason });
    return {
      reason,
      fetched: 0,
      filtered: 0,
      newItems: 0,
      sent: 0,
      skipped: true
    };
  }

  const fetched = await fetchFromEnabledFeeds(feeds);
  const prioritized = sortByPriority(fetched);
  saveNewsCache(prioritized);

  const filtered = prioritized.filter((item) => isAllowed(item, settings));
  const fresh = filtered.filter((item) => !dedupService.has(item));

  const max = Number(settings.maxNewsPerCycle || 5);
  const batch = fresh.slice(0, Math.max(1, max));
  const shouldDispatch = opts.dispatchToDiscord !== false;
  let sentCount = 0;

  if (batch.length > 0 && shouldDispatch) {
    dedupService.addMany(batch);
    discordService.enqueueNews(batch, {
      settings,
      client: context.getClient()
    });
    sentCount = batch.length;
  }

  logger.info('Fetch cycle completed', {
    reason,
    fetched: fetched.length,
    filtered: filtered.length,
    fresh: fresh.length,
    sent: sentCount
  });

  return {
    reason,
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
