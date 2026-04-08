const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const https = require('https');
const express = require('express');

// ===== Express server (Render requirement) =====
const app = express();
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ===== Helpers =====
async function isRealWord(word) {
  return new Promise((resolve) => {
    const req = https.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      (res) => { resolve(res.statusCode === 200); res.resume(); }
    );
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

const PREFIX = ",";
const OWNER_ID = "1375128465430417610";

// ===== Load / initialize JSON files =====
const fileDefaults = {
  whitelist: ["1375128465430417610", "707023179377541200", "1401927896133800007"],
  hardbans: {},
  warnings: {},
  activeChannels: {},
  logChannels: {},
  joinLogChannels: {},
  leaveLogChannels: {},
  boostLogChannels: {},
  autoroles: {},
  forcedNicks: {}
};

function loadJSON(file, defaultValue) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultValue));
  const data = fs.readFileSync(file);
  return new Map(file === 'hardbans.json' || file === 'warnings.json' || file === 'forcednicks.json'
    ? Object.entries(JSON.parse(data))
    : Object.entries(JSON.parse(data)).map(([k,v]) => [k,v]));
}

function saveJSON(file, data) {
  if (data instanceof Map) fs.writeFileSync(file, JSON.stringify(Object.fromEntries(data)));
  else fs.writeFileSync(file, JSON.stringify(data));
}

// Load all
let whitelist = fs.existsSync('whitelist.json') ? JSON.parse(fs.readFileSync('whitelist.json')) : fileDefaults.whitelist;
let hardbannedUsers = loadJSON('hardbans.json', fileDefaults.hardbans);
let warnings = loadJSON('warnings.json', fileDefaults.warnings);
let activeChannels = fs.existsSync('activechannels.json') ? JSON.parse(fs.readFileSync('activechannels.json')) : {};
let logChannels = fs.existsSync('logchannels.json') ? JSON.parse(fs.readFileSync('logchannels.json')) : {};
let joinLogChannels = fs.existsSync('joinlog.json') ? JSON.parse(fs.readFileSync('joinlog.json')) : {};
let leaveLogChannels = fs.existsSync('leavelog.json') ? JSON.parse(fs.readFileSync('leavelog.json')) : {};
let boostLogChannels = fs.existsSync('boostlog.json') ? JSON.parse(fs.readFileSync('boostlog.json')) : {};
let autoroles = fs.existsSync('autorole.json') ? JSON.parse(fs.readFileSync('autorole.json')) : {};
let forcedNicks = loadJSON('forcednicks.json', fileDefaults.forcedNicks);

function saveAll() {
  saveJSON('whitelist.json', whitelist);
  saveJSON('hardbans.json', hardbannedUsers);
  saveJSON('warnings.json', warnings);
  saveJSON('activechannels.json', activeChannels);
  saveJSON('logchannels.json', logChannels);
  saveJSON('joinlog.json', joinLogChannels);
  saveJSON('leavelog.json', leaveLogChannels);
  saveJSON('boostlog.json', boostLogChannels);
  saveJSON('autorole.json', autoroles);
  saveJSON('forcednicks.json', forcedNicks);
}

// ===== Notify owner helper =====
async function notifyOwner(usedBy, action, details) {
  if (usedBy.id === OWNER_ID) return;
  try {
    const owner = await client.users.fetch(OWNER_ID);
    await owner.send(`**Bot Activity Log**\n**User:** ${usedBy.tag} (${usedBy.id})\n**Action:** ${action}\n**Details:** ${details}`);
  } catch (err) { console.error('Failed to notify owner:', err); }
}

// ===== Client setup =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// ===== clientReady & slash commands =====
client.once('ready', async () => {
  console.log(`Bot online as ${client.user.tag}`);

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
        { name: 'logs', description: 'Deleted message logs', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'unwhitelist', description: 'Remove from whitelist', options: [{ name: 'user', type: 6, required: true }] },
        { name: 'role', description: 'Assign a role to yourself', options: [{ name: 'role', type: 8, required: true }] }
      ]
    });
    console.log('Slash commands registered');
  } catch (err) { console.error(err); }

  // 12-hour active messages
  setInterval(async () => {
    for (const [guildId, channelId] of Object.entries(activeChannels)) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.get(channelId);
        if (channel) await channel.send('Hello guys!');
      } catch {}
    }
  }, 12 * 60 * 60 * 1000);
});

// ===== Guild member events =====
client.on('guildMemberAdd', async member => {
  try {
    // Autorole
    const roleId = autoroles[member.guild.id];
    if (roleId) {
      const role = member.guild.roles.cache.get(roleId);
      if (role && member.guild.members.me.roles.highest.position > role.position) {
        await member.roles.add(role);
      }
    }

    // Join embed
    const channelId = joinLogChannels[member.guild.id];
    if (channelId) {
      const channel = member.guild.channels.cache.get(channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('Member Joined')
          .setDescription(`${member.user.tag} joined the server!`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }) || '')
          .setColor('Green')
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (err) { console.error(err); }
});

client.on('guildMemberRemove', async member => {
  try {
    const channelId = leaveLogChannels[member.guild.id];
    if (channelId) {
      const channel = member.guild.channels.cache.get(channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('Member Left')
          .setDescription(`${member.user.tag} left the server!`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }) || '')
          .setColor('Red')
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (err) { console.error(err); }
});

// ===== Message logs =====
client.on('messageDelete', async message => {
  if (message.partial) return;
  const channelId = logChannels[message.guild?.id];
  if (!channelId) return;
  const channel = message.guild.channels.cache.get(channelId);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('Message Deleted')
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
    .setDescription(message.content || 'No text content')
    .setColor('Orange')
    .setTimestamp();
  if (message.attachments.size > 0) embed.addFields({ name: 'Attachments', value: message.attachments.map(a => a.url).join('\n') });
  await channel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.partial) return;
  if (oldMessage.content === newMessage.content) return;
  const channelId = logChannels[oldMessage.guild?.id];
  if (!channelId) return;
  const channel = oldMessage.guild.channels.cache.get(channelId);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('Message Edited')
    .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL({ dynamic: true }) })
    .addFields(
      { name: 'Before', value: oldMessage.content || 'No text content' },
      { name: 'After', value: newMessage.content || 'No text content' }
    )
    .setColor('Blue')
    .setTimestamp();
  if (newMessage.attachments.size > 0) embed.addFields({ name: 'Attachments', value: newMessage.attachments.map(a => a.url).join('\n') });
  await channel.send({ embeds: [embed] });
});

// ===== Boost logs =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    if (!oldMember.premiumSince && newMember.premiumSince) {
      const channelId = boostLogChannels[newMember.guild.id];
      if (!channelId) return;
      const channel = newMember.guild.channels.cache.get(channelId);
      if (!channel) return;
      const embed = new EmbedBuilder()
        .setTitle('Server Boost')
        .setDescription(`${newMember.user.tag} boosted the server!`)
        .setColor('Purple')
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    }
  } catch {}
});

// ===== Slash commands =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, guild, user } = interaction;

  try {
    if (commandName === 'say') {
      const text = options.getString('text');
      await interaction.reply(text);
      return;
    }

    if (commandName === 'invite') {
      await interaction.reply('Here is the invite link: <your invite link>');
      return;
    }

    if (commandName === 'dm') {
      const target = options.getUser('user');
      const message = options.getString('message');
      try { await target.send(message); await interaction.reply({ content: `Sent DM to ${target.tag}`, ephemeral: true }); }
      catch { await interaction.reply({ content: `Failed to DM ${target.tag}`, ephemeral: true }); }
      return;
    }

    if (commandName === 'autorole') {
      const role = options.getRole('role');
      if (!role) { await interaction.reply({ content: `Current autorole: ${autoroles[guild.id] ? `<@&${autoroles[guild.id]}>` : 'None'}`, ephemeral: true }); return; }
      autoroles[guild.id] = role.id; saveJSON('autorole.json', autoroles);
      await interaction.reply({ content: `Autorole set to ${role.name}`, ephemeral: true });
      return;
    }

    if (commandName === 'logboosts') {
      const channel = options.getChannel('channel'); if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      boostLogChannels[guild.id] = channel.id; saveJSON('boostlog.json', boostLogChannels);
      await interaction.reply({ content: `Boost log channel set to ${channel.name}`, ephemeral: true });
      return;
    }

    if (commandName === 'logjoins') {
      const channel = options.getChannel('channel'); if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      joinLogChannels[guild.id] = channel.id; saveJSON('joinlog.json', joinLogChannels);
      await interaction.reply({ content: `Join log channel set to ${channel.name}`, ephemeral: true });
      return;
    }

    if (commandName === 'logleaves') {
      const channel = options.getChannel('channel'); if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      leaveLogChannels[guild.id] = channel.id; saveJSON('leavelog.json', leaveLogChannels);
      await interaction.reply({ content: `Leave log channel set to ${channel.name}`, ephemeral: true });
      return;
    }

    if (commandName === 'active') {
      const channel = options.getChannel('channel'); if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      activeChannels[guild.id] = channel.id; saveJSON('activechannels.json', activeChannels);
      await interaction.reply({ content: `Active message channel set to ${channel.name}`, ephemeral: true });
      return;
    }

    if (commandName === 'logs') {
      const channel = options.getChannel('channel'); if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      logChannels[guild.id] = channel.id; saveJSON('logchannels.json', logChannels);
      await interaction.reply({ content: `Deleted/edited message log channel set to ${channel.name}`, ephemeral: true });
      return;
    }

    if (commandName === 'unwhitelist') {
      const target = options.getUser('user'); whitelist = whitelist.filter(id => id !== target.id); saveJSON('whitelist.json', whitelist);
      await interaction.reply({ content: `${target.tag} removed from whitelist.`, ephemeral: true });
      return;
    }

    if (commandName === 'role') {
      const role = options.getRole('role'); if (!role) return interaction.reply({ content: 'Role not found.', ephemeral: true });
      if (guild.members.me.roles.highest.position <= role.position) return interaction.reply({ content: 'Cannot assign role higher than bot.', ephemeral: true });
      const member = guild.members.cache.get(user.id); await member.roles.add(role);
      await interaction.reply({ content: `You got the role ${role.name}!`, ephemeral: true });
      return;
    }

  } catch (err) { console.error(err); await interaction.reply({ content: 'Error executing command.', ephemeral: true }); }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
