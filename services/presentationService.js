const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const CATEGORY_RULES = [
  { name: 'Breaking', words: ['breaking', 'ബ്രേക്കിംഗ്', 'urgent', 'latest'] },
  { name: 'Politics', words: ['election', 'poll', 'assembly', 'politics', 'മന്ത്രി', 'തിരഞ്ഞെടുപ്പ്', 'സർക്കാർ'] },
  { name: 'Kerala', words: ['kerala', 'kochi', 'thrissur', 'തിരുവനന്തപുരം', 'കേരളം', 'മലപ്പുറം'] },
  { name: 'Tech', words: ['ai', 'tech', 'technology', 'gadget', 'cyber', 'software'] }
];

const HIGHLIGHT_WORDS = ['breaking', 'exclusive', 'urgent', 'ബ്രേക്കിംഗ്'];

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSettings(settings = {}) {
  return {
    embedStyle: settings.embedStyle || 'card',
    accentColor: settings.accentColor || '#7C3AED',
    enableImages: settings.enableImages !== false,
    descriptionLength: Math.min(Math.max(toNumber(settings.descriptionLength, 200), 80), 600),
    enableCategoryTags: settings.enableCategoryTags !== false,
    enableButtons: settings.enableButtons !== false,
    footerBrandingText: settings.footerBrandingText || 'Powered by വാർത്ത ബോട്ട്',
    fallbackImageUrl: settings.fallbackImageUrl || '',
    sourceTitleSuffix: settings.sourceTitleSuffix || 'Kerala News',
    sourcePriority: settings.sourcePriority && typeof settings.sourcePriority === 'object'
      ? settings.sourcePriority
      : {}
  };
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(text, limit) {
  const clean = stripHtml(text);
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function highlightKeywords(text) {
  let output = text;
  for (const word of HIGHLIGHT_WORDS) {
    const regex = new RegExp(`(${word})`, 'gi');
    output = output.replace(regex, '**$1**');
  }
  return output;
}

function deriveCategory(item) {
  const hay = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((word) => hay.includes(word.toLowerCase()))) {
      return rule.name;
    }
  }
  return 'General';
}

function buildDescription(item, settings) {
  const trimmed = truncateText(item.summary || 'No summary available', settings.descriptionLength);
  const highlighted = highlightKeywords(trimmed);
  const unix = Math.floor(new Date(item.pubDate || Date.now()).getTime() / 1000);
  return `${highlighted}\n\n🕒 <t:${unix}:R>`;
}

function resolveImage(item, settings) {
  if (settings.enableImages === false) {
    return '';
  }

  if (item.image && /^https?:\/\//i.test(item.image)) {
    return item.image;
  }

  if (settings.fallbackImageUrl && /^https?:\/\//i.test(settings.fallbackImageUrl)) {
    return settings.fallbackImageUrl;
  }

  return '';
}

function buildEmbed(item, rawSettings = {}) {
  const settings = normalizeSettings(rawSettings);
  const category = deriveCategory(item);
  const sourceName = item.source || 'Unknown Source';

  const embed = new EmbedBuilder()
    .setColor(settings.accentColor)
    .setAuthor({ name: `📰 ${sourceName} — ${settings.sourceTitleSuffix}` })
    .setTitle(item.title || 'Untitled News')
    .setDescription(buildDescription(item, settings))
    .setFooter({ text: settings.footerBrandingText })
    .setTimestamp(new Date(item.pubDate || Date.now()));

  if (item.link) {
    embed.setURL(item.link);
  }

  if (settings.enableCategoryTags) {
    embed.addFields({ name: 'Category', value: category, inline: true });
  }

  const image = resolveImage(item, settings);
  if (image && settings.embedStyle !== 'compact') {
    embed.setImage(image);
  }

  return { embed, category };
}

function buildComponents(item, rawSettings = {}, options = {}) {
  const settings = normalizeSettings(rawSettings);
  if (!settings.enableButtons) {
    return [];
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('📖 Read Full News')
      .setStyle(ButtonStyle.Link)
      .setURL(item.link || 'https://discord.com')
  );

  if (options.enableInteractive !== false) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId('refresh_news'),
      new ButtonBuilder()
        .setLabel('🔗 Share')
        .setStyle(ButtonStyle.Link)
        .setURL(item.link || 'https://discord.com')
    );
  }

  return [row];
}

function buildDiscordMessage(item, settings, options = {}) {
  const { embed, category } = buildEmbed(item, settings);
  const components = buildComponents(item, settings, options);
  return {
    embeds: [embed],
    components,
    category
  };
}

function sortByPriority(items, rawSettings = {}) {
  const settings = normalizeSettings(rawSettings);
  const sourcePriority = settings.sourcePriority && typeof settings.sourcePriority === 'object'
    ? settings.sourcePriority
    : {};

  function sourceScore(item) {
    const source = String(item.source || '').toLowerCase();
    for (const [key, value] of Object.entries(sourcePriority)) {
      if (source.includes(String(key).toLowerCase())) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.max(0, 100 - numeric) : 0;
      }
    }
    return 0;
  }

  function score(item) {
    const category = deriveCategory(item);
    const title = String(item.title || '').toLowerCase();
    let s = 0;
    if (category === 'Breaking') {
      s += 1000;
    }
    if (title.includes('breaking') || title.includes('ബ്രേക്കിംഗ്')) {
      s += 500;
    }
    s += sourceScore(item);
    s += Math.floor(new Date(item.pubDate || Date.now()).getTime() / 1000);
    return s;
  }

  return [...items].sort((a, b) => score(b) - score(a));
}

module.exports = {
  normalizeSettings,
  deriveCategory,
  buildDiscordMessage,
  buildEmbed,
  sortByPriority
};
