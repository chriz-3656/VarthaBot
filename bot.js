const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActivityType,
  ChannelType
} = require('discord.js');
const { env } = require('./config');
const logger = require('./utils/logger');
const { getNewsCache } = require('./services/rssService');
const { buildDiscordMessage } = require('./services/presentationService');
const { getSettings, setSettings } = require('./services/runtimeService');

const guildCommands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the news delivery channel')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel where news should be posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
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
    .setName('commands')
    .setDescription('Preview all available bot commands'),
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
    .setName('commands')
    .setDescription('Preview all available bot commands'),
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
let presenceTimer = null;

function buildPresenceEntries(options = {}) {
  const runtime = typeof options.getRuntimeInfo === 'function' ? options.getRuntimeInfo() : {};
  const settings = runtime?.settings || {};
  const interval = Number(settings.fetchIntervalSeconds || 1800);
  const delivery = settings.deliveryEnabled === false ? 'Delivery Locked' : 'Delivery Active';

  return [
    { name: 'Malayalam News Live', type: ActivityType.Watching },
    { name: `${delivery}`, type: ActivityType.Playing },
    { name: `Fetch every ${interval}s`, type: ActivityType.Watching },
    { name: '/commands • /news • /clear', type: ActivityType.Listening }
  ];
}

function startPresenceRotation(options = {}) {
  if (!client?.user) {
    return;
  }

  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }

  let index = 0;
  const applyPresence = () => {
    const activities = buildPresenceEntries(options);
    const next = activities[index % activities.length];
    index += 1;

    client.user.setPresence({
      status: 'online',
      activities: [next]
    });
  };

  applyPresence();
  presenceTimer = setInterval(applyPresence, 60_000);
}

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

function buildNewsPayload(items, interactive, guildId = 'GLOBAL') {
  const settings = getSettings(guildId);
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
    lastFetch: lastFetchAt ? (lastFetchAt > 0 ? new Date(lastFetchAt).toLocaleString() : 'No fetch yet') : 'No fetch yet'
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
    startPresenceRotation(options);
  });

  client.on('interactionCreate', async (interaction) => {
    const guildId = interaction.guildId || 'GLOBAL';

    // Auto-sync guild name for the dashboard monitor
    if (interaction.inGuild() && interaction.guild) {
      const settings = getSettings(guildId);
      if (settings.guildName !== interaction.guild.name) {
        setSettings({ ...settings, guildName: interaction.guild.name }, guildId);
      }
    }

    try {
      if (interaction.isButton() && interaction.customId === 'refresh_news') {
        const ephemeral = interaction.inGuild();
        await interaction.deferReply({ ephemeral });
        if (typeof options.onNewsRequest === 'function') {
          const result = await options.onNewsRequest(guildId);
          const latest = Array.isArray(result?.latest) ? result.latest : [];
          if (latest.length === 0) {
            await interaction.editReply({ content: 'No fresh news available right now.' });
            return;
          }

          const payload = buildNewsPayload(latest.slice(0, 1), true, guildId);
          await interaction.editReply({
            content: 'Latest news refreshed:',
            ...payload
          });
          return;
        }

        await interaction.editReply({ content: 'Refresh action is unavailable.' });
        return;
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }

      if (interaction.commandName === 'setup') {
        if (!interaction.inGuild()) {
          await interaction.reply({ content: '/setup can only be used inside a server.', ephemeral: false });
          return;
        }

        const channel = interaction.options.getChannel('channel');
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({ content: 'Please select a valid text channel.', ephemeral: true });
          return;
        }

        const current = getSettings(guildId);
        const next = {
          ...current,
          guildName: interaction.guild.name,
          discordChannelId: channel.id,
          deliveryEnabled: true
        };

        setSettings(next, guildId);
        await interaction.reply({
          content: `✅ News delivery channel configured: ${channel}. Delivery is now enabled for this server.`,
          ephemeral: true
        });
        return;
      }

      if (interaction.commandName === 'news') {
        let items = getNewsCache();
        const ephemeral = interaction.inGuild();
        await interaction.deferReply({ ephemeral });

        if (typeof options.onNewsRequest === 'function') {
          const result = await options.onNewsRequest(guildId);
          if (Array.isArray(result?.latest) && result.latest.length > 0) {
            items = result.latest;
          }
        }

        if (items.length === 0) {
          await interaction.editReply({
            content: 'No cached news yet. Use dashboard Fetch Now or wait for scheduler.'
          });
          return;
        }

        const payload = buildNewsPayload(items, true, guildId);
        await interaction.editReply({ ...payload });
      }

      if (interaction.commandName === 'info') {
        const runtime = typeof options.getRuntimeInfo === 'function' ? options.getRuntimeInfo(guildId) : {};
        const fmt = formatRuntimeInfo(runtime);
        const settings = runtime?.settings || {};
        const cached = getNewsCache().length;

        const infoEmbed = {
          color: 0x7c3aed,
          title: 'വാർത്ത ബോട്ട് • Info',
          description: `Bot runtime and details for this ${interaction.inGuild() ? 'server' : 'DM'}`,
          fields: [
            { name: 'Uptime', value: fmt.uptime, inline: true },
            { name: 'Started At', value: fmt.started, inline: true },
            { name: 'Last Fetch', value: fmt.lastFetch, inline: true },
            { name: 'Post Mode', value: String(settings.postMode || 'hybrid'), inline: true },
            {
              name: 'Delivery',
              value: settings.deliveryEnabled === false ? 'Disabled' : 'Enabled',
              inline: true
            },
            { name: 'Fetch Interval', value: `${Number(settings.fetchIntervalSeconds || 1800)}s`, inline: true },
            { name: 'Cached News', value: String(cached), inline: true },
            { name: 'Guild ID', value: guildId, inline: true },
            { name: 'Commands', value: '`/commands`, `/info`, `/news`, `/clear`, `/reload`', inline: false }
          ],
          footer: { text: settings.footerBrandingText || 'Powered by വാർത്ത ബോട്ട്' },
          timestamp: new Date().toISOString()
        };

        await interaction.reply({
          embeds: [infoEmbed],
          ephemeral: interaction.inGuild()
        });
      }

      if (interaction.commandName === 'commands') {
        const settings = getSettings(guildId);
        const previewEmbed = {
          color: 0x38bdf8,
          title: 'വാർത്ത ബോട്ട് • Command Preview',
          description: 'Available commands and quick usage',
          fields: [
            { name: '/setup channel:<#channel>', value: 'Set the target news channel (admin only)', inline: false },
            { name: '/commands', value: 'Show this command preview list', inline: false },
            { name: '/news', value: 'Fetch latest cached/fresh news', inline: false },
            { name: '/info', value: 'Show bot runtime details', inline: false },
            { name: '/clear count:<1-100>', value: 'Clear messages (DM: bot messages, Guild: requires Manage Messages)', inline: false },
            { name: '/reload', value: 'Reload settings/feeds (guild admin only)', inline: false }
          ],
          footer: { text: settings.footerBrandingText || 'Powered by വാർത്ത ബോട്ട്' },
          timestamp: new Date().toISOString()
        };

        await interaction.reply({
          embeds: [previewEmbed],
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
          await options.onReload(guildId);
        }

        await interaction.reply({ content: 'Settings and feeds reloaded for this server.', ephemeral: true });
      }
    } catch (error) {
      logger.error('Interaction error', { error: error.message, guildId });
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
