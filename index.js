const { Client, GatewayIntentBits, REST, Routes, Partials, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

// ================= SAFETY =================
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// ================= EXPRESS =================
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

// ================= STORAGE =================
let joinLogs = {};
let leaveLogs = {};
let boostLogs = {};

// ================= ACTIVITY TIMER =================
let activityTimer = null;
let activityStart = null;
let activityText = null;
let activityType = ActivityType.Playing;

// ================= REGISTER COMMANDS =================
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'Starting...', type: ActivityType.Playing }]
  });

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: [
      { name: 'say', description: 'Send message', options: [{ name: 'text', type: 3, required: true }] },

      { name: 'joinvc', description: 'Join VC' },
      { name: 'leavevc', description: 'Leave VC' },

      { name: 'dstatus', description: 'Set bot status', options: [
        { name: 'state', type: 3, required: true }
      ]},

      { name: 'activity', description: 'Set activity with timer', options: [
        { name: 'type', type: 3, required: true },
        { name: 'text', type: 3, required: true }
      ]},

      { name: 'logjoins', description: 'Set join log', options: [
        { name: 'channel', type: 7, required: true }
      ]},

      { name: 'logleaves', description: 'Set leave log', options: [
        { name: 'channel', type: 7, required: true }
      ]},

      { name: 'logboosts', description: 'Set boost log', options: [
        { name: 'channel', type: 7, required: true }
      ]}
    ]
  });

  console.log("Slash commands registered");
});

// ================= TIMER (SAFE - DOES NOT BREAK COMMANDS) =================
function startTimer() {
  if (activityTimer) clearInterval(activityTimer);

  activityStart = Date.now();

  activityTimer = setInterval(() => {
    if (!activityText) return;

    const seconds = Math.floor((Date.now() - activityStart) / 1000);

    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');

    client.user.setActivity(
      `${activityText} | ${h}:${m}:${s}`,
      { type: activityType }
    );
  }, 5000);
}

// ================= INTERACTIONS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const commandName = interaction.commandName;

  // 🔥 ALIASES FIX
  const cmd = {
    logs: 'logjoins',
    stayvc: 'joinvc'
  }[commandName] || commandName;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    // ================= SAY =================
    if (cmd === 'say') {
      return interaction.editReply(interaction.options.getString('text'));
    }

    // ================= VC JOIN =================
    if (cmd === 'joinvc') {
      const channel = interaction.member.voice.channel;
      if (!channel) return interaction.editReply('Join a VC first');

      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
      });

      return interaction.editReply('Joined VC');
    }

    // ================= VC LEAVE =================
    if (cmd === 'leavevc') {
      const conn = getVoiceConnection(interaction.guild.id);
      if (!conn) return interaction.editReply('Not in VC');

      conn.destroy();
      return interaction.editReply('Left VC');
    }

    // ================= STATUS FIX (THIS IS THE IMPORTANT ONE) =================
    if (cmd === 'dstatus') {
      const state = interaction.options.getString('state').toLowerCase();

      const allowed = ['online', 'idle', 'dnd', 'invisible'];
      if (!allowed.includes(state)) {
        return interaction.editReply('Use: online / idle / dnd / invisible');
      }

      // FORCE FULL UPDATE (fixes “stuck online” bug)
      client.user.setPresence({
        status: state,
        activities: client.user.presence?.activities || []
      });

      return interaction.editReply(`Status set to ${state}`);
    }

    // ================= ACTIVITY + TIMER =================
    if (cmd === 'activity') {
      const type = interaction.options.getString('type').toLowerCase();
      const text = interaction.options.getString('text');

      const map = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening,
        streaming: ActivityType.Streaming
      };

      activityType = map[type] || ActivityType.Playing;
      activityText = text;

      client.user.setPresence({
        status: client.user.presence?.status || 'online',
        activities: [{
          name: `${activityText} | 00:00:00`,
          type: activityType
        }]
      });

      startTimer();

      return interaction.editReply('Activity timer started');
    }

    // ================= LOGS =================
    if (cmd === 'logjoins') {
      const ch = interaction.options.getChannel('channel');
      joinLogs[interaction.guild.id] = ch.id;
      return interaction.editReply('Join log set');
    }

    if (cmd === 'logleaves') {
      const ch = interaction.options.getChannel('channel');
      leaveLogs[interaction.guild.id] = ch.id;
      return interaction.editReply('Leave log set');
    }

    if (cmd === 'logboosts') {
      const ch = interaction.options.getChannel('channel');
      boostLogs[interaction.guild.id] = ch.id;
      return interaction.editReply('Boost log set');
    }

  } catch (err) {
    console.error(err);

    try {
      if (!interaction.replied) {
        await interaction.editReply('Error occurred');
      }
    } catch {}
  }
});

// ================= EVENTS =================
client.on('guildMemberAdd', member => {
  const ch = joinLogs[member.guild.id];
  if (ch) member.guild.channels.cache.get(ch)?.send(`${member.user.tag} joined`);
});

client.on('guildMemberRemove', member => {
  const ch = leaveLogs[member.guild.id];
  if (ch) member.guild.channels.cache.get(ch)?.send(`${member.user.tag} left`);
});

client.on('guildMemberUpdate', (o, n) => {
  if (!o.premiumSince && n.premiumSince) {
    const ch = boostLogs[n.guild.id];
    if (ch) n.guild.channels.cache.get(ch)?.send(`${n.user.tag} boosted 🚀`);
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
