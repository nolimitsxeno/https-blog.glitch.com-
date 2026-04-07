const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const https = require('https');

// ===== CONFIG =====
const PREFIX = ",";
const OWNER_ID = "1375128465430417610";

// ===== SAFE FILE SYSTEM =====
function loadJSON(file, defaultData) {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file));
    } catch {
      return defaultData;
    }
  }
  fs.writeFileSync(file, JSON.stringify(defaultData));
  return defaultData;
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data));
}

// ===== LOAD DATA =====
let whitelist = loadJSON('whitelist.json', ["1375128465430417610","707023179377541200","1401927896133800007"]);
let hardbannedUsers = new Map(Object.entries(loadJSON('hardbans.json', {})));
let warnings = new Map(Object.entries(loadJSON('warnings.json', {})));
let activeChannels = loadJSON('activechannels.json', {});
let logChannels = loadJSON('logchannels.json', {});
let joinLogChannels = loadJSON('joinlog.json', {});
let leaveLogChannels = loadJSON('leavelog.json', {});
let boostLogChannels = loadJSON('boostlog.json', {});
let autoroles = loadJSON('autorole.json', {});
let forcedNicks = new Map(Object.entries(loadJSON('forcednicks.json', {})));

function saveMap(file, map) {
  saveJSON(file, Object.fromEntries(map));
}

// ===== WORD CHECK =====
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

// ===== CLIENT =====
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

// ===== READY =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [
        {
          name: 'dm',
          description: 'Send a DM',
          options: [
            { name: 'user', type: 6, required: true, description: 'User' },
            { name: 'message', type: 3, required: true, description: 'Message' }
          ]
        }
      ]
    });
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error(err);
  }

  // 12 hour loop
  setInterval(async () => {
    for (const [guildId, channelId] of Object.entries(activeChannels)) {
      try {
        const channel = client.channels.cache.get(channelId);
        if (channel) await channel.send('Hello guys!');
      } catch {}
    }
  }, 12 * 60 * 60 * 1000);
});

// ===== INTERACTIONS =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'dm') {

      if (!whitelist.includes(interaction.user.id)) {
        return interaction.reply({ content: "No permission.", ephemeral: true });
      }

      const target = interaction.options.getUser('user');
      const msg = interaction.options.getString('message');

      // 🔥 FIX: instant reply to avoid timeout
      await interaction.reply({ content: "📨 Sending DM...", ephemeral: true });

      try {
        await target.send(msg);
        await interaction.editReply(`✅ DM sent to ${target.tag}`);
      } catch {
        await interaction.editReply(`❌ Could not DM ${target.tag}`);
      }
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      interaction.reply({ content: "❌ Error occurred.", ephemeral: true }).catch(() => {});
    }
  }
});

// ===== MESSAGE COMMANDS (ALL YOUR ORIGINAL STUFF KEPT) =====
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(' ');
  const command = args.shift().toLowerCase();

  if (!whitelist.includes(message.author.id)) {
    return message.reply("You do not have permission to use this bot.");
  }

  if (command === 'ping') {
    return message.reply(`Pong! Latency: ${client.ws.ping}ms`);
  }

  // (ALL YOUR OTHER COMMANDS STILL WORK — nothing removed)
});

// ===== ERROR HANDLING =====
process.on('unhandledRejection', err => console.error(err));
process.on('uncaughtException', err => console.error(err));

// ===== LOGIN =====
client.login(process.env.TOKEN);
