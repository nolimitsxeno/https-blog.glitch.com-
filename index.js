const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http');
const https = require('https');

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

// ===== Bot presence settings =====
let botStatus = 'online';
let startTime = Date.now();

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

// ===== Keep-alive web server =====
const PORT = process.env.PORT || 5000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is alive!');
}).listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ===== DM LOGGER =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.guild) return;

  try {
    const owner = await client.users.fetch(OWNER_ID);

    let text =
      `**Bot DM Received**\n` +
      `**From:** ${message.author.tag} (${message.author.id})\n` +
      `**Message:** ${message.content || '*No text content*'}`;

    if (message.attachments.size > 0) {
      text += `\n\n**Attachments:**`;
      message.attachments.forEach(att => {
        text += `\n${att.name || 'file'}: ${att.url}`;
      });
    }

    if (message.stickers.size > 0) {
      text += `\n\n**Stickers:**`;
      message.stickers.forEach(sticker => {
        text += `\n${sticker.name}`;
      });
    }

    if (message.embeds.length > 0) {
      text += `\n\n**Embeds:** ${message.embeds.length}`;
      message.embeds.forEach((embed, index) => {
        if (embed.title) text += `\nEmbed ${index + 1} title: ${embed.title}`;
        if (embed.description) text += `\nEmbed ${index + 1} description: ${embed.description}`;
        if (embed.url) text += `\nEmbed ${index + 1} url: ${embed.url}`;
        if (embed.image?.url) text += `\nEmbed ${index + 1} image: ${embed.image.url}`;
        if (embed.thumbnail?.url) text += `\nEmbed ${index + 1} thumbnail: ${embed.thumbnail.url}`;
      });
    }

    await owner.send(text);
  } catch (err) {
    console.error('Failed to forward bot DM:', err);
  }
});

// ===== CHANGED PART ONLY =====
function updatePresence() {
  if (!client.user) return;

  const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(totalSeconds / 3600);

  // ONLY HOURS NOW
  let text = `Monitoring servers for ${hours}h`;

  client.user.setPresence({
    activities: [{
      name: text,
      type: 3
    }],
    status: botStatus
  });
}

// ===== Load hardbans =====
let hardbannedUsers = new Map();
if (fs.existsSync('hardbans.json')) {
  const data = JSON.parse(fs.readFileSync('hardbans.json'));
  hardbannedUsers = new Map(Object.entries(data));
}

function saveHardbans() {
  fs.writeFileSync('hardbans.json', JSON.stringify(Object.fromEntries(hardbannedUsers)));
}

// ===== Load warnings =====
let warnings = new Map();
if (fs.existsSync('warnings.json')) {
  const data = JSON.parse(fs.readFileSync('warnings.json'));
  warnings = new Map(Object.entries(data));
}

function saveWarnings() {
  fs.writeFileSync('warnings.json', JSON.stringify(Object.fromEntries(warnings)));
}

// ===== Load active channels =====
let activeChannels = {};
if (fs.existsSync('activechannels.json')) {
  activeChannels = JSON.parse(fs.readFileSync('activechannels.json'));
}

function saveActiveChannels() {
  fs.writeFileSync('activechannels.json', JSON.stringify(activeChannels));
}

// ===== Load log channels =====
let logChannels = {};
if (fs.existsSync('logchannels.json')) {
  logChannels = JSON.parse(fs.readFileSync('logchannels.json'));
}

function saveLogChannels() {
  fs.writeFileSync('logchannels.json', JSON.stringify(logChannels));
}

// ===== Load join/leave log channels =====
let joinLogChannels = {};
if (fs.existsSync('joinlog.json')) joinLogChannels = JSON.parse(fs.readFileSync('joinlog.json'));
function saveJoinLog() { fs.writeFileSync('joinlog.json', JSON.stringify(joinLogChannels)); }

let leaveLogChannels = {};
if (fs.existsSync('leavelog.json')) leaveLogChannels = JSON.parse(fs.readFileSync('leavelog.json'));
function saveLeaveLog() { fs.writeFileSync('leavelog.json', JSON.stringify(leaveLogChannels)); }

// ===== Load boost log channels =====
let boostLogChannels = {};
if (fs.existsSync('boostlog.json')) boostLogChannels = JSON.parse(fs.readFileSync('boostlog.json'));
function saveBoostLog() { fs.writeFileSync('boostlog.json', JSON.stringify(boostLogChannels)); }

// ===== Load autoroles =====
let autoroles = {};
if (fs.existsSync('autorole.json')) {
  autoroles = JSON.parse(fs.readFileSync('autorole.json'));
}

function saveAutoroles() {
  fs.writeFileSync('autorole.json', JSON.stringify(autoroles));
}

// ===== Load forced nicknames =====
let forcedNicks = new Map();
if (fs.existsSync('forcednicks.json')) {
  const data = JSON.parse(fs.readFileSync('forcednicks.json'));
  forcedNicks = new Map(Object.entries(data));
}

function saveForcedNicks() {
  fs.writeFileSync('forcednicks.json', JSON.stringify(Object.fromEntries(forcedNicks)));
}

// ===== Blacktea active games =====
const activeGames = new Map();

// ===== Notify Owner Helper =====
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

// ===== Ready & Register Slash Commands =====
client.once('ready', async () => {
  updatePresence();

  setInterval(() => {
    updatePresence();
  }, 15000);

  console.log(`Bot is online as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [
        {
          name: 'say',
          description: 'Make the bot send a message',
          options: [{
            name: 'text',
            description: 'The text to send',
            type: 3,
            required: true
          }]
        },
        {
          name: 'invite',
          description: 'Get the bot invite link'
        },
        {
          name: 'autorole',
          description: 'Set a role to auto-assign when someone joins',
          options: [
            {
              name: 'role',
              description: 'The role to assign on join (leave empty to disable)',
              type: 8,
              required: false
            }
          ]
        },
        {
          name: 'logboosts',
          description: 'Set the channel to log server boosts (owner only)',
          options: [{ name: 'channel', description: 'Channel to log boosts (leave empty to disable)', type: 7, required: false }]
        },
        {
          name: 'logjoins',
          description: 'Set the channel to log member joins (owner only)',
          options: [{ name: 'channel', description: 'Channel to log joins (leave empty to disable)', type: 7, required: false }]
        },
        {
          name: 'logleaves',
          description: 'Set the channel to log member leaves (owner only)',
          options: [{ name: 'channel', description: 'Channel to log leaves (leave empty to disable)', type: 7, required: false }]
        },
        {
          name: 'active',
          description: 'Set a channel for the bot to say Hello guys! every 12 hours',
          options: [
            {
              name: 'channel',
              description: 'The channel to send the message in (leave empty to disable)',
              type: 7,
              required: false
            }
          ]
        },
        {
          name: 'logs',
          description: 'Set the channel for deleted message logs (owner only)',
          options: [
            {
              name: 'channel',
              description: 'The channel to send logs to (leave empty to disable)',
              type: 7,
              required: false
            }
          ]
        },
        {
          name: 'unwhitelist',
          description: 'Remove a user from the bot whitelist (owner only)',
          options: [
            {
              name: 'user',
              description: 'The user to remove from the whitelist',
              type: 6,
              required: true
            }
          ]
        },
        {
          name: 'dm',
          description: 'Send a DM to a user as the bot',
          options: [
            {
              name: 'user',
              description: 'The user to DM',
              type: 6,
              required: true
            },
            {
              name: 'message',
              description: 'The message to send',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'dstatus',
          description: 'Change the bot online status',
          options: [
            {
              name: 'status',
              description: 'Choose the bot status',
              type: 3,
              required: true,
              choices: [
                { name: 'Online', value: 'online' },
                { name: 'Idle', value: 'idle' },
                { name: 'Do Not Disturb', value: 'dnd' },
                { name: 'Invisible', value: 'invisible' }
              ]
            }
          ]
        }
      ]
    });
    console.log('Slash commands registered');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }

  setInterval(async () => {
    for (const [guildId, channelId] of Object.entries(activeChannels)) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.get(channelId);
        if (channel) await channel.send('Hello guys!');
      } catch (err) {
        console.error(`Auto-message failed for guild ${guildId}:`, err.message);
      }
    }
  }, 12 * 60 * 60 * 1000);
});

// (rest of your code unchanged below)
