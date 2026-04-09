function normalize(text) {
  return String(text || '').toLowerCase();
}

function parseKeywords(raw) {
  if (Array.isArray(raw)) {
    return raw.map((k) => normalize(k).trim()).filter(Boolean);
  }

  return String(raw || '')
    .split(',')
    .map((k) => normalize(k).trim())
    .filter(Boolean);
}

function isAllowed(item, settings) {
  const include = parseKeywords(settings.includeKeywords);
  const exclude = parseKeywords(settings.excludeKeywords);

  const hay = normalize(`${item.title || ''} ${item.summary || ''}`);

  if (exclude.some((word) => hay.includes(word))) {
    return false;
  }

  if (include.length === 0) {
    return true;
  }

  return include.some((word) => hay.includes(word));
}

module.exports = {
  parseKeywords,
  isAllowed
};
