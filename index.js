const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const https = require('https');
const express = require('express'); // ✅ Express for Render

// ===== Express server (Render requirement) =====
const app = express();
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ===== Original helpers and constants =====
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

// ===== Load data files =====
let whitelist = fs.existsSync('whitelist.json') ? JSON.parse(fs.readFileSync('whitelist.json')) : ["1375128465430417610", "707023179377541200", "1401927896133800007"];
function saveWhitelist() { fs.writeFileSync('whitelist.json', JSON.stringify(whitelist)); }

let hardbannedUsers = fs.existsSync('hardbans.json') ? new Map(Object.entries(JSON.parse(fs.readFileSync('hardbans.json')))) : new Map();
function saveHardbans() { fs.writeFileSync('hardbans.json', JSON.stringify(Object.fromEntries(hardbannedUsers))); }

let warnings = fs.existsSync('warnings.json') ? new Map(Object.entries(JSON.parse(fs.readFileSync('warnings.json')))) : new Map();
function saveWarnings() { fs.writeFileSync('warnings.json', JSON.stringify(Object.fromEntries(warnings))); }

let activeChannels = fs.existsSync('activechannels.json') ? JSON.parse(fs.readFileSync('activechannels.json')) : {};
function saveActiveChannels() { fs.writeFileSync('activechannels.json', JSON.stringify(activeChannels)); }

let logChannels = fs.existsSync('logchannels.json') ? JSON.parse(fs.readFileSync('logchannels.json')) : {};
function saveLogChannels() { fs.writeFileSync('logchannels.json', JSON.stringify(logChannels)); }

let joinLogChannels = fs.existsSync('joinlog.json') ? JSON.parse(fs.readFileSync('joinlog.json')) : {};
function saveJoinLog() { fs.writeFileSync('joinlog.json', JSON.stringify(joinLogChannels)); }

let leaveLogChannels = fs.existsSync('leavelog.json') ? JSON.parse(fs.readFileSync('leavelog.json')) : {};
function saveLeaveLog() { fs.writeFileSync('leavelog.json', JSON.stringify(leaveLogChannels)); }

let boostLogChannels = fs.existsSync('boostlog.json') ? JSON.parse(fs.readFileSync('boostlog.json')) : {};
function saveBoostLog() { fs.writeFileSync('boostlog.json', JSON.stringify(boostLogChannels)); }

let autoroles = fs.existsSync('autorole.json') ? JSON.parse(fs.readFileSync('autorole.json')) : {};
function saveAutoroles() { fs.writeFileSync('autorole.json', JSON.stringify(autoroles)); }

let forcedNicks = fs.existsSync('forcednicks.json') ? new Map(Object.entries(JSON.parse(fs.readFileSync('forcednicks.json')))) : new Map();
function saveForcedNicks() { fs.writeFileSync('forcednicks.json', JSON.stringify(Object.fromEntries(forcedNicks))); }

const activeGames = new Map();

// ===== Notify Owner helper =====
async function notifyOwner(usedBy, action, details) {
  if (usedBy.id === OWNER_ID) return;
  try {
    const owner = await client.users.fetch(OWNER_ID);
    await owner.send(
      `**Bot Activity Log**\n**User:** ${usedBy.tag} (${usedBy.id})\n**Action:** ${action}\n**Details:** ${details}`
    );
  } catch (err) {
    console.error('Failed to notify owner:', err);
  }
}

// ===== Client setup =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ===== clientReady and slash commands registration =====
client.once('clientReady', async () => {
  console.log(`Bot is online as ${client.user.tag}`);

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
        { name: 'unwhitelist', description: 'Remove from whitelist', options: [{ name: 'user', type: 6, required: true }] }
      ]
    });
    console.log('Slash commands registered');
  } catch (err) { console.error(err); }

  // ===== 2-hour active messages =====
  setInterval(async () => {
    for (const [guildId, channelId] of Object.entries(activeChannels)) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.get(channelId);
        if (channel) await channel.send('Hello guys!');
      } catch {}
    }
  }, 2 * 60 * 60 * 1000); // 2 hours
});

// ===== Guild member events for autoroles and join logging =====
client.on('guildMemberAdd', member => {
  const roleId = autoroles[member.guild.id];
  if (roleId) {
    const role = member.guild.roles.cache.get(roleId);
    if (role) member.roles.add(role).catch(console.error);
  }

  const channelId = joinLogChannels[member.guild.id];
  if (channelId) {
    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('Member Joined')
        .setDescription(`${member.user.tag} has joined the server.`)
        .setColor('Green')
        .setTimestamp();
      channel.send({ embeds: [embed] });
    }
  }
});

client.on('guildMemberRemove', member => {
  const channelId = leaveLogChannels[member.guild.id];
  if (channelId) {
    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('Member Left')
        .setDescription(`${member.user.tag} has left the server.`)
        .setColor('Red')
        .setTimestamp();
      channel.send({ embeds: [embed] });
    }
  }
});

// ===== Slash commands handler =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, guild, user } = interaction;

  try {
    if (commandName === 'say') {
      const text = options.getString('text');
      await interaction.reply(text);
    }

    if (commandName === 'invite') {
      await interaction.reply('Here is the invite link: <your invite link>');
    }

    if (commandName === 'dm') {
      const target = options.getUser('user');
      const message = options.getString('message');
      try {
        await target.send(message);
        await interaction.reply({ content: `Sent DM to ${target.tag}`, ephemeral: true });
      } catch {
        await interaction.reply({ content: `Failed to DM ${target.tag}`, ephemeral: true });
      }
    }

    if (commandName === 'autorole') {
      const role = options.getRole('role');
      if (!role) {
        const current = autoroles[guild.id];
        await interaction.reply({ content: `Current autorole: ${current ? `<@&${current}>` : 'None'}`, ephemeral: true });
      } else {
        autoroles[guild.id] = role.id;
        saveAutoroles();
        await interaction.reply({ content: `Autorole set to ${role.name}`, ephemeral: true });
      }
    }

    if (commandName === 'logboosts') {
      const channel = options.getChannel('channel');
      if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      boostLogChannels[guild.id] = channel.id;
      saveBoostLog();
      await interaction.reply({ content: `Boost log channel set to ${channel.name}`, ephemeral: true });
    }

    if (commandName === 'logjoins') {
      const channel = options.getChannel('channel');
      if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      joinLogChannels[guild.id] = channel.id;
      saveJoinLog();
      await interaction.reply({ content: `Join log channel set to ${channel.name}`, ephemeral: true });
    }

    if (commandName === 'logleaves') {
      const channel = options.getChannel('channel');
      if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      leaveLogChannels[guild.id] = channel.id;
      saveLeaveLog();
      await interaction.reply({ content: `Leave log channel set to ${channel.name}`, ephemeral: true });
    }

    if (commandName === 'active') {
      const channel = options.getChannel('channel');
      if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      activeChannels[guild.id] = channel.id;
      saveActiveChannels();
      await interaction.reply({ content: `Active message channel set to ${channel.name}`, ephemeral: true });
    }

    if (commandName === 'logs') {
      const channel = options.getChannel('channel');
      if (!channel) return interaction.reply({ content: 'Please specify a channel.', ephemeral: true });
      logChannels[guild.id] = channel.id;
      saveLogChannels();
      await interaction.reply({ content: `Deleted message logs channel set to ${channel.name}`, ephemeral: true });
    }

    if (commandName === 'unwhitelist') {
      const target = options.getUser('user');
      whitelist = whitelist.filter(id => id !== target.id);
      saveWhitelist();
      await interaction.reply({ content: `${target.tag} removed from whitelist.`, ephemeral: true });
    }

  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'An error occurred while running the command.', ephemeral: true });
  }
});

// ===== Prefix commands =====
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===== Hardban command =====
  if (command === 'hb') {
    if (!args[0]) return message.reply('Please mention a user or provide their ID.');

    let userId;
    let user;

    if (message.mentions.users.size) {
      user = message.mentions.users.first();
      userId = user.id;
    } else {
      userId = args[0].replace(/[<@!>]/g, '');
      try {
        user = await client.users.fetch(userId);
      } catch {
        return message.reply('Could not find a valid user with that ID.');
      }
    }

    // Add to hardbans JSON
    if (!hardbannedUsers.has(userId)) {
      hardbannedUsers.set(userId, true);
      saveHardbans();
    }

    // Try to ban if user is in the server
    const member = message.guild.members.cache.get(userId);
    if (member) {
      try {
        await member.ban({ reason: 'Hardbanned by bot' });
      } catch {
        // ignore errors
      }
    }

    await message.reply(`User hardbanned ✅`);
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
