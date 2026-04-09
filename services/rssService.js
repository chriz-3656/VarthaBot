const Parser = require('rss-parser');
const { readJson, writeJson } = require('./storageService');
const logger = require('../utils/logger');

const parser = new Parser({
  timeout: 12000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
  },
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['content:encoded', 'content:encoded']
    ]
  }
});

function sanitizeSummary(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFirstValidUrl(candidates) {
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (/^https?:\/\//i.test(value)) {
      try {
        return encodeURI(value);
      } catch (_error) {
        return value.replace(/\s/g, '%20');
      }
    }
  }
  return '';
}

function extractImageFromHtml(html) {
  const text = String(html || '');
  const match = text.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? String(match[1] || '').trim() : '';
}

function extractImageUrl(item) {
  const mediaContent = item['media:content'];
  const mediaThumbnail = item['media:thumbnail'];

  const mediaContentUrl = Array.isArray(mediaContent)
    ? mediaContent[0]?.$.url || mediaContent[0]?.url
    : mediaContent?.$.url || mediaContent?.url;

  const mediaThumbnailUrl = Array.isArray(mediaThumbnail)
    ? mediaThumbnail[0]?.$.url || mediaThumbnail[0]?.url
    : mediaThumbnail?.$.url || mediaThumbnail?.url;

  return getFirstValidUrl([
    item.enclosure?.url,
    mediaContentUrl,
    mediaThumbnailUrl,
    item.thumbnail,
    item.image?.url,
    extractImageFromHtml(item['content:encoded']),
    extractImageFromHtml(item.content),
    extractImageFromHtml(item.summary)
  ]);
}

function normalizeItem(item, sourceName) {
  return {
    id: String(item.id || item.guid || item.link || item.title || `${sourceName}-${Date.now()}`),
    title: String(item.title || 'Untitled News').trim(),
    link: String(item.link || '').trim(),
    summary: sanitizeSummary(item.contentSnippet || item.summary || item.content || ''),
    image: extractImageUrl(item),
    pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
    source: sourceName
  };
}

async function parseFeedWithRetry(feed, attempts = 2) {
  let lastError;

  for (let i = 1; i <= attempts; i += 1) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || [])
        .slice(0, 15)
        .map((item) => normalizeItem(item, feed.name))
        .filter((item) => item.title && item.link);

      return items;
    } catch (error) {
      lastError = error;
      logger.warn(`Feed fetch failed (attempt ${i}/${attempts})`, {
        feed: feed.name,
        url: feed.url,
        error: error.message
      });
    }
  }

  throw lastError;
}

async function fetchFromEnabledFeeds(feeds) {
  const enabled = feeds.filter((feed) => feed.enabled);

  const results = await Promise.all(
    enabled.map(async (feed) => {
      try {
        const items = await parseFeedWithRetry(feed);
        return { feed, items };
      } catch (error) {
        logger.error('Feed failed after retries', {
          feed: feed.name,
          url: feed.url,
          error: error?.message || String(error)
        });
        return { feed, items: [] };
      }
    })
  );

  const allItems = [];

  for (const result of results) {
    allItems.push(...result.items);
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return allItems;
}

function saveNewsCache(items) {
  writeJson('newsCache.json', {
    items: items.slice(0, 100)
  });
}

function getNewsCache() {
  const data = readJson('newsCache.json', { items: [] });
  return Array.isArray(data.items) ? data.items : [];
}

module.exports = {
  fetchFromEnabledFeeds,
  saveNewsCache,
  getNewsCache
};
