const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const https = require('https');
const express = require('express');

// ===== Express server =====
const app = express();
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ===== BASIC =====
const PREFIX = ",";
const OWNER_ID = "1375128465430417610";

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ===== FILE SYSTEMS (UNCHANGED) =====
let boostLogChannels = fs.existsSync('boostlog.json') ? JSON.parse(fs.readFileSync('boostlog.json')) : {};
let joinLogChannels = fs.existsSync('joinlog.json') ? JSON.parse(fs.readFileSync('joinlog.json')) : {};
let leaveLogChannels = fs.existsSync('leavelog.json') ? JSON.parse(fs.readFileSync('leavelog.json')) : {};
let autoroles = fs.existsSync('autorole.json') ? JSON.parse(fs.readFileSync('autorole.json')) : {};
let activeChannels = fs.existsSync('activechannels.json') ? JSON.parse(fs.readFileSync('activechannels.json')) : {};

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data));
}

// ===== READY =====
client.once('clientReady', async () => {
  console.log(`Bot is online as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: 'Starting...', type: ActivityType.Playing }],
    status: 'online'
  });

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: [
      { name: 'say', description: 'Send message', options: [{ name: 'text', type: 3, required: true }] },
      { name: 'invite', description: 'Invite link' },
      { name: 'dm', description: 'DM user', options: [{ name: 'user', type: 6, required: true }, { name: 'message', type: 3, required: true }] },
      { name: 'autorole', description: 'Set autorole', options: [{ name: 'role', type: 8 }] },
      { name: 'logboosts', description: 'Set boost log', options: [{ name: 'channel', type: 7 }] },
      { name: 'logjoins', description: 'Set join log', options: [{ name: 'channel', type: 7 }] },
      { name: 'logleaves', description: 'Set leave log', options: [{ name: 'channel', type: 7 }] },
      { name: 'active', description: 'Set active channel', options: [{ name: 'channel', type: 7 }] },
      { name: 'status', description: 'Change bot status', options: [
        { name: 'state', type: 3, required: true }
      ]},
      { name: 'customactivity', description: 'Change activity', options: [
        { name: 'text', type: 3, required: true },
        { name: 'type', type: 3, required: true }
      ]},
      { name: 'joinvc', description: 'Join VC' },
      { name: 'leavevc', description: 'Leave VC' }
    ]
  });

  setInterval(async () => {
    for (const [guildId, channelId] of Object.entries(activeChannels)) {
      const guild = client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(channelId);
      if (channel) channel.send('Hello guys!');
    }
  }, 12 * 60 * 60 * 1000);
});

// ===== EVENTS =====
client.on('guildMemberAdd', member => {
  const roleId = autoroles[member.guild.id];
  if (roleId) member.roles.add(roleId).catch(() => {});
});

client.on('guildMemberRemove', member => {
  const ch = leaveLogChannels[member.guild.id];
  if (ch) member.guild.channels.cache.get(ch)?.send(`${member.user.tag} left`);
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (!oldMember.premiumSince && newMember.premiumSince) {
    const ch = boostLogChannels[newMember.guild.id];
    if (ch) newMember.guild.channels.cache.get(ch)?.send(`${newMember.user.tag} boosted! 🚀`);
  }
});

// ===== SLASH COMMANDS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();

  const { commandName, options, guild } = interaction;

  try {
    if (commandName === 'say') {
      await interaction.editReply(options.getString('text'));
    }

    if (commandName === 'invite') {
      await interaction.editReply('Invite link here');
    }

    if (commandName === 'dm') {
      const user = options.getUser('user');
      await user.send(options.getString('message'));
      await interaction.editReply('Sent');
    }

    if (commandName === 'autorole') {
      const role = options.getRole('role');
      autoroles[guild.id] = role.id;
      save('autorole.json', autoroles);
      await interaction.editReply('Autorole set');
    }

    if (commandName === 'logboosts') {
      const ch = options.getChannel('channel');
      boostLogChannels[guild.id] = ch.id;
      save('boostlog.json', boostLogChannels);
      await interaction.editReply('Boost log set');
    }

    if (commandName === 'logjoins') {
      const ch = options.getChannel('channel');
      joinLogChannels[guild.id] = ch.id;
      save('joinlog.json', joinLogChannels);
      await interaction.editReply('Join log set');
    }

    if (commandName === 'logleaves') {
      const ch = options.getChannel('channel');
      leaveLogChannels[guild.id] = ch.id;
      save('leavelog.json', leaveLogChannels);
      await interaction.editReply('Leave log set');
    }

    if (commandName === 'active') {
      const ch = options.getChannel('channel');
      activeChannels[guild.id] = ch.id;
      save('activechannels.json', activeChannels);
      await interaction.editReply('Active channel set');
    }

    // ===== STATUS =====
    if (commandName === 'status') {
      const state = options.getString('state');

      client.user.setPresence({
        activities: client.user.presence.activities,
        status: state.toLowerCase()
      });

      await interaction.editReply('Status updated');
    }

    // ===== CUSTOM ACTIVITY =====
    if (commandName === 'customactivity') {
      const text = options.getString('text');
      const type = options.getString('type');

      const types = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening
      };

      client.user.setPresence({
        activities: [{ name: text, type: types[type.toLowerCase()] || ActivityType.Playing }],
        status: client.user.presence.status
      });

      await interaction.editReply('Activity updated');
    }

    // ===== JOIN VC =====
    if (commandName === 'joinvc') {
      const channel = interaction.member.voice.channel;

      if (!channel) {
        return await interaction.editReply('Join a VC first');
      }

      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
      });

      await interaction.editReply('Joined VC');
    }

    // ===== LEAVE VC =====
    if (commandName === 'leavevc') {
      const connection = getVoiceConnection(interaction.guild.id);

      if (!connection) {
        return await interaction.editReply('Not in VC');
      }

      connection.destroy();
      await interaction.editReply('Left VC');
    }

  } catch (err) {
    console.error(err);
    await interaction.editReply('Error');
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);


