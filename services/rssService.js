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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeSummary(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
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
    title: normalizeText(item.title || 'Untitled News'),
    link: String(item.link || '').trim(),
    summary: sanitizeSummary(item.contentSnippet || item.summary || item.content || ''),
    image: extractImageUrl(item),
    pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
    source: sourceName
  };
}

async function fetchFeedContentValidated(feedUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(feedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      },
      signal: controller.signal
    });

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    const body = text.toLowerCase();

    const hasXmlContentType = contentType.includes('xml');
    const hasFeedMarkers = body.includes('<rss') || body.includes('<feed');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!hasXmlContentType || !hasFeedMarkers) {
      throw new Error(`Invalid feed response (content-type: ${contentType || 'unknown'})`);
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseFeedWithRetry(feed, options = {}) {
  const attempts = Number(options.attempts || 2);
  const maxArticlesPerFeed = Number(options.maxArticlesPerFeed || 15);
  let lastError;

  for (let i = 1; i <= attempts; i += 1) {
    logger.debug(`Fetching feed: ${feed.url}`, { feed: feed.name, attempt: i, attempts });

    try {
      const xml = await fetchFeedContentValidated(feed.url);
      const parsed = await parser.parseString(xml);
      const items = (parsed.items || [])
        .slice(0, maxArticlesPerFeed)
        .map((item) => normalizeItem(item, feed.name))
        .filter((item) => item.title && item.link);

      if (items.length === 0) {
        logger.debug('Feed parsed but no usable items', {
          feed: feed.name,
          url: feed.url,
          reason: 'empty_items'
        });
      } else {
        logger.debug('Feed parsed successfully', { feed: feed.name, url: feed.url, count: items.length });
      }

      return items;
    } catch (error) {
      lastError = error;
      logger.debug('Feed attempt failed', {
        feed: feed.name,
        url: feed.url,
        attempt: i,
        attempts,
        error: error.message
      });
    }
  }

  throw lastError;
}

async function fetchFromEnabledFeeds(feeds, options = {}) {
  const enabled = feeds.filter((feed) => feed.enabled);
  const maxArticlesPerFeed = Number(options.maxArticlesPerFeed || 15);
  const feedFetchDelayMs = Number(options.feedFetchDelayMs || 500);

  const allItems = [];

  for (const feed of enabled) {
    try {
      const items = await parseFeedWithRetry(feed, {
        attempts: 2,
        maxArticlesPerFeed
      });
      allItems.push(...items);
    } catch (error) {
      logger.warn('Feed failed after retries', {
        feed: feed.name,
        url: feed.url,
        error: error?.message || String(error)
      });
    }

    if (feedFetchDelayMs > 0) {
      await delay(feedFetchDelayMs);
    }
  }

  logger.info(`Articles fetched: ${allItems.length}`);
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
