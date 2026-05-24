const supabase = require('./supabaseClient');
const { defaults } = require('../config');
const logger = require('../utils/logger');

async function getFeeds(guildId = 'GLOBAL') {
  const { data, error } = await supabase
    .from('feeds')
    .select('*')
    .eq('guild_id', guildId);

  if (error) {
    logger.error('Error fetching feeds from Supabase', { error: error.message, guildId });
  }

  // If the specific guild has no feeds, fallback to the GLOBAL configuration
  if (!data || data.length === 0) {
    if (guildId !== 'GLOBAL') {
      const { data: globalData, error: globalError } = await supabase
        .from('feeds')
        .select('*')
        .eq('guild_id', 'GLOBAL');
        
      if (!globalError && globalData && globalData.length > 0) {
        return globalData;
      }
    }
    return defaults.feeds;
  }

  return data;
}

async function setFeeds(feeds, guildId = 'GLOBAL') {
  // First, delete existing feeds for this guild
  const { error: deleteError } = await supabase
    .from('feeds')
    .delete()
    .eq('guild_id', guildId);

  if (deleteError) {
    logger.error('Error deleting old feeds in Supabase', { error: deleteError.message, guildId });
    throw deleteError;
  }

  if (!feeds || feeds.length === 0) return;

  const payload = feeds.map((f) => ({
    id: f.id,
    guild_id: guildId,
    name: f.name,
    url: f.url,
    category: f.category || 'General',
    enabled: f.enabled !== false
  }));

  const { error: insertError } = await supabase
    .from('feeds')
    .insert(payload);

  if (insertError) {
    logger.error('Error inserting feeds to Supabase', { error: insertError.message, guildId });
    throw insertError;
  }
}

async function getSettings(guildId = 'GLOBAL') {
  const { data, error } = await supabase
    .from('guild_settings')
    .select('*')
    .eq('guild_id', guildId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is 'No rows found'
    logger.error('Error fetching settings from Supabase', { error: error.message, guildId });
  }

  // Convert DB snake_case to camelCase
  const settings = data ? {
    postMode: data.post_mode,
    fetchIntervalSeconds: data.fetch_interval_seconds,
    maxNewsPerCycle: data.max_news_per_cycle,
    maxArticlesPerFeed: data.max_articles_per_feed,
    feedFetchDelayMs: data.feed_fetch_delay_ms,
    deliveryEnabled: data.delivery_enabled,
    discordChannelId: data.channel_id,
    webhookUrl: data.webhook_url,
    includeKeywords: data.include_keywords ? data.include_keywords.split(',') : [],
    excludeKeywords: data.exclude_keywords ? data.exclude_keywords.split(',') : [],
    botEnabled: data.bot_enabled,
    rateLimitMs: data.rate_limit_ms,
    embedStyle: data.embed_style,
    accentColor: data.accent_color,
    enableImages: data.enable_images,
    descriptionLength: data.description_length,
    enableCategoryTags: data.enable_category_tags,
    enableButtons: data.enable_buttons,
    footerBrandingText: data.footer_branding_text,
    fallbackImageUrl: data.fallback_image_url,
    retryBotAfterFallback: data.retry_bot_after_fallback,
    retryBotDelayMs: data.retry_bot_delay_ms
  } : {};

  // Fetch guild name from guilds table
  if (data) {
    const { data: guildData } = await supabase
      .from('guilds')
      .select('guild_name')
      .eq('guild_id', guildId)
      .single();
    if (guildData) {
      settings.guildName = guildData.guild_name;
    }
  }

  return {
    ...defaults.settings,
    ...settings
  };
}

async function setSettings(settings, guildId = 'GLOBAL') {
  const payload = {
    guild_id: guildId,
    channel_id: settings.discordChannelId,
    post_mode: settings.postMode,
    fetch_interval_seconds: settings.fetchIntervalSeconds,
    max_news_per_cycle: settings.maxNewsPerCycle,
    max_articles_per_feed: settings.maxArticlesPerFeed,
    feed_fetch_delay_ms: settings.feedFetchDelayMs,
    delivery_enabled: settings.deliveryEnabled,
    webhook_url: settings.webhookUrl,
    include_keywords: Array.isArray(settings.includeKeywords) ? settings.includeKeywords.join(',') : settings.includeKeywords,
    exclude_keywords: Array.isArray(settings.excludeKeywords) ? settings.excludeKeywords.join(',') : settings.excludeKeywords,
    bot_enabled: settings.botEnabled,
    rate_limit_ms: settings.rateLimitMs,
    embed_style: settings.embedStyle,
    accent_color: settings.accentColor,
    enable_images: settings.enableImages,
    description_length: settings.descriptionLength,
    enable_category_tags: settings.enableCategoryTags,
    enable_buttons: settings.enableButtons,
    footer_branding_text: settings.footerBrandingText,
    fallback_image_url: settings.fallbackImageUrl,
    retry_bot_after_fallback: settings.retryBotAfterFallback,
    retry_bot_delay_ms: settings.retryBotDelayMs
  };

  const { error } = await supabase
    .from('guild_settings')
    .upsert(payload, { onConflict: 'guild_id' });

  if (error) {
    logger.error('Error upserting settings to Supabase', { error: error.message, guildId });
    throw error;
  }
}

async function getAllGuildIds() {
  const { data, error } = await supabase
    .from('guilds')
    .select('guild_id')
    .eq('active', true);

  if (error) {
    logger.error('Error fetching guild IDs from Supabase', { error: error.message });
    return [];
  }

  return (data || []).map((g) => g.guild_id).filter((id) => id !== 'GLOBAL');
}

async function syncGuildData(guild) {
  if (!guild || !guild.id) return;
  const payload = {
    guild_id: guild.id,
    guild_name: guild.name,
    icon: guild.icon,
    active: true
  };
  const { error } = await supabase
    .from('guilds')
    .upsert(payload, { onConflict: 'guild_id' });
  
  if (error) {
    logger.error('Error syncing guild data to Supabase', { 
      error: error.message, 
      code: error.code,
      details: error.details,
      guildId: guild.id 
    });
  }
}

module.exports = {
  getFeeds,
  setFeeds,
  getSettings,
  setSettings,
  getAllGuildIds,
  syncGuildData
};
