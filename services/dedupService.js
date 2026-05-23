const crypto = require('crypto');
const supabase = require('./supabaseClient');
const logger = require('../utils/logger');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(item) {
  const title = normalizeText(item.title || '');
  const link = normalizeText(item.link || item.guid || '');
  if (!title && !link) {
    return '';
  }
  return `${title}|${link}`;
}

function createHashFromItem(item) {
  const key = normalizeKey(item);
  if (!key) {
    return '';
  }
  return crypto.createHash('sha1').update(key).digest('hex');
}

async function getSeen(guildId = 'GLOBAL') {
  const { data, error } = await supabase
    .from('seen_articles')
    .select('article_hash')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    logger.error('Error fetching seen articles from Supabase', { error: error.message, guildId });
    return [];
  }

  return (data || []).map((row) => row.article_hash);
}

async function addMany(items, guildId = 'GLOBAL') {
  if (!items || items.length === 0) return;

  const payloads = items.map((item) => {
    const hash = createHashFromItem(item);
    if (!hash) return null;
    return {
      guild_id: guildId,
      article_hash: hash,
      article_url: item.link || item.guid || ''
    };
  }).filter(Boolean);

  if (payloads.length === 0) return;

  const { error } = await supabase
    .from('seen_articles')
    .upsert(payloads, { onConflict: 'guild_id,article_hash', ignoreDuplicates: true });

  if (error) {
    logger.error('Error inserting seen articles to Supabase', { error: error.message, guildId });
    throw error;
  }
}

module.exports = {
  getSeen,
  addMany,
  normalizeKey,
  createHashFromItem
};
