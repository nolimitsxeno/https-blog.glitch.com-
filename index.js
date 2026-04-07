const { Client, GatewayIntentBits, REST, Routes, Partials, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const express = require('express');

// ===== Express server for Render =====
const app = express();
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ===== Constants =====
const OWNER_ID = "1375128465430417610";

// ===== Load data =====
const loadJSON = (file, defaultValue = {}) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : defaultValue;
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data));

let activeChannels = loadJSON('activechannels.json');
let logChannels = loadJSON('logchannels.json');
let joinLogChannels = loadJSON('joinlog.json');
let leaveLogChannels = loadJSON('leavelog.json');
let boostLogChannels = loadJSON('boostlog.json');
let autoroles = loadJSON('autorole.json');

// ===== Client =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ===== READY =====
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {
    body: [
      { name: 'say', description: 'Make the bot say something', options: [{ name: 'text', type: 3, description: 'Text to say', required: true }] },
      { name: 'invite', description: 'Get bot invite link' },
      { name: 'dm', description: 'DM a user', options: [{ name: 'user', type: 6, description: 'User to DM', required: true }, { name: 'message', type: 3, description: 'Message content', required: true }] },
      { name: 'autorole', description: 'Set autorole', options: [{ name: 'role', type: 8, description: 'Role to assign', required: true }] },
      { name: 'logboosts', description: 'Set boost log channel', options: [{ name: 'channel', type: 7, description: 'Channel for boost logs', required: true }] },
      { name: 'logjoins', description: 'Set join log channel', options: [{ name: 'channel', type: 7, description: 'Channel for join logs', required: true }] },
      { name: 'logleaves', description: 'Set leave log channel', options: [{ name: 'channel', type: 7, description: 'Channel for leave logs', required: true }] },
      { name: 'active', description: 'Set active message channel', options: [{ name: 'channel', type: 7, description: 'Channel for active messages', required: true }] },
      { name: 'logs', description: 'Set deleted message log channel', options: [{ name: 'channel', type: 7, description: 'Channel for deleted messages', required: true }] }
    ]
  });

  // 12-hour active message loop
  setInterval(() => {
    for (const [guildId, channelId] of Object.entries(activeChannels)) {
      const guild = client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(channelId);
      if (channel) channel.send('Hello guys!').catch(() => {});
    }
  }, 12 * 60 * 60 * 1000);
});

// ===== MEMBER JOIN/LEAVE =====
client.on('guildMemberAdd', member => {
  // Autorole
  const roleId = autoroles[member.guild.id];
  if (roleId) {
    const role = member.guild.roles.cache.get(roleId);
    const botMember = member.guild.members.me;
    if (role && role.position < botMember.roles.highest.position) {
      member.roles.add(role).catch(err => console.error('Failed to assign autorole:', err));
    }
  }

  // Join log
  const ch = member.guild.channels.cache.get(joinLogChannels[member.guild.id]);
  if (ch) ch.send(`${member.user.tag} joined`).catch(() => {});
});

client.on('guildMemberRemove', member => {
  const ch = member.guild.channels.cache.get(leaveLogChannels[member.guild.id]);
  if (ch) ch.send(`${member.user.tag} left`).catch(() => {});
});

// ===== BOOST LOGGING =====
client.on('guildMemberUpdate', (oldMember, newMember) => {
  const channelId = boostLogChannels[newMember.guild.id];
  if (!channelId) return;
  const channel = newMember.guild.channels.cache.get(channelId);
  if (!channel) return;

  if (!oldMember.premiumSince && newMember.premiumSince) {
    channel.send(`🚀 ${newMember.user.tag} just boosted the server!`).catch(() => {});
  } else if (oldMember.premiumSince && !newMember.premiumSince) {
    channel.send(`❌ ${newMember.user.tag} stopped boosting.`).catch(() => {});
  }
});

// ===== DELETED MESSAGE LOG =====
client.on('messageDelete', async message => {
  if (!message.guild) return;
  const ch = message.guild.channels.cache.get(logChannels[message.guild.id]);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle('Deleted Message')
    .setColor('Red')
    .addFields(
      { name: 'User', value: message.author?.tag || 'Unknown' },
      { name: 'Content', value: message.content || 'No text' }
    );

  ch.send({ embeds: [embed] }).catch(() => {});
});

// ===== COMMANDS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName, options, guild } = interaction;

    // /say
    if (commandName === 'say') {
      const text = options.getString('text');
      return interaction.reply({ content: text });
    }

    // /invite
    if (commandName === 'invite') {
      return interaction.reply({ content: 'Invite link here' });
    }

    // /dm
    if (commandName === 'dm') {
      const user = options.getUser('user');
      const msg = options.getString('message');
      try {
        await user.send(msg);
        return interaction.reply({ content: 'DM sent', ephemeral: true });
      } catch {
        return interaction.reply({ content: 'Failed to DM user', ephemeral: true });
      }
    }

    // /autorole
    if (commandName === 'autorole') {
      const role = options.getRole('role');
      if (!role) return interaction.reply({ content: 'You must select a role!', ephemeral: true });

      const botMember = guild.members.me;
      if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({ content: 'I need Manage Roles permission!', ephemeral: true });
      }
      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: 'I cannot assign a role higher or equal to my highest role.', ephemeral: true });
      }

      autoroles[guild.id] = role.id;
      saveJSON('autorole.json', autoroles);
      return interaction.reply({ content: `Autorole successfully set to ${role.name}`, ephemeral: true });
    }

    // /logboosts
    if (commandName === 'logboosts') {
      const ch = options.getChannel('channel');
      boostLogChannels[guild.id] = ch.id;
      saveJSON('boostlog.json', boostLogChannels);
      return interaction.reply({ content: 'Boost log channel set', ephemeral: true });
    }

    // /logjoins
    if (commandName === 'logjoins') {
      const ch = options.getChannel('channel');
      joinLogChannels[guild.id] = ch.id;
      saveJSON('joinlog.json', joinLogChannels);
      return interaction.reply({ content: 'Join log channel set', ephemeral: true });
    }

    // /logleaves
    if (commandName === 'logleaves') {
      const ch = options.getChannel('channel');
      leaveLogChannels[guild.id] = ch.id;
      saveJSON('leavelog.json', leaveLogChannels);
      return interaction.reply({ content: 'Leave log channel set', ephemeral: true });
    }

    // /active
    if (commandName === 'active') {
      const ch = options.getChannel('channel');
      activeChannels[guild.id] = ch.id;
      saveJSON('activechannels.json', activeChannels);
      return interaction.reply({ content: 'Active message channel set', ephemeral: true });
    }

    // /logs
    if (commandName === 'logs') {
      const ch = options.getChannel('channel');
      logChannels[guild.id] = ch.id;
      saveJSON('logchannels.json', logChannels);
      return interaction.reply({ content: 'Deleted message log channel set', ephemeral: true });
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
