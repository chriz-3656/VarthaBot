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
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Nuvola_apps_knews.svg/512px-Nuvola_apps_knews.svg.png',
    sourceFallbackImages: {
      news18: 'https://www.google.com/s2/favicons?domain=malayalam.news18.com&sz=256',
      onmanorama: 'https://www.google.com/s2/favicons?domain=onmanorama.com&sz=256',
      mathrubhumi: 'https://www.google.com/s2/favicons?domain=mathrubhumi.com&sz=256',
      asianet: 'https://www.google.com/s2/favicons?domain=asianetnews.com&sz=256',
      oneindia: 'https://www.google.com/s2/favicons?domain=oneindia.com&sz=256',
      filmibeat: 'https://www.google.com/s2/favicons?domain=filmibeat.com&sz=256',
      mykhel: 'https://www.google.com/s2/favicons?domain=mykhel.com&sz=256',
      ndtv: 'https://www.google.com/s2/favicons?domain=ndtv.com&sz=256',
      hindu: 'https://www.google.com/s2/favicons?domain=thehindu.com&sz=256',
      bbc: 'https://www.google.com/s2/favicons?domain=bbc.com&sz=256'
    },
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
