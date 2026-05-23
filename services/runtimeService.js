const { readJson, writeJson } = require('./storageService');
const { defaults } = require('../config');

function getFeeds(guildId = 'GLOBAL') {
  const allFeeds = readJson('feeds.json', {});
  // Migration: if it's an array, it's the old format
  if (Array.isArray(allFeeds)) {
    return guildId === 'GLOBAL' ? allFeeds : [];
  }
  const feeds = allFeeds[guildId] || (guildId === 'GLOBAL' ? defaults.feeds : []);
  return Array.isArray(feeds) ? feeds : [];
}

function setFeeds(feeds, guildId = 'GLOBAL') {
  let allFeeds = readJson('feeds.json', {});
  if (Array.isArray(allFeeds)) {
    allFeeds = { GLOBAL: allFeeds };
  }
  allFeeds[guildId] = feeds;
  writeJson('feeds.json', allFeeds);
}

function getSettings(guildId = 'GLOBAL') {
  const allSettings = readJson('settings.json', {});
  // Migration: if it has postMode, it's the old format
  if (allSettings && !allSettings.GLOBAL && allSettings.postMode) {
    const merged = { ...defaults.settings, ...allSettings };
    return guildId === 'GLOBAL' ? merged : { ...defaults.settings };
  }

  const settings = allSettings[guildId] || (guildId === 'GLOBAL' ? defaults.settings : {});
  return {
    ...defaults.settings,
    ...settings
  };
}

function setSettings(settings, guildId = 'GLOBAL') {
  let allSettings = readJson('settings.json', {});
  if (allSettings && !allSettings.GLOBAL && allSettings.postMode) {
    allSettings = { GLOBAL: allSettings };
  }
  allSettings[guildId] = settings;
  writeJson('settings.json', allSettings);
}

function getAllGuildIds() {
  const allSettings = readJson('settings.json', {});
  if (allSettings && !allSettings.GLOBAL && allSettings.postMode) {
    return ['GLOBAL'];
  }
  return Object.keys(allSettings).filter((id) => id !== 'GLOBAL');
}

module.exports = {
  getFeeds,
  setFeeds,
  getSettings,
  setSettings,
  getAllGuildIds
};
