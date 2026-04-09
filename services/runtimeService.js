const { readJson, writeJson } = require('./storageService');
const { defaults } = require('../config');

function getFeeds() {
  const feeds = readJson('feeds.json', []);
  return Array.isArray(feeds) ? feeds : [];
}

function setFeeds(feeds) {
  writeJson('feeds.json', feeds);
}

function getSettings() {
  const stored = readJson('settings.json', {});
  const settings = stored && typeof stored === 'object' ? stored : {};
  return {
    ...defaults.settings,
    ...settings
  };
}

function setSettings(settings) {
  writeJson('settings.json', settings);
}

module.exports = {
  getFeeds,
  setFeeds,
  getSettings,
  setSettings
};
