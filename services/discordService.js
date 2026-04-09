const {
  WebhookClient
} = require('discord.js');
const logger = require('../utils/logger');
const { env } = require('../config');
const { buildDiscordMessage } = require('./presentationService');

const queue = [];
let processing = false;

function buildMessage(item, settings, options = {}) {
  return buildDiscordMessage(item, settings, options);
}

async function sendViaWebhook(item, settings) {
  if (!env.WEBHOOK_URL) {
    throw new Error('WEBHOOK_URL not configured');
  }

  const webhook = new WebhookClient({ url: env.WEBHOOK_URL });
  await webhook.send(buildMessage(item, settings, { enableInteractive: false }));
  return 'webhook';
}

async function sendViaBot(item, client, channelId, settings) {
  if (!client || !channelId) {
    throw new Error('Bot client or channelId missing');
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Invalid or inaccessible channel: ${channelId}`);
  }

  await channel.send(buildMessage(item, settings, { enableInteractive: true }));
  return 'bot';
}

async function sendNewsWithFailover(item, context) {
  const { settings, client } = context;
  const channelId = settings.discordChannelId || '';

  try {
    await sendViaBot(item, client, channelId, settings);
    logger.debug('Message sent via bot', { title: item.title, source: item.source });
    return 'bot';
  } catch (botError) {
    logger.warn('Bot failed, attempting webhook fallback', {
      title: item.title,
      source: item.source,
      error: botError.message
    });

    try {
      await sendViaWebhook(item, settings);
      logger.warn('Bot failed, sent via webhook', { title: item.title, source: item.source });

      if (settings.retryBotAfterFallback) {
        const retryDelay = Number(settings.retryBotDelayMs || 3000);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        try {
          await sendViaBot(item, client, channelId, settings);
          logger.debug('Retry via bot succeeded after webhook fallback', { title: item.title, source: item.source });
        } catch (retryError) {
          logger.warn('Retry via bot failed after webhook fallback', {
            title: item.title,
            source: item.source,
            error: retryError.message
          });
        }
      }

      return 'webhook';
    } catch (webhookError) {
      logger.error('Both bot and webhook failed', {
        title: item.title,
        source: item.source,
        botError: botError.message,
        webhookError: webhookError.message
      });
      throw webhookError;
    }
  }
}

async function dispatchNewsItem(item, context) {
  const { settings, client } = context;
  const mode = settings.postMode || 'hybrid';
  const channelId = settings.discordChannelId || '';

  if (mode === 'hybrid') {
    return sendNewsWithFailover(item, context);
  }

  if (mode === 'bot') {
    if (!client || !channelId) {
      logger.warn('News item skipped because bot mode requires client and channelId', { title: item.title });
      return 'skipped';
    }
    await sendViaBot(item, client, channelId, settings);
    logger.debug('Message sent via bot', { title: item.title, source: item.source });
    return 'bot';
  }

  if (mode === 'webhook') {
    await sendViaWebhook(item, settings);
    logger.debug('Message sent via webhook', { title: item.title, source: item.source });
    return 'webhook';
  }

  logger.warn('News item skipped due to unknown postMode', { title: item.title, mode });
  return 'skipped';
}

async function processQueue(context) {
  if (processing) {
    return;
  }

  processing = true;

  try {
    while (queue.length > 0) {
      const item = queue.shift();
      const method = await dispatchNewsItem(item, context);
      logger.info('News delivery completed', { method });
      const delay = Number(context.settings.rateLimitMs || 1200);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  } catch (error) {
    logger.error('Failed while processing Discord queue', { error: error.message });
  } finally {
    processing = false;
  }
}

function enqueueNews(items, context) {
  queue.push(...items);
  processQueue(context);
}

module.exports = {
  enqueueNews,
  buildMessage,
  sendNewsWithFailover
};
