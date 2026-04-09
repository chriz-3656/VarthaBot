const { readJson, writeJson } = require('./storageService');

const FILE_NAME = 'seen.json';
const MAX_ITEMS = 100;

function normalizeKey(item) {
  return String(item.link || item.guid || item.title || '')
    .trim()
    .toLowerCase();
}

function getSeen() {
  const data = readJson(FILE_NAME, { items: [] });
  if (!Array.isArray(data.items)) {
    return [];
  }
  return data.items;
}

function has(item) {
  const key = normalizeKey(item);
  if (!key) {
    return false;
  }
  return getSeen().includes(key);
}

function addMany(items) {
  const current = getSeen();
  const additions = items.map(normalizeKey).filter(Boolean);

  const merged = [...additions, ...current];
  const deduped = [...new Set(merged)].slice(0, MAX_ITEMS);

  writeJson(FILE_NAME, { items: deduped });
}

module.exports = {
  has,
  addMany,
  normalizeKey
};
