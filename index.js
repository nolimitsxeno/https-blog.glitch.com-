const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const express = require('express');

// ================= SAFETY =================
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// ================= EXPRESS (RENDER KEEP ALIVE) =================
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ================= FILE STORAGE =================
let boostLogChannels = fs.existsSync('boostlog.json') ? JSON.parse(fs.readFileSync('boostlog.json')) : {};
let joinLogChannels = fs.existsSync('joinlog.json') ? JSON.parse(fs.readFileSync('joinlog.json')) : {};
let leaveLogChannels = fs.existsSync('leavelog.json') ? JSON.parse(fs.readFileSync('leavelog.json')) : {};
let autoroles = fs.existsSync('autorole.json') ? JSON.parse(fs.readFileSync('autorole.json')) : {};
let activeChannels = fs.existsSync('activechannels.json') ? JSON.parse(fs.readFileSync('activechannels.json')) : {};

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ================= READY =================
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: 'Starting...', type: ActivityType.Playing }],
    status: 'online'
  });

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: [
      { name: 'say', description: 'Send message', options: [{ name: 'text', type: 3, required: true }] },
      { name: 'invite', description: 'Invite link' },
      { name: 'dm', description: 'DM user', options: [
        { name: 'user', type: 6, required: true },
        { name: 'message', type: 3, required: true }
      ]},

      { name: 'joinvc', description: 'Join VC' },
      { name: 'leavevc', description: 'Leave VC' },

      { name: 'status', description: 'Change bot status', options: [
        { name: 'state', type: 3, required: true }
      ]},

      { name: 'activity', description: 'Change bot activity', options: [
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
      ]},

      { name: 'active', description: 'Set active channel', options: [
        { name: 'channel', type: 7, required: true }
      ]},

      { name: 'autorole', description: 'Set auto role', options: [
        { name: 'role', type: 8, required: true }
      ]}
    ]
  });

  console.log("Slash commands registered");
});

// ================= SLASH COMMANDS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply().catch(() => {});

    const { commandName, options, guild } = interaction;

    // ===== BASIC =====
    if (commandName === 'say') return interaction.editReply(options.getString('text'));

    if (commandName === 'invite') return interaction.editReply('Invite link here');

    if (commandName === 'dm') {
      const user = options.getUser('user');
      await user.send(options.getString('message'));
      return interaction.editReply('Sent');
    }

    // ===== VC =====
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

    if (commandName === 'leavevc') {
      const connection = getVoiceConnection(interaction.guild.id);
      if (!connection) return interaction.editReply('Not in VC');

      connection.destroy();
      return interaction.editReply('Left VC');
    }

    // ===== STATUS =====
    if (commandName === 'status') {
      const state = options.getString('state');

      client.user.setPresence({
        status: state.toLowerCase(),
        activities: client.user.presence?.activities || []
      });

      return interaction.editReply(`Status set to ${state}`);
    }

    // ===== ACTIVITY =====
    if (commandName === 'activity') {
      const type = options.getString('type');
      const text = options.getString('text');

      const map = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening
      };

      client.user.setPresence({
        status: client.user.presence?.status || 'online',
        activities: [{
          name: text,
          type: map[type.toLowerCase()] || ActivityType.Playing
        }]
      });

      return interaction.editReply('Activity updated');
    }

    // ===== LOGS =====
    if (commandName === 'logjoins') {
      const ch = options.getChannel('channel');
      joinLogChannels[guild.id] = ch.id;
      save('joinlog.json', joinLogChannels);
      return interaction.editReply('Join log set');
    }

    if (commandName === 'logleaves') {
      const ch = options.getChannel('channel');
      leaveLogChannels[guild.id] = ch.id;
      save('leavelog.json', leaveLogChannels);
      return interaction.editReply('Leave log set');
    }

    if (commandName === 'logboosts') {
      const ch = options.getChannel('channel');
      boostLogChannels[guild.id] = ch.id;
      save('boostlog.json', boostLogChannels);
      return interaction.editReply('Boost log set');
    }

    if (commandName === 'active') {
      const ch = options.getChannel('channel');
      activeChannels[guild.id] = ch.id;
      save('activechannels.json', activeChannels);
      return interaction.editReply('Active channel set');
    }

    if (commandName === 'autorole') {
      const role = options.getRole('role');
      autoroles[guild.id] = role.id;
      save('autorole.json', autoroles);
      return interaction.editReply('Autorole set');
    }

  } catch (err) {
    console.error(err);
    try { await interaction.editReply('Error'); } catch {}
  }
});

// ================= PREFIX COMMANDS =================
client.on('messageCreate', async (message) => {
  try {
    if (!message.guild || message.author.bot) return;
    if (!message.content.startsWith(',')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'ping') return message.reply(`Pong! ${client.ws.ping}ms`);
    if (cmd === 'say') return message.channel.send(args.join(' '));

    if (cmd === 'kick') {
      const user = message.mentions.members.first();
      if (!user) return;
      await user.kick(args.slice(1).join(' ') || 'No reason');
    }

    if (cmd === 'ban') {
      const user = message.mentions.members.first();
      if (!user) return;
      await user.ban({ reason: args.slice(1).join(' ') || 'No reason' });
    }

    if (cmd === 'unban') {
      await message.guild.members.unban(args[0]);
    }

  } catch (err) {
    console.error("PREFIX ERROR:", err);
  }
});

// ================= EVENTS =================
client.on('guildMemberAdd', member => {
  const role = autoroles[member.guild.id];
  if (role) member.roles.add(role).catch(() => {});

  const ch = joinLogChannels[member.guild.id];
  if (ch) member.guild.channels.cache.get(ch)?.send(`${member.user.tag} joined`);
});

client.on('guildMemberRemove', member => {
  const ch = leaveLogChannels[member.guild.id];
  if (ch) member.guild.channels.cache.get(ch)?.send(`${member.user.tag} left`);
});

client.on('guildMemberUpdate', (oldM, newM) => {
  if (!oldM.premiumSince && newM.premiumSince) {
    const ch = boostLogChannels[newM.guild.id];
    if (ch) newM.guild.channels.cache.get(ch)?.send(`${newM.user.tag} boosted 🚀`);
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
