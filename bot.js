const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { env } = require('./config');
const logger = require('./utils/logger');
const { getNewsCache } = require('./services/rssService');
const { buildDiscordMessage } = require('./services/presentationService');
const { getSettings } = require('./services/runtimeService');

const guildCommands = [
  new SlashCommandBuilder()
    .setName('news')
    .setDescription('Fetch latest Malayalam news'),
  new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Reload feeds/settings (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Show bot info and runtime details'),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear messages in this chat (guild/DM)')
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('How many messages to clear')
        .setMinValue(1)
        .setMaxValue(100)
    )
].map((c) => c.toJSON());

const globalCommands = [
  new SlashCommandBuilder()
    .setName('news')
    .setDescription('Fetch latest Malayalam news'),
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Show bot info and runtime details'),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear messages in this chat (guild/DM)')
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('How many messages to clear')
        .setMinValue(1)
        .setMaxValue(100)
    )
].map((c) => c.toJSON());

let client = null;

async function registerSlashCommands() {
  if (!env.DISCORD_TOKEN || !env.CLIENT_ID) {
    logger.warn('Skipping slash command registration; missing DISCORD_TOKEN/CLIENT_ID');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: globalCommands });
  logger.info('Global slash commands registered (DM support enabled)');

  if (env.GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), { body: guildCommands });
    logger.info('Guild slash commands registered');
  }
}

function buildNewsPayload(items, interactive) {
  const settings = getSettings();
  const embeds = [];
  for (const item of items.slice(0, 5)) {
    const payload = buildDiscordMessage(item, settings, { enableInteractive: interactive });
    embeds.push(payload.embeds[0]);
  }

  const first = items[0];
  const firstComponents = first
    ? buildDiscordMessage(first, settings, { enableInteractive: interactive }).components
    : [];

  return {
    embeds,
    components: firstComponents
  };
}

function formatRuntimeInfo(runtime) {
  const startedAt = runtime?.startedAt ? new Date(runtime.startedAt) : null;
  const lastFetchAt = runtime?.lastFetchAt ? new Date(runtime.lastFetchAt) : null;
  const now = Date.now();
  const uptimeSec = startedAt ? Math.max(0, Math.floor((now - startedAt.getTime()) / 1000)) : 0;
  const uptimeMin = Math.floor(uptimeSec / 60);
  const uptimeHrs = Math.floor(uptimeMin / 60);

  return {
    uptime: uptimeHrs > 0 ? `${uptimeHrs}h ${uptimeMin % 60}m` : `${uptimeMin}m`,
    started: startedAt ? startedAt.toLocaleString() : '-',
    lastFetch: lastFetchAt ? lastFetchAt.toLocaleString() : 'No fetch yet'
  };
}

async function initBot(options = {}) {
  if (!env.DISCORD_TOKEN) {
    logger.warn('DISCORD_TOKEN missing: bot client will not start');
    return null;
  }

  await registerSlashCommands();

  client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once('clientReady', () => {
    logger.info(`Discord bot online as ${client.user.tag}`);
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId === 'refresh_news') {
        const ephemeral = interaction.inGuild();
        if (typeof options.onNewsRequest === 'function') {
          const result = await options.onNewsRequest();
          const latest = Array.isArray(result?.latest) ? result.latest : [];
          if (latest.length === 0) {
            await interaction.reply({ content: 'No fresh news available right now.', ephemeral });
            return;
          }

          const payload = buildNewsPayload(latest.slice(0, 1), true);
          await interaction.reply({
            content: 'Latest news refreshed:',
            ...payload,
            ephemeral
          });
          return;
        }

        await interaction.reply({ content: 'Refresh action is unavailable.', ephemeral });
        return;
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }

      if (interaction.commandName === 'news') {
        let items = getNewsCache();
        const ephemeral = interaction.inGuild();

        if (typeof options.onNewsRequest === 'function') {
          const result = await options.onNewsRequest();
          if (Array.isArray(result?.latest) && result.latest.length > 0) {
            items = result.latest;
          }
        }

        if (items.length === 0) {
          await interaction.reply({
            content: 'No cached news yet. Use dashboard Fetch Now or wait for scheduler.',
            ephemeral
          });
          return;
        }

        const payload = buildNewsPayload(items, true);
        await interaction.reply({ ...payload, ephemeral });
      }

      if (interaction.commandName === 'info') {
        const runtime = typeof options.getRuntimeInfo === 'function' ? options.getRuntimeInfo() : {};
        const fmt = formatRuntimeInfo(runtime);
        const settings = runtime?.settings || {};
        const cached = getNewsCache().length;

        const infoEmbed = {
          color: 0x7c3aed,
          title: 'വാർത്ത ബോട്ട് • Info',
          description: 'Bot runtime and command details',
          fields: [
            { name: 'Uptime', value: fmt.uptime, inline: true },
            { name: 'Started At', value: fmt.started, inline: true },
            { name: 'Last Fetch', value: fmt.lastFetch, inline: true },
            { name: 'Post Mode', value: String(settings.postMode || 'hybrid'), inline: true },
            {
              name: 'Delivery',
              value: settings.deliveryEnabled === false ? 'Disabled (Dashboard Locked)' : 'Enabled',
              inline: true
            },
            { name: 'Fetch Interval', value: `${Number(settings.fetchIntervalSeconds || 1800)}s`, inline: true },
            { name: 'Cached News', value: String(cached), inline: true },
            { name: 'Commands', value: '`/info`, `/news`, `/clear`, `/reload`', inline: false }
          ],
          footer: { text: 'Powered by വാർത്ത ബോട്ട്' },
          timestamp: new Date().toISOString()
        };

        await interaction.reply({
          embeds: [infoEmbed],
          ephemeral: interaction.inGuild()
        });
      }

      if (interaction.commandName === 'clear') {
        const requested = interaction.options.getInteger('count') || 10;
        const count = Math.max(1, Math.min(100, requested));

        if (interaction.inGuild()) {
          const canManageMessages = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
          if (!canManageMessages) {
            await interaction.reply({ content: 'Manage Messages permission required.', ephemeral: true });
            return;
          }

          await interaction.deferReply({ ephemeral: true });
          const channel = interaction.channel;

          if (!channel || !channel.isTextBased() || typeof channel.bulkDelete !== 'function') {
            await interaction.editReply('This channel does not support bulk delete.');
            return;
          }

          const deleted = await channel.bulkDelete(count, true);
          await interaction.editReply(`Cleared ${deleted.size} message(s) from this channel.`);
          return;
        }

        await interaction.deferReply();
        const channel = interaction.channel;
        const botId = interaction.client.user?.id;
        if (!channel || !channel.isTextBased() || !botId) {
          await interaction.editReply('Unable to clear messages in this DM.');
          return;
        }

        const fetched = await channel.messages.fetch({ limit: 100 });
        const ownMessages = fetched.filter((message) => message.author?.id === botId).first(count);
        let deletedCount = 0;
        for (const message of ownMessages) {
          try {
            await message.delete();
            deletedCount += 1;
          } catch (_error) {
            // Ignore per-message delete failures in DM.
          }
        }

        await interaction.editReply(`Cleared ${deletedCount} bot message(s) in this DM.`);
        return;
      }

      if (interaction.commandName === 'reload') {
        if (!interaction.inGuild()) {
          await interaction.reply({ content: '/reload can only be used inside a server.', ephemeral: false });
          return;
        }

        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
        if (!isAdmin) {
          await interaction.reply({ content: 'Admin permission required.', ephemeral: true });
          return;
        }

        if (typeof options.onReload === 'function') {
          await options.onReload();
        }

        await interaction.reply({ content: 'Settings and feeds reloaded.', ephemeral: true });
      }
    } catch (error) {
      logger.error('Interaction error', { error: error.message });
      const ephemeral = interaction.inGuild();
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'Action failed. Check logs.', ephemeral });
      } else {
        await interaction.reply({ content: 'Action failed. Check logs.', ephemeral });
      }
    }
  });

  await client.login(env.DISCORD_TOKEN);
  return client;
}

function getClient() {
  return client;
}

if (require.main === module) {
  if (process.argv.includes('--register-only')) {
    registerSlashCommands().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  } else {
    initBot().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}

module.exports = {
  initBot,
  getClient,
  registerSlashCommands
};
