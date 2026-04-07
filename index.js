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

// ===== Helper to load/save JSON safely =====
const loadJSON = (file, defaultValue = {}) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : defaultValue;
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ===== Load data =====
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

// ===== Ready event and slash commands registration =====
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands globally
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
      client.guilds.fetch(guildId).then(guild => {
        guild.channels.fetch(channelId).then(channel => {
          if (channel) channel.send('Hello guys!').catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
    }
  }, 12 * 60 * 60 * 1000);
});

// ===== Member join/leave with autorole and logs =====
client.on('guildMemberAdd', async (member) => {
  try {
    // Autorole
    const roleId = autoroles[member.guild.id];
    if (roleId) {
      const role = await member.guild.roles.fetch(roleId);
      const botMember = await member.guild.members.fetch(client.user.id);

      if (role && role.position < botMember.roles.highest.position) {
        await member.roles.add(role);
      } else {
        console.log(`Autorole skipped for ${member.user.tag} (role missing or too high)`);
      }
    }

    // Join log
    const channelId = joinLogChannels[member.guild.id];
    if (channelId) {
      const channel = await member.guild.channels.fetch(channelId);
      if (channel) channel.send(`${member.user.tag} has joined the server!`);
      else console.log(`Join log channel not found for ${member.guild.name}`);
    }
  } catch (err) {
    console.error('Error in guildMemberAdd:', err);
  }
});

client.on('guildMemberRemove', async (member) => {
  try {
    const channelId = leaveLogChannels[member.guild.id];
    if (!channelId) return;
    const channel = await member.guild.channels.fetch(channelId);
    if (channel) channel.send(`${member.user.tag} has left the server!`);
  } catch (err) {
    console.error('Error in guildMemberRemove:', err);
  }
});

// ===== Boost logging =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const channelId = boostLogChannels[newMember.guild.id];
    if (!channelId) return;
    const channel = await newMember.guild.channels.fetch(channelId);
    if (!channel) return;

    if (!oldMember.premiumSince && newMember.premiumSince) {
      channel.send(`🚀 ${newMember.user.tag} boosted the server!`);
    } else if (oldMember.premiumSince && !newMember.premiumSince) {
      channel.send(`❌ ${newMember.user.tag} stopped boosting.`);
    }
  } catch (err) {
    console.error('Error in boost logging:', err);
  }
});

// ===== Deleted message logging =====
client.on('messageDelete', async message => {
  try {
    if (!message.guild) return;
    const channelId = logChannels[message.guild.id];
    if (!channelId) return;

    const channel = await message.guild.channels.fetch(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('Deleted Message')
      .setColor('Red')
      .addFields(
        { name: 'User', value: message.author?.tag || 'Unknown' },
        { name: 'Content', value: message.content || 'No text' }
      );

    channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Error in messageDelete:', err);
  }
});

// ===== Slash command handler =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild } = interaction;

  try {
    if (commandName === 'say') {
      const text = options.getString('text');
      return interaction.reply({ content: text });
    }

    if (commandName === 'invite') {
      return interaction.reply({ content: 'Invite link here' });
    }

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

    if (commandName === 'autorole') {
      const role = options.getRole('role');
      if (!role) return interaction.reply({ content: 'You must select a role!', ephemeral: true });

      const botMember = await guild.members.fetch(client.user.id);
      if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({ content: 'I need Manage Roles permission!', ephemeral: true });
      }
      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: 'I cannot assign a role higher than my highest role.', ephemeral: true });
      }

      autoroles[guild.id] = role.id;
      saveJSON('autorole.json', autoroles);
      return interaction.reply({ content: `Autorole successfully set to ${role.name}`, ephemeral: true });
    }

    if (commandName === 'logboosts') {
      const ch = options.getChannel('channel');
      boostLogChannels[guild.id] = ch.id;
      saveJSON('boostlog.json', boostLogChannels);
      return interaction.reply({ content: 'Boost log channel set', ephemeral: true });
    }

    if (commandName === 'logjoins') {
      const ch = options.getChannel('channel');
      joinLogChannels[guild.id] = ch.id;
      saveJSON('joinlog.json', joinLogChannels);
      return interaction.reply({ content: 'Join log channel set', ephemeral: true });
    }

    if (commandName === 'logleaves') {
      const ch = options.getChannel('channel');
      leaveLogChannels[guild.id] = ch.id;
      saveJSON('leavelog.json', leaveLogChannels);
      return interaction.reply({ content: 'Leave log channel set', ephemeral: true });
    }

    if (commandName === 'active') {
      const ch = options.getChannel('channel');
      activeChannels[guild.id] = ch.id;
      saveJSON('activechannels.json', activeChannels);
      return interaction.reply({ content: 'Active message channel set', ephemeral: true });
    }

    if (commandName === 'logs') {
      const ch = options.getChannel('channel');
      logChannels[guild.id] = ch.id;
      saveJSON('logchannels.json', logChannels);
      return interaction.reply({ content: 'Deleted message log channel set', ephemeral: true });
    }

  } catch (err) {
    console.error('Error in slash command:', err);
    if (!interaction.replied) interaction.reply({ content: 'An error occurred.', ephemeral: true });
  }
});

// ===== Login =====
client.login(process.env.TOKEN);
