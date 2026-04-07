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

// ===== JSON helpers =====
const loadJSON = (file, defaultValue = {}) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : defaultValue;
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ===== Load data =====
let whitelist = loadJSON('whitelist.json', [OWNER_ID]);
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

// ===== Ready event =====
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [
        { name: 'say', description: 'Make the bot send a message', options: [{ name: 'text', type: 3, description: 'Text to send', required: true }] },
        { name: 'invite', description: 'Get the bot invite link' },
        { name: 'dm', description: 'DM a user', options: [{ name: 'user', type: 6, required: true }, { name: 'message', type: 3, required: true }] },
        { name: 'autorole', description: 'Set autorole', options: [{ name: 'role', type: 8, required: false }] },
        { name: 'logboosts', description: 'Set boost log channel', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'logjoins', description: 'Set join log channel', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'logleaves', description: 'Set leave log channel', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'active', description: 'Auto message channel', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'logs', description: 'Deleted/edited message logs', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'unwhitelist', description: 'Remove from whitelist', options: [{ name: 'user', type: 6, required: true }] }
      ]
    });
    console.log('Slash commands registered');
  } catch (err) { console.error(err); }

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

// ===== Guild member events =====
client.on('guildMemberAdd', async member => {
  try {
    // Autorole
    const roleId = autoroles[member.guild.id];
    if (roleId) {
      const role = await member.guild.roles.fetch(roleId);
      const botMember = await member.guild.members.fetch(client.user.id);
      if (role && role.position < botMember.roles.highest.position) {
        await member.roles.add(role).catch(console.error);
      }
    }

    // Join embed
    const channelId = joinLogChannels[member.guild.id];
    if (channelId) {
      const channel = await member.guild.channels.fetch(channelId);
      if (!channel) return;
      const embed = new EmbedBuilder()
        .setTitle('Member Joined')
        .setColor('Green')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User', value: `${member.user.tag} (${member.id})` },
          { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
        )
        .setTimestamp();
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) { console.error('guildMemberAdd error:', err); }
});

client.on('guildMemberRemove', async member => {
  try {
    const channelId = leaveLogChannels[member.guild.id];
    if (!channelId) return;
    const channel = await member.guild.channels.fetch(channelId);
    if (channel) channel.send(`${member.user.tag} has left the server.`).catch(() => {});
  } catch (err) { console.error('guildMemberRemove error:', err); }
});

// ===== Boost logging =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const channelId = boostLogChannels[newMember.guild.id];
    if (!channelId) return;
    const channel = await newMember.guild.channels.fetch(channelId);
    if (!channel) return;

    if (!oldMember.premiumSince && newMember.premiumSince) {
      channel.send(`🚀 ${newMember.user.tag} boosted the server!`).catch(() => {});
    } else if (oldMember.premiumSince && !newMember.premiumSince) {
      channel.send(`❌ ${newMember.user.tag} stopped boosting.`).catch(() => {});
    }
  } catch (err) { console.error('Boost logging error:', err); }
});

// ===== Message logging =====
client.on('messageDelete', async message => handleMessageLog('deleted', message));
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (oldMsg.content !== newMsg.content) handleMessageLog('edited', oldMsg, newMsg);
});

async function handleMessageLog(type, oldMsg, newMsg = null) {
  try {
    const guild = oldMsg.guild;
    if (!guild) return;
    const channelId = logChannels[guild.id];
    if (!channelId) return;
    const channel = await guild.channels.fetch(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(type === 'deleted' ? 'Red' : 'Orange')
      .setAuthor({ name: oldMsg.author?.tag || 'Unknown', iconURL: oldMsg.author?.displayAvatarURL() })
      .setTimestamp()
      .setFooter({ text: type === 'deleted' ? 'Message Deleted' : 'Message Edited' });

    if (type === 'deleted') {
      embed.addFields(
        { name: 'Content', value: oldMsg.content || 'No text' }
      );
      if (oldMsg.attachments.size > 0) embed.addFields({ name: 'Attachments', value: oldMsg.attachments.map(a => a.url).join('\n') });
    } else if (type === 'edited') {
      embed.addFields(
        { name: 'Before', value: oldMsg.content || 'No text' },
        { name: 'After', value: newMsg.content || 'No text' }
      );
      if (newMsg.attachments.size > 0) embed.addFields({ name: 'Attachments', value: newMsg.attachments.map(a => a.url).join('\n') });
    }

    channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) { console.error('handleMessageLog error:', err); }
}

// ===== Slash command handler =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, guild, user } = interaction;

  try {
    if (commandName === 'say') {
      const text = options.getString('text');
      await interaction.reply({ content: text }).catch(() => {});
    }

    if (commandName === 'invite') {
      await interaction.reply({ content: 'Invite link here' }).catch(() => {});
    }

    if (commandName === 'dm') {
      const target = options.getUser('user');
      const message = options.getString('message');
      try { await target.send(message); await interaction.reply({ content: `✅ DM sent to ${target.tag}`, ephemeral: true }); }
      catch { await interaction.reply({ content: `❌ Failed to DM ${target.tag}`, ephemeral: true }); }
    }

    if (commandName === 'autorole') {
      const role = options.getRole('role');
      if (!role) return interaction.reply({ content: 'You must select a role!', ephemeral: true });
      const botMember = await guild.members.fetch(client.user.id);
      if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) return interaction.reply({ content: 'I need Manage Roles permission!', ephemeral: true });
      if (role.position >= botMember.roles.highest.position) return interaction.reply({ content: 'I cannot assign this role.', ephemeral: true });
      autoroles[guild.id] = role.id;
      saveJSON('autorole.json', autoroles);
      await interaction.reply({ content: `Autorole set to ${role.name}`, ephemeral: true });
    }

    if (['logboosts','logjoins','logleaves','active','logs'].includes(commandName)) {
      const ch = options.getChannel('channel');
      if (!ch) return interaction.reply({ content: 'You must select a channel!', ephemeral: true });
      if (commandName === 'logboosts') { boostLogChannels[guild.id] = ch.id; saveJSON('boostlog.json', boostLogChannels); }
      if (commandName === 'logjoins') { joinLogChannels[guild.id] = ch.id; saveJSON('joinlog.json', joinLogChannels); }
      if (commandName === 'logleaves') { leaveLogChannels[guild.id] = ch.id; saveJSON('leavelog.json', leaveLogChannels); }
      if (commandName === 'active') { activeChannels[guild.id] = ch.id; saveJSON('activechannels.json', activeChannels); }
      if (commandName === 'logs') { logChannels[guild.id] = ch.id; saveJSON('logchannels.json', logChannels); }
      await interaction.reply({ content: `Channel set for ${commandName}`, ephemeral: true });
    }

    if (commandName === 'unwhitelist') {
      const target = options.getUser('user');
      whitelist = whitelist.filter(id => id !== target.id);
      saveJSON('whitelist.json', whitelist);
      await interaction.reply({ content: `${target.tag} removed from whitelist.`, ephemeral: true });
    }

  } catch (err) { console.error('Slash command error:', err); if (!interaction.replied) await interaction.reply({ content: 'Error running command.', ephemeral: true }); }
});

// ===== Prefix commands handler =====
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(',')) return;

  const args = message.content.slice(1).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  if (cmd === 'whitelist') {
    if (message.author.id !== OWNER_ID) return message.reply('You cannot use this command.');
    const userId = args[0];
    if (!userId) return message.reply('Please provide a user ID.');
    if (!/^\d+$/.test(userId)) return message.reply('Invalid user ID.');
    if (whitelist.includes(userId)) return message.reply('User is already whitelisted.');
    whitelist.push(userId);
    saveJSON('whitelist.json', whitelist);
    message.reply(`User ${userId} has been whitelisted.`);
  }

  if (cmd === 'unwhitelist') {
    if (message.author.id !== OWNER_ID) return message.reply('You cannot use this command.');
    const userId = args[0];
    if (!userId) return message.reply('Please provide a user ID.');
    whitelist = whitelist.filter(id => id !== userId);
    saveJSON('whitelist.json', whitelist);
    message.reply(`User ${userId} has been removed from the whitelist.`);
  }
});

// ===== Login =====
client.login(process.env.TOKEN);
