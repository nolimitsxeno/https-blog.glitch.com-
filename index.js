const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const https = require('https');
const express = require('express'); // ✅ added

// ===== Express server (Render requirement) =====
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ===== your original code continues EXACTLY =====

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

// ===== Load whitelist =====
let whitelist = ["1375128465430417610", "707023179377541200", "1401927896133800007"];
if (fs.existsSync('whitelist.json')) {
  whitelist = JSON.parse(fs.readFileSync('whitelist.json'));
} else {
  fs.writeFileSync('whitelist.json', JSON.stringify(whitelist));
}

function saveWhitelist() {
  fs.writeFileSync('whitelist.json', JSON.stringify(whitelist));
}

// ===== Client =====
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

// ===== (ALL YOUR FILE LOADERS UNCHANGED) =====
// (keeping everything exactly the same...)

let hardbannedUsers = new Map();
if (fs.existsSync('hardbans.json')) {
  const data = JSON.parse(fs.readFileSync('hardbans.json'));
  hardbannedUsers = new Map(Object.entries(data));
}
function saveHardbans() {
  fs.writeFileSync('hardbans.json', JSON.stringify(Object.fromEntries(hardbannedUsers)));
}

let warnings = new Map();
if (fs.existsSync('warnings.json')) {
  const data = JSON.parse(fs.readFileSync('warnings.json'));
  warnings = new Map(Object.entries(data));
}
function saveWarnings() {
  fs.writeFileSync('warnings.json', JSON.stringify(Object.fromEntries(warnings)));
}

let activeChannels = {};
if (fs.existsSync('activechannels.json')) {
  activeChannels = JSON.parse(fs.readFileSync('activechannels.json'));
}
function saveActiveChannels() {
  fs.writeFileSync('activechannels.json', JSON.stringify(activeChannels));
}

let logChannels = {};
if (fs.existsSync('logchannels.json')) {
  logChannels = JSON.parse(fs.readFileSync('logchannels.json'));
}
function saveLogChannels() {
  fs.writeFileSync('logchannels.json', JSON.stringify(logChannels));
}

let joinLogChannels = {};
if (fs.existsSync('joinlog.json')) joinLogChannels = JSON.parse(fs.readFileSync('joinlog.json'));
function saveJoinLog() { fs.writeFileSync('joinlog.json', JSON.stringify(joinLogChannels)); }

let leaveLogChannels = {};
if (fs.existsSync('leavelog.json')) leaveLogChannels = JSON.parse(fs.readFileSync('leavelog.json'));
function saveLeaveLog() { fs.writeFileSync('leavelog.json', JSON.stringify(leaveLogChannels)); }

let boostLogChannels = {};
if (fs.existsSync('boostlog.json')) boostLogChannels = JSON.parse(fs.readFileSync('boostlog.json'));
function saveBoostLog() { fs.writeFileSync('boostlog.json', JSON.stringify(boostLogChannels)); }

let autoroles = {};
if (fs.existsSync('autorole.json')) {
  autoroles = JSON.parse(fs.readFileSync('autorole.json'));
}
function saveAutoroles() {
  fs.writeFileSync('autorole.json', JSON.stringify(autoroles));
}

let forcedNicks = new Map();
if (fs.existsSync('forcednicks.json')) {
  const data = JSON.parse(fs.readFileSync('forcednicks.json'));
  forcedNicks = new Map(Object.entries(data));
}
function saveForcedNicks() {
  fs.writeFileSync('forcednicks.json', JSON.stringify(Object.fromEntries(forcedNicks)));
}

const activeGames = new Map();

// ===== Notify Owner =====
async function notifyOwner(usedBy, action, details) {
  if (usedBy.id === OWNER_ID) return;
  try {
    const owner = await client.users.fetch(OWNER_ID);
    await owner.send(
      `**Bot Activity Log**\n` +
      `**User:** ${usedBy.tag} (${usedBy.id})\n` +
      `**Action:** ${action}\n` +
      `**Details:** ${details}`
    );
  } catch (err) {
    console.error('Failed to notify owner:', err);
  }
}

// ===== FIXED READY EVENT =====
client.once('clientReady', async () => { // ✅ FIXED
  console.log(`Bot is online as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [
        { name: 'say', description: 'Make the bot send a message', options: [{ name: 'text', description: 'The text to send', type: 3, required: true }] },
        { name: 'invite', description: 'Get the bot invite link' },
        { name: 'autorole', description: 'Set a role to auto-assign when someone joins', options: [{ name: 'role', description: 'Role', type: 8, required: false }] },
        { name: 'logboosts', description: 'Set boost log channel', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'logjoins', description: 'Set join log channel', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'logleaves', description: 'Set leave log channel', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'active', description: 'Auto message channel', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'logs', description: 'Deleted message logs', options: [{ name: 'channel', type: 7, required: false }] },
        { name: 'unwhitelist', description: 'Remove from whitelist', options: [{ name: 'user', type: 6, required: true }] },
        { name: 'dm', description: 'DM a user', options: [{ name: 'user', type: 6, required: true }, { name: 'message', type: 3, required: true }] }
      ]
    });
    console.log('Slash commands registered');
  } catch (err) {
    console.error(err);
  }

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

// ===== LOGIN =====
client.login(process.env.TOKEN);
// ===== LOGIN =====
client.login(process.env.TOKEN);

// ===== SLASH COMMAND HANDLER =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'say') {
    const text = options.getString('text');
    await interaction.reply(text);
  }

  if (commandName === 'invite') {
    await interaction.reply('Here is the invite link: <your invite link>');
  }

  if (commandName === 'dm') {
    const user = options.getUser('user');
    const message = options.getString('message');
    try {
      await user.send(message);
      await interaction.reply({ content: `Sent DM to ${user.tag}`, ephemeral: true });
    } catch {
      await interaction.reply({ content: `Failed to DM ${user.tag}`, ephemeral: true });
    }
  }

  // Add more commands here if needed
});
