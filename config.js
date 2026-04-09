const path = require('path');
const fs = require('fs');
require('dotenv').config();

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');

const defaults = {
  settings: {
    postMode: 'hybrid',
    fetchIntervalSeconds: 1800,
    maxNewsPerCycle: 5,
    maxArticlesPerFeed: 15,
    feedFetchDelayMs: 500,
    deliveryEnabled: false,
    discordChannelId: '',
    includeKeywords: [],
    excludeKeywords: [],
    botEnabled: true,
    rateLimitMs: 1200,
    embedStyle: 'card',
    accentColor: '#7C3AED',
    enableImages: true,
    descriptionLength: 200,
    enableCategoryTags: true,
    enableButtons: true,
    footerBrandingText: 'Powered by വാർത്ത ബോട്ട്',
    fallbackImageUrl: 'https://images.news18.com/dlxczavtqcctuei/news18/static/images/news18malayalam-logo-1200x675.png?im=FitAndFill,width=1200,height=675',
    sourcePriority: {
      onmanorama: 1,
      mathrubhumi: 2,
      news18: 3,
      asianet: 4
    },
    retryBotAfterFallback: false,
    retryBotDelayMs: 3000
  },
  feeds: [
    {
      id: 'news18-malayalam',
      name: 'News18 Malayalam',
      url: 'https://malayalam.news18.com/commonfeeds/v1/mal/rss/latest.xml',
      enabled: true
    },
    {
      id: 'onmanorama',
      name: 'Onmanorama',
      url: 'https://www.onmanorama.com/kerala.feeds.onmrss.xml',
      enabled: true
    },
    {
      id: 'mathrubhumi-news',
      name: 'Mathrubhumi',
      url: 'https://www.mathrubhumi.com/rss/news',
      enabled: true
    },
    {
      id: 'asianetnews',
      name: 'Asianet News',
      url: 'https://www.asianetnews.com/rss',
      enabled: true
    },
    {
      id: 'oneindia-malayalam',
      name: 'OneIndia Malayalam',
      url: 'https://malayalam.oneindia.com/rss/malayalam-news-fb.xml',
      enabled: true
    },
    {
      id: 'filmibeat-malayalam',
      name: 'Filmibeat Malayalam',
      url: 'https://malayalam.filmibeat.com/rss/feeds/malayalam-filmibeat-latest-news-fb.xml',
      enabled: true
    },
    {
      id: 'mykhel-malayalam',
      name: 'MyKhel Malayalam',
      url: 'https://malayalam.mykhel.com/rss/feeds/malayalam-sports-fb.xml',
      enabled: true
    },
    {
      id: 'ndtv-top-stories',
      name: 'NDTV Top Stories',
      url: 'https://feeds.feedburner.com/ndtvnews-top-stories',
      enabled: true
    },
    {
      id: 'the-hindu-national',
      name: 'The Hindu National',
      url: 'https://www.thehindu.com/news/national/feeder/default.rss',
      enabled: true
    },
    {
      id: 'bbc-world',
      name: 'BBC World',
      url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
      enabled: true
    }
  ],
  seen: {
    items: []
  },
  newsCache: {
    items: []
  }
};

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const files = [
    { name: 'settings.json', data: defaults.settings },
    { name: 'feeds.json', data: defaults.feeds },
    { name: 'seen.json', data: defaults.seen },
    { name: 'newsCache.json', data: defaults.newsCache }
  ];

  for (const file of files) {
    const fullPath = path.join(DATA_DIR, file.name);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, `${JSON.stringify(file.data, null, 2)}\n`, 'utf8');
    }
  }
}

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  defaults,
  ensureDataFiles,
  env: {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    CLIENT_ID: process.env.CLIENT_ID || '',
    GUILD_ID: process.env.GUILD_ID || '',
    WEBHOOK_URL: process.env.WEBHOOK_URL || '',
    PORT: Number(process.env.PORT || 3000)
  }
};
