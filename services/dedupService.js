const { readJson, writeJson } = require('./storageService');
const crypto = require('crypto');

const FILE_NAME = 'seen.json';
const MAX_ITEMS = 200;

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

function getSeen(guildId = 'GLOBAL') {
  const data = readJson(FILE_NAME, {});
  if (Array.isArray(data.items)) {
    return guildId === 'GLOBAL' ? data.items : [];
  }
  const items = data[guildId]?.items || [];
  return items.filter((item) => /^[a-f0-9]{40}$/i.test(String(item)));
}

function has(item, guildId = 'GLOBAL') {
  const hash = createHashFromItem(item);
  if (!hash) {
    return false;
  }
  return getSeen(guildId).includes(hash);
}

function addMany(items, guildId = 'GLOBAL') {
  let allData = readJson(FILE_NAME, {});
  if (Array.isArray(allData.items)) {
    allData = { GLOBAL: allData };
  }

  const current = getSeen(guildId);
  const additions = items.map(createHashFromItem).filter(Boolean);

  const merged = [...additions, ...current];
  const deduped = [...new Set(merged)].slice(0, MAX_ITEMS);

  allData[guildId] = { items: deduped };
  writeJson(FILE_NAME, allData);
}

module.exports = {
  has,
  addMany,
  normalizeKey,
  createHashFromItem
};
