const { Client, GatewayIntentBits, REST, Routes, Partials, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ================= STORAGE =================
let joinLog = {};
let leaveLog = {};
let boostLog = {};
let autorole = {};

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ================= ACTIVITY TIMER =================
let activityTimer = null;
let activityStart = null;
let activityText = null;
let activityType = ActivityType.Playing;

function startTimer() {
  if (activityTimer) clearInterval(activityTimer);

  activityStart = Date.now();

  activityTimer = setInterval(() => {
    if (!activityText) return;

    const seconds = Math.floor((Date.now() - activityStart) / 1000);

    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');

    client.user.setPresence({
      status: client.user.presence?.status || 'online',
      activities: [
        {
          name: `${activityText} | ${h}:${m}:${s}`,
          type: activityType
        }
      ]
    });
  }, 5000);
}

// ================= READY =================
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

      { name: 'dstatus', description: 'Change bot status', options: [
        { name: 'state', type: 3, required: true }
      ]},

      { name: 'activity', description: 'Set activity with timer', options: [
        { name: 'type', type: 3, required: true },
        { name: 'text', type: 3, required: true }
      ]},

      { name: 'logjoins', description: 'Set join log channel', options: [
        { name: 'channel', type: 7, required: true }
      ]},

      { name: 'logleaves', description: 'Set leave log channel', options: [
        { name: 'channel', type: 7, required: true }
      ]},

      { name: 'logboosts', description: 'Set boost log channel', options: [
        { name: 'channel', type: 7, required: true }
      ]}
    ]
  });

  console.log("Slash commands loaded");
});

// ================= INTERACTIONS (FULL FIXED) =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (!interaction.deferred) await interaction.deferReply();

    const { commandName, options } = interaction;

    // ================= SAY =================
    if (commandName === 'say') {
      return interaction.editReply(options.getString('text'));
    }

    // ================= VC JOIN =================
    if (commandName === 'joinvc') {
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
    if (commandName === 'leavevc') {
      const conn = getVoiceConnection(interaction.guild.id);
      if (!conn) return interaction.editReply('Not in VC');

      conn.destroy();
      return interaction.editReply('Left VC');
    }

    // ================= STATUS FIX =================
    if (commandName === 'dstatus') {
      const state = options.getString('state').toLowerCase();

      const allowed = ['online', 'idle', 'dnd', 'invisible'];
      if (!allowed.includes(state)) {
        return interaction.editReply('Use: online / idle / dnd / invisible');
      }

      client.user.setPresence({
        status: state,
        activities: client.user.presence?.activities || []
      });

      return interaction.editReply(`Status set to ${state}`);
    }

    // ================= ACTIVITY + TIMER =================
    if (commandName === 'activity') {
      const type = options.getString('type').toLowerCase();
      const text = options.getString('text');

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
        activities: [
          {
            name: `${activityText} | 00:00:00`,
            type: activityType
          }
        ]
      });

      startTimer();

      return interaction.editReply('Activity timer started');
    }

    // ================= LOGS =================
    if (commandName === 'logjoins') {
      const ch = options.getChannel('channel');
      joinLog[interaction.guild.id] = ch.id;
      save('join.json', joinLog);
      return interaction.editReply('Join log set');
    }

    if (commandName === 'logleaves') {
      const ch = options.getChannel('channel');
      leaveLog[interaction.guild.id] = ch.id;
      save('leave.json', leaveLog);
      return interaction.editReply('Leave log set');
    }

    if (commandName === 'logboosts') {
      const ch = options.getChannel('channel');
      boostLog[interaction.guild.id] = ch.id;
      save('boost.json', boostLog);
      return interaction.editReply('Boost log set');
    }

  } catch (err) {
    console.error('ERROR:', err);

    try {
      if (!interaction.replied) {
        await interaction.editReply('Error occurred');
      }
    } catch {}
  }
});

// ================= EVENTS =================
client.on('guildMemberAdd', member => {
  const ch = joinLog[member.guild.id];
  if (ch) member.guild.channels.cache.get(ch)?.send(`${member.user.tag} joined`);
});

client.on('guildMemberRemove', member => {
  const ch = leaveLog[member.guild.id];
  if (ch) member.guild.channels.cache.get(ch)?.send(`${member.user.tag} left`);
});

client.on('guildMemberUpdate', (o, n) => {
  if (!o.premiumSince && n.premiumSince) {
    const ch = boostLog[n.guild.id];
    if (ch) n.guild.channels.cache.get(ch)?.send(`${n.user.tag} boosted 🚀`);
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
