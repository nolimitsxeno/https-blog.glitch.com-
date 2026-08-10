const fs = require('fs');
const http = require('http');
const https = require('https');

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  Partials,
  EmbedBuilder
} = require('discord.js');

// =========================
// CONFIGURATION
// =========================

const PREFIX = ',';
const OWNER_ID = '1375128465430417610';

const ROLE_ID = '1482292139500113966';
const LOG_CHANNEL_ID = '1515751091520672035';

// =========================
// BOT STATUS
// =========================

let botStatus = 'online';
const startTime = Date.now();

// =========================
// PERSISTENT DATA HELPERS
// =========================

function loadJson(filename, fallback) {
  try {
    if (!fs.existsSync(filename)) {
      fs.writeFileSync(filename, JSON.stringify(fallback, null, 2));
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    console.error(`Failed to load ${filename}:`, error);
    return fallback;
  }
}

function saveJson(filename, data) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Failed to save ${filename}:`, error);
  }
}

// =========================
// LOAD PERSISTENT DATA
// =========================

let whitelist = loadJson('whitelist.json', []);

let hardbannedUsers = new Map(
  Object.entries(loadJson('hardbans.json', {}))
);

let warnings = new Map(
  Object.entries(loadJson('warnings.json', {}))
);

let activeChannels = loadJson('activechannels.json', {});

let logChannels = loadJson('logchannels.json', {});

let joinLogChannels = loadJson('joinlog.json', {});

let leaveLogChannels = loadJson('leavelog.json', {});

let boostLogChannels = loadJson('boostlog.json', {});

let autoroles = loadJson('autorole.json', {});

let forcedNicks = new Map(
  Object.entries(loadJson('forcednicks.json', {}))
);

// =========================
// SAVE DATA FUNCTIONS
// =========================

function saveWhitelist() {
  saveJson('whitelist.json', whitelist);
}

function saveHardbans() {
  saveJson(
    'hardbans.json',
    Object.fromEntries(hardbannedUsers)
  );
}

function saveWarnings() {
  saveJson(
    'warnings.json',
    Object.fromEntries(warnings)
  );
}

function saveActiveChannels() {
  saveJson('activechannels.json', activeChannels);
}

function saveLogChannels() {
  saveJson('logchannels.json', logChannels);
}

function saveJoinLogs() {
  saveJson('joinlog.json', joinLogChannels);
}

function saveLeaveLogs() {
  saveJson('leavelog.json', leaveLogChannels);
}

function saveBoostLogs() {
  saveJson('boostlog.json', boostLogChannels);
}

function saveAutoroles() {
  saveJson('autorole.json', autoroles);
}

function saveForcedNicks() {
  saveJson(
    'forcednicks.json',
    Object.fromEntries(forcedNicks)
  );
}

// =========================
// BLACKTEA / GIVEAWAY REMOVED
// =========================
//
// No Blacktea game.
// No giveaway system.
// =========================

// =========================
// RENDER KEEP-ALIVE SERVER
// =========================

const PORT = process.env.PORT || 5000;

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain'
  });

  res.end('Bot is alive!');
}).listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences
  ],

  partials: [
    Partials.Message,
    Partials.Channel
  ]
});

// =========================
// ACTIVE GAME STORAGE
// =========================
//
// Kept empty for future systems.
// Blacktea has been removed.
//

// =========================
// DICTIONARY WORD CHECKER
// =========================
//
// Kept because it may be useful for other
// future features, but Blacktea itself is removed.
//

async function isRealWord(word) {
  return new Promise((resolve) => {
    const req = https.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      }
    );

    req.on('error', () => resolve(false));

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// =========================
// OWNER NOTIFICATION
// =========================

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
  } catch (error) {
    console.error(
      'Failed to notify owner:',
      error
    );
  }
    }
// =========================
// DM LOGGER
// =========================

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

      message.attachments.forEach((attachment) => {
        text += `\n${attachment.name || 'file'}: ${attachment.url}`;
      });
    }

    if (message.stickers.size > 0) {
      text += `\n\n**Stickers:**`;

      message.stickers.forEach((sticker) => {
        text += `\n${sticker.name}`;
      });
    }

    if (message.embeds.length > 0) {
      text += `\n\n**Embeds:** ${message.embeds.length}`;

      message.embeds.forEach((embed, index) => {
        if (embed.title) {
          text += `\nEmbed ${index + 1} title: ${embed.title}`;
        }

        if (embed.description) {
          text += `\nEmbed ${index + 1} description: ${embed.description}`;
        }

        if (embed.url) {
          text += `\nEmbed ${index + 1} URL: ${embed.url}`;
        }

        if (embed.image?.url) {
          text += `\nEmbed ${index + 1} image: ${embed.image.url}`;
        }

        if (embed.thumbnail?.url) {
          text += `\nEmbed ${index + 1} thumbnail: ${embed.thumbnail.url}`;
        }
      });
    }

    await owner.send(text);

  } catch (error) {
    console.error(
      'Failed to forward bot DM:',
      error
    );
  }
});

// =========================
// BOT PRESENCE
// =========================

function updatePresence() {
  if (!client.user) return;

  const totalSeconds = Math.floor(
    (Date.now() - startTime) / 1000
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  let text = 'Monitoring servers for ';

  if (hours > 0) {
    text += `${hours}h `;
  }

  if (minutes > 0) {
    text += `${minutes}m`;
  }

  if (hours === 0 && minutes === 0) {
    text += 'less than 1m';
  }

  client.user.setPresence({
    activities: [
      {
        name: text,
        type: 3
      }
    ],
    status: botStatus
  });
}

// =========================
// READY EVENT
// =========================

client.once('ready', async () => {
  console.log(
    `Bot is online as ${client.user.tag}`
  );

  updatePresence();

  setInterval(() => {
    updatePresence();
  }, 15000);

  // =========================
  // REGISTER SLASH COMMANDS
  // =========================

  const rest = new REST({
    version: '10'
  }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: [

          // =====================
          // /say
          // =====================

          {
            name: 'say',
            description: 'Make the bot send a message',

            options: [
              {
                name: 'text',
                description: 'The text to send',
                type: 3,
                required: true
              }
            ]
          },

          // =====================
          // /invite
          // =====================

          {
            name: 'invite',
            description: 'Get the bot invite link'
          },

          // =====================
          // /autorole
          // =====================

          {
            name: 'autorole',
            description: 'Set a role to auto-assign when someone joins',

            options: [
              {
                name: 'role',
                description:
                  'The role to assign when someone joins',
                type: 8,
                required: false
              }
            ]
          },

          // =====================
          // /logboosts
          // =====================

          {
            name: 'logboosts',
            description:
              'Set the channel to log server boosts',

            options: [
              {
                name: 'channel',
                description:
                  'Channel to log boosts',
                type: 7,
                required: false
              }
            ]
          },

          // =====================
          // /logjoins
          // =====================

          {
            name: 'logjoins',
            description:
              'Set the channel to log member joins',

            options: [
              {
                name: 'channel',
                description:
                  'Channel to log joins',
                type: 7,
                required: false
              }
            ]
          },

          // =====================
          // /logleaves
          // =====================

          {
            name: 'logleaves',
            description:
              'Set the channel to log member leaves',

            options: [
              {
                name: 'channel',
                description:
                  'Channel to log leaves',
                type: 7,
                required: false
              }
            ]
          },

          // =====================
          // /active
          // =====================

          {
            name: 'active',
            description:
              'Send Hello guys! every 12 hours',

            options: [
              {
                name: 'channel',
                description:
                  'Channel to send the message in',
                type: 7,
                required: false
              }
            ]
          },

          // =====================
          // /logs
          // =====================

          {
            name: 'logs',
            description:
              'Set the channel for deleted message logs',

            options: [
              {
                name: 'channel',
                description:
                  'Channel to send logs to',
                type: 7,
                required: false
              }
            ]
          },

          // =====================
          // /unwhitelist
          // =====================

          {
            name: 'unwhitelist',
            description:
              'Remove a user from the bot whitelist',

            options: [
              {
                name: 'user',
                description:
                  'The user to remove from the whitelist',
                type: 6,
                required: true
              }
            ]
          },

          // =====================
          // /dm
          // =====================

          {
            name: 'dm',
            description:
              'Send a DM to a user as the bot',

            options: [
              {
                name: 'user',
                description:
                  'The user to DM',
                type: 6,
                required: true
              },

              {
                name: 'message',
                description:
                  'The message to send',
                type: 3,
                required: true
              }
            ]
          },

          // =====================
          // /dstatus
          // =====================

          {
            name: 'dstatus',
            description:
              'Change the bot online status',

            options: [
              {
                name: 'status',
                description:
                  'Choose the bot status',

                type: 3,
                required: true,

                choices: [
                  {
                    name: 'Online',
                    value: 'online'
                  },

                  {
                    name: 'Idle',
                    value: 'idle'
                  },

                  {
                    name: 'Do Not Disturb',
                    value: 'dnd'
                  },

                  {
                    name: 'Invisible',
                    value: 'invisible'
                  }
                ]
              }
            ]
          }
        ]
      }
    );

    console.log(
      'Slash commands registered successfully.'
    );

  } catch (error) {
    console.error(
      'Failed to register slash commands:',
      error
    );
  }

  // =========================
  // 12-HOUR AUTO MESSAGE
  // =========================

  setInterval(async () => {
    for (
      const [guildId, channelId]
      of Object.entries(activeChannels)
    ) {
      try {
        const guild =
          client.guilds.cache.get(guildId);

        if (!guild) continue;

        const channel =
          guild.channels.cache.get(channelId);

        if (
          channel &&
          channel.isTextBased()
        ) {
          await channel.send(
            'Hello guys!'
          );
        }

      } catch (error) {
        console.error(
          `Auto-message failed for guild ${guildId}:`,
          error.message
        );
      }
    }
  }, 12 * 60 * 60 * 1000);
});
// =========================
// SLASH COMMAND HANDLER
// =========================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // =========================
  // /say
  // =========================

  if (interaction.commandName === 'say') {
    if (!whitelist.includes(interaction.user.id)) {
      return interaction.reply({
        content: 'You do not have permission to use this.',
        ephemeral: true
      });
    }

    const text =
      interaction.options.getString('text');

    await interaction.reply({
      content: '✅',
      ephemeral: true
    });

    await interaction.channel.send(text);

    await notifyOwner(
      interaction.user,
      '/say',
      `"${text}" in #${interaction.channel.name} (${interaction.guild.name})`
    );

    return;
  }

  // =========================
  // /invite
  // =========================

  if (interaction.commandName === 'invite') {
    const link =
      `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`;

    await interaction.reply({
      content:
        `**Bot Invite Link:**\n${link}`,
      ephemeral: true
    });

    await notifyOwner(
      interaction.user,
      '/invite',
      `Requested invite link in ${interaction.guild.name}`
    );

    return;
  }

  // =========================
  // /dstatus
  // =========================

  if (interaction.commandName === 'dstatus') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content:
          'Only the bot owner can use this.',
        ephemeral: true
      });
    }

    botStatus =
      interaction.options.getString('status');

    updatePresence();

    return interaction.reply({
      content:
        `✅ Bot status changed to **${botStatus}**.`,
      ephemeral: true
    });
  }

  // =========================
  // /logjoins
  // =========================

  if (interaction.commandName === 'logjoins') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content:
          'Only the bot owner can use this.',
        ephemeral: true
      });
    }

    const channel =
      interaction.options.getChannel('channel');

    if (!channel) {
      delete joinLogChannels[
        interaction.guild.id
      ];

      saveJoinLogs();

      return interaction.reply({
        content:
          'Join logging has been **disabled**.',
        ephemeral: true
      });
    }

    joinLogChannels[
      interaction.guild.id
    ] = channel.id;

    saveJoinLogs();

    return interaction.reply({
      content:
        `✅ Join logs will be sent to ${channel}.`,
      ephemeral: true
    });
  }

  // =========================
  // /logleaves
  // =========================

  if (interaction.commandName === 'logleaves') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content:
          'Only the bot owner can use this.',
        ephemeral: true
      });
    }

    const channel =
      interaction.options.getChannel('channel');

    if (!channel) {
      delete leaveLogChannels[
        interaction.guild.id
      ];

      saveLeaveLogs();

      return interaction.reply({
        content:
          'Leave logging has been **disabled**.',
        ephemeral: true
      });
    }

    leaveLogChannels[
      interaction.guild.id
    ] = channel.id;

    saveLeaveLogs();

    return interaction.reply({
      content:
        `✅ Leave logs will be sent to ${channel}.`,
      ephemeral: true
    });
  }

  // =========================
  // /logboosts
  // =========================

  if (interaction.commandName === 'logboosts') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content:
          'Only the bot owner can use this.',
        ephemeral: true
      });
    }

    const channel =
      interaction.options.getChannel('channel');

    if (!channel) {
      delete boostLogChannels[
        interaction.guild.id
      ];

      saveBoostLogs();

      return interaction.reply({
        content:
          'Boost logging has been **disabled**.',
        ephemeral: true
      });
    }

    boostLogChannels[
      interaction.guild.id
    ] = channel.id;

    saveBoostLogs();

    return interaction.reply({
      content:
        `✅ Boost logs will be sent to ${channel}.`,
      ephemeral: true
    });
  }

  // =========================
  // /active
  // =========================

  if (interaction.commandName === 'active') {
    if (!whitelist.includes(interaction.user.id)) {
      return interaction.reply({
        content:
          'You do not have permission to use this.',
        ephemeral: true
      });
    }

    const channel =
      interaction.options.getChannel('channel');

    if (!channel) {
      delete activeChannels[
        interaction.guild.id
      ];

      saveActiveChannels();

      return interaction.reply({
        content:
          'Auto-message has been **disabled** for this server.',
        ephemeral: true
      });
    }

    activeChannels[
      interaction.guild.id
    ] = channel.id;

    saveActiveChannels();

    return interaction.reply({
      content:
        `✅ The bot will now say **Hello guys!** in ${channel} every 12 hours.`,
      ephemeral: true
    });
  }

  // =========================
  // /logs
  // =========================

  if (interaction.commandName === 'logs') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content:
          'Only the bot owner can use this command.',
        ephemeral: true
      });
    }

    const channel =
      interaction.options.getChannel('channel');

    if (!channel) {
      delete logChannels[
        interaction.guild.id
      ];

      saveLogChannels();

      return interaction.reply({
        content:
          'Message logging has been **disabled** for this server.',
        ephemeral: true
      });
    }

    logChannels[
      interaction.guild.id
    ] = channel.id;

    saveLogChannels();

    return interaction.reply({
      content:
        `Logs will now be sent to ${channel}.`,
      ephemeral: true
    });
  }

  // =========================
  // /unwhitelist
  // =========================

  if (interaction.commandName === 'unwhitelist') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content:
          'Only the bot owner can use this command.',
        ephemeral: true
      });
    }

    const target =
      interaction.options.getUser('user');

    if (!whitelist.includes(target.id)) {
      return interaction.reply({
        content:
          `**${target.username}** is not on the whitelist.`,
        ephemeral: true
      });
    }

    if (target.id === OWNER_ID) {
      return interaction.reply({
        content:
          "You can't remove yourself from the whitelist.",
        ephemeral: true
      });
    }

    whitelist =
      whitelist.filter(
        id => id !== target.id
      );

    saveWhitelist();

    return interaction.reply({
      content:
        `**${target.username}** has been removed from the whitelist.`,
      ephemeral: true
    });
  }

  // =========================
  // /dm
  // =========================

  if (interaction.commandName === 'dm') {
    if (!whitelist.includes(interaction.user.id)) {
      return interaction.reply({
        content:
          'You do not have permission to use this.',
        ephemeral: true
      });
    }

    await interaction.deferReply({
      ephemeral: true
    });

    const target =
      interaction.options.getUser('user');

    const msg =
      interaction.options.getString('message');

    try {
      await target.send(msg);

      await interaction.editReply({
        content:
          `✅ DM sent to **${target.tag}**.`
      });

      await notifyOwner(
        interaction.user,
        '/dm',
        `Sent DM to ${target.tag} (${target.id}): "${msg}" — in ${interaction.guild.name}`
      );

    } catch (error) {
      await interaction.editReply({
        content:
          `❌ Could not DM **${target.tag}**. They may have DMs disabled.`
      });
    }

    return;
  }

  // =========================
  // /autorole
  // =========================

  if (interaction.commandName === 'autorole') {
    if (!whitelist.includes(interaction.user.id)) {
      return interaction.reply({
        content:
          'You do not have permission to use this.',
        ephemeral: true
      });
    }

    const role =
      interaction.options.getRole('role');

    if (!role) {
      delete autoroles[
        interaction.guild.id
      ];

      saveAutoroles();

      return interaction.reply({
        content:
          'Autorole has been **disabled** for this server.',
        ephemeral: true
      });
    }

    autoroles[
      interaction.guild.id
    ] = role.id;

    saveAutoroles();

    await interaction.reply({
      content:
        `✅ Autorole set! New members will automatically receive the **${role.name}** role.`,
      ephemeral: true
    });

    await notifyOwner(
      interaction.user,
      '/autorole',
      `Set autorole to "${role.name}" in ${interaction.guild.name}`
    );

    return;
  }
});
// ===== PREFIX COMMANDS =====
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  // ===== WHITELIST =====
  if (command === 'whitelist') {
    if (message.author.id !== OWNER_ID) {
      return message.reply("Only the bot owner can use this command.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user to whitelist.");
    }

    if (whitelist.includes(user.id)) {
      return message.reply(`**${user.username}** is already whitelisted.`);
    }

    whitelist.push(user.id);
    saveWhitelist();

    return message.reply(
      `**${user.username}** has been whitelisted to use the bot!`
    );
  }

  // ===== PERMISSION CHECK =====
  if (!whitelist.includes(message.author.id)) {
    return message.reply("Get whitelisted first, loser.");
  }

  // ===== LOG COMMAND USAGE =====
  if (message.author.id !== OWNER_ID) {
    notifyOwner(
      message.author,
      `,${command}`,
      `Full message: \`${message.content}\` | Server: ${message.guild.name} | Channel: #${message.channel.name}`
    );
  }

  // ===== PING =====
  if (command === 'ping') {
    return message.reply(`Pong! Latency: ${client.ws.ping}ms`);
  }

  // ===== HELP =====
  if (command === 'help') {
    return message.reply(
      '**Commands:**\n' +
      '`,ping` — check bot latency\n' +
      '`,userinfo [@user]` — show user info\n' +
      '`,avatar [@user]` — show avatar\n' +
      '`,serverinfo` — show server info\n' +
      '`,say <text>` — make bot say something\n' +
      '`,purge <amount>` — delete messages (max 100)\n' +
      '`,kick @user [reason]` — kick a user\n' +
      '`,ban @user [reason]` — ban a user\n' +
      '`,unban <id>` — unban a user\n' +
      '`,hb @user [reason]` — permanently ban a user\n' +
      '`,unhb <id/@user>` — remove from hardban\n' +
      '`,mute @user <time> [reason]` — timeout a user\n' +
      '`,unmute @user` — remove timeout\n' +
      '`,warn @user <reason>` — warn a user\n' +
      '`,warnings [@user]` — view warnings\n' +
      '`,clearwarns @user` — clear warnings\n' +
      '`,slowmode <seconds>` — set channel slowmode\n' +
      '`,lock [reason]` — lock a channel\n' +
      '`,unlock` — unlock a channel\n' +
      '`,nick @user <nickname>` — change nickname\n' +
      '`,fn @user <nickname>` — force-lock nickname\n' +
      '`,fnc @user` — remove forced nickname\n' +
      '`,role @user <role>` — add/remove a role\n' +
      '`,togglestaff` — toggle the £ role\n' +
      '`,verify @user` — verify a user\n' +
      '`,whitelist @user` — whitelist a user (owner only)'
    );
  }

  // ===== USERINFO =====
  if (command === 'userinfo') {
    const target =
      message.mentions.members.first() || message.member;

    const user = target.user;

    return message.reply(
      `**User:** ${user.tag}\n` +
      `**ID:** ${user.id}\n` +
      `**Joined Server:** ${target.joinedAt?.toDateString() || 'Unknown'}\n` +
      `**Account Created:** ${user.createdAt.toDateString()}\n` +
      `**Roles:** ${
        target.roles.cache
          .filter(role => role.id !== message.guild.id)
          .map(role => role.name)
          .join(', ') || 'None'
      }`
    );
  }

  // ===== AVATAR =====
  if (command === 'avatar') {
    const target =
      message.mentions.users.first() || message.author;

    return message.reply(
      target.displayAvatarURL({
        size: 512,
        dynamic: true
      })
    );
  }

  // ===== SERVERINFO =====
  if (command === 'serverinfo') {
    const guild = message.guild;

    return message.reply(
      `**Server:** ${guild.name}\n` +
      `**ID:** ${guild.id}\n` +
      `**Owner:** <@${guild.ownerId}>\n` +
      `**Members:** ${guild.memberCount}\n` +
      `**Channels:** ${guild.channels.cache.size}\n` +
      `**Roles:** ${guild.roles.cache.size}\n` +
      `**Created:** ${guild.createdAt.toDateString()}`
    );
  }

  // ===== PURGE =====
  if (command === 'purge') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages
      )
    ) {
      return message.reply("No permission.");
    }

    const amount = parseInt(args[0]);

    if (
      isNaN(amount) ||
      amount < 1 ||
      amount > 100
    ) {
      return message.reply(
        "Provide a number between 1 and 100."
      );
    }

    try {
      await message.delete();

      const deleted = await message.channel.bulkDelete(
        amount,
        true
      );

      const confirm = await message.channel.send(
        `Successfully purged ${deleted.size} messages.`
      );

      setTimeout(() => {
        confirm.delete().catch(() => {});
      }, 3000);

    } catch (err) {
      console.error("Purge error:", err);

      message.channel.send(
        "Purge failed. Messages older than 14 days can't be bulk deleted."
      );
    }
  }

  // ===== KICK =====
  if (command === 'kick') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.KickMembers
      )
    ) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    if (user.id === message.author.id) {
      return message.reply("You can't kick yourself.");
    }

    const member = await message.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return message.reply("User not found in server.");
    }

    if (
      member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return message.reply("Can't kick an admin.");
    }

    const reason =
      args
        .filter(arg => !/^<@!?\d+>$/.test(arg))
        .join(' ') || 'No reason';

    try {
      await member.kick(reason);

      return message.reply(
        `**${user.tag}** has been kicked. Reason: ${reason}`
      );

    } catch (err) {
      console.error("Kick error:", err);

      return message.reply("Kick failed.");
    }
  }

  // ===== MUTE / TIMEOUT =====
  if (command === 'mute') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const member = await message.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return message.reply("User not found in server.");
    }

    const timeArg = args.find(arg =>
      /^\d+(s|m|h|d)?$/i.test(arg)
    );

    if (!timeArg) {
      return message.reply(
        "Provide a duration. Examples: `30s`, `10m`, `1h`, `1d`, or `10` (minutes)."
      );
    }

    const timeUnits = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000
    };

    const match = timeArg.match(
      /^(\d+)(s|m|h|d)?$/i
    );

    if (!match) {
      return message.reply("Invalid duration.");
    }

    const value = parseInt(match[1]);
    const unit = match[2]
      ? match[2].toLowerCase()
      : 'm';

    const ms = value * timeUnits[unit];

    if (ms < 5000) {
      return message.reply(
        "Minimum mute duration is 5 seconds."
      );
    }

    if (ms > 28 * 24 * 60 * 60 * 1000) {
      return message.reply(
        "Maximum mute duration is 28 days."
      );
    }

    const unitLabels = {
      s: 'second(s)',
      m: 'minute(s)',
      h: 'hour(s)',
      d: 'day(s)'
    };

    const displayTime =
      `${value} ${unitLabels[unit]}`;

    const reason =
      args
        .filter(
          arg =>
            !/^<@!?\d+>$/.test(arg) &&
            !/^\d+(s|m|h|d)?$/i.test(arg)
        )
        .join(' ') || 'No reason';

    try {
      await user.send(
        `You have been timed out in **${message.guild.name}** by **${message.author.tag}** for ${displayTime}. Reason: ${reason}`
      ).catch(() => {});

      await member.timeout(ms, reason);

      return message.reply(
        `**${user.tag}** has been muted for ${displayTime}. Reason: ${reason}`
      );

    } catch (err) {
      console.error("Mute error:", err);

      return message.reply("Mute failed.");
    }
  }

  // ===== UNMUTE =====
  if (command === 'unmute') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const member = await message.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return message.reply("User not found in server.");
    }

    try {
      await member.timeout(null);

      return message.reply(
        `**${user.tag}** has been unmuted.`
      );

    } catch (err) {
      console.error("Unmute error:", err);

      return message.reply("Unmute failed.");
    }
      }
    // ===== WARN =====
  if (command === 'warn') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const reason = args
      .filter(arg => !/^<@!?\d+>$/.test(arg))
      .join(' ');

    if (!reason) {
      return message.reply("Provide a reason.");
    }

    const key = `${message.guild.id}_${user.id}`;
    const userWarnings = warnings.get(key) || [];

    userWarnings.push({
      reason,
      by: message.author.tag,
      date: new Date().toDateString()
    });

    warnings.set(key, userWarnings);
    saveWarnings();

    await user.send(
      `You have been warned in **${message.guild.name}** by **${message.author.tag}**. Reason: ${reason}`
    ).catch(() => {});

    return message.reply(
      `**${user.tag}** has been warned. They now have ${userWarnings.length} warning(s).`
    );
  }

  // ===== WARNINGS =====
  if (command === 'warnings') {
    const user =
      message.mentions.users.first() || message.author;

    const key = `${message.guild.id}_${user.id}`;
    const userWarnings = warnings.get(key) || [];

    if (userWarnings.length === 0) {
      return message.reply(
        `**${user.tag}** has no warnings.`
      );
    }

    const list = userWarnings
      .map(
        (warning, index) =>
          `${index + 1}. **${warning.reason}** — by ${warning.by} on ${warning.date}`
      )
      .join('\n');

    return message.reply(
      `**Warnings for ${user.tag}:**\n${list}`
    );
  }

  // ===== CLEAR WARNINGS =====
  if (command === 'clearwarns') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const key = `${message.guild.id}_${user.id}`;

    warnings.delete(key);
    saveWarnings();

    return message.reply(
      `All warnings cleared for **${user.tag}**.`
    );
  }

  // ===== SLOWMODE =====
  if (command === 'slowmode') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply("No permission.");
    }

    const seconds = parseInt(args[0]);

    if (
      isNaN(seconds) ||
      seconds < 0 ||
      seconds > 21600
    ) {
      return message.reply(
        "Provide a number of seconds between 0 and 21600."
      );
    }

    try {
      await message.channel.setRateLimitPerUser(seconds);

      return message.reply(
        seconds === 0
          ? "Slowmode disabled."
          : `Slowmode set to ${seconds} second(s).`
      );

    } catch (err) {
      console.error("Slowmode error:", err);

      return message.reply(
        "Failed to set slowmode."
      );
    }
  }

  // ===== LOCK =====
  if (command === 'lock') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply("No permission.");
    }

    const reason =
      args.join(' ') || 'No reason';

    try {
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      return message.channel.send(
        `🔒 Channel locked. Reason: ${reason}`
      );

    } catch (err) {
      console.error("Lock error:", err);

      return message.reply(
        "Failed to lock channel."
      );
    }
  }

  // ===== UNLOCK =====
  if (command === 'unlock') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply("No permission.");
    }

    try {
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: null
        }
      );

      return message.channel.send(
        "🔓 Channel unlocked."
      );

    } catch (err) {
      console.error("Unlock error:", err);

      return message.reply(
        "Failed to unlock channel."
      );
    }
  }

  // ===== NICK =====
  if (command === 'nick') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageNicknames
      )
    ) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const nick = args
      .filter(arg => !/^<@!?\d+>$/.test(arg))
      .join(' ');

    if (!nick) {
      return message.reply(
        "Provide a nickname."
      );
    }

    const member = await message.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return message.reply(
        "User not found in server."
      );
    }

    try {
      await member.setNickname(nick);

      return message.reply(
        `Nickname for **${user.tag}** set to **${nick}**.`
      );

    } catch (err) {
      console.error("Nick error:", err);

      return message.reply(
        "Failed to change nickname."
      );
    }
  }

  // ===== FORCE NICKNAME =====
  if (command === 'fn') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageNicknames
      )
    ) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const nick = args
      .filter(arg => !/^<@!?\d+>$/.test(arg))
      .join(' ');

    if (!nick) {
      return message.reply(
        "Provide a nickname to force."
      );
    }

    const member = await message.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return message.reply(
        "User not found in server."
      );
    }

    const key =
      `${message.guild.id}_${user.id}`;

    try {
      await member.setNickname(nick);

      forcedNicks.set(key, nick);
      saveForcedNicks();

      return message.reply(
        `**${user.tag}**'s nickname is now force-locked to **${nick}**.`
      );

    } catch (err) {
      console.error("Force nickname error:", err);

      return message.reply(
        "Failed to set forced nickname."
      );
    }
  }

  // ===== CANCEL FORCE NICKNAME =====
  if (command === 'fnc') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageNicknames
      )
    ) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const key =
      `${message.guild.id}_${user.id}`;

    if (!forcedNicks.has(key)) {
      return message.reply(
        "That user doesn't have a forced nickname."
      );
    }

    const member = await message.guild.members
      .fetch(user.id)
      .catch(() => null);

    forcedNicks.delete(key);
    saveForcedNicks();

    if (member) {
      await member.setNickname(null).catch(() => {});
    }

    return message.reply(
      `Force nickname removed for **${user.tag}**. Their nickname has been reset.`
    );
  }

  // ===== ROLE =====
  if (command === 'role') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageRoles
      )
    ) {
      return message.reply("No permission.");
    }

    const member =
      message.mentions.members.first();

    if (!member) {
      return message.reply(
        "Mention a user."
      );
    }

    /*
     * The old code had TWO copies of the role
     * command accidentally placed inside each other.
     *
     * This version is the replacement.
     */

    const mentionedRole =
      message.mentions.roles.first();

    const roleInput = args
      .filter(arg => !/^<@!?\d+>$/.test(arg))
      .join(' ')
      .trim();

    if (!mentionedRole && !roleInput) {
      return message.reply(
        "Specify a role."
      );
    }

    let role = mentionedRole;

    if (!role && /^\d{17,20}$/.test(roleInput)) {
      role =
        message.guild.roles.cache.get(roleInput);
    }

    if (!role) {
      role =
        message.guild.roles.cache.find(
          r =>
            r.name.toLowerCase() ===
            roleInput.toLowerCase()
        );
    }

    if (!role) {
      return message.reply(
        `Role "${roleInput}" not found.`
      );
    }

    // Prevent @everyone from being modified.
    if (role.id === message.guild.id) {
      return message.reply(
        "You cannot add or remove the @everyone role."
      );
    }

    // Discord hierarchy check.
    if (
      role.position >=
      message.guild.members.me.roles.highest.position
    ) {
      return message.reply(
        "I can't manage that role because it is higher than or equal to my highest role."
      );
    }

    // Prevent managing a role above the command user's highest role.
    if (
      message.author.id !== message.guild.ownerId &&
      role.position >= message.member.roles.highest.position
    ) {
      return message.reply(
        "You can't manage a role that is higher than or equal to your highest role."
      );
    }

    try {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);

        return message.reply(
          `Removed **${role.name}** from **${member.user.tag}**.`
        );
      }

      await member.roles.add(role);

      return message.reply(
        `Added **${role.name}** to **${member.user.tag}**.`
      );

    } catch (err) {
      console.error("Role command error:", err);

      return message.reply(
        "Failed to update the role. Make sure the bot's role is above the target role and that I have Manage Roles permission."
      );
    }
  }

  // ===== TOGGLE STAFF =====
  if (command === 'togglestaff') {
    if (message.author.id !== OWNER_ID) {
      return message.reply(
        "Only the bot owner can use this."
      );
    }

    const role =
      message.guild.roles.cache.find(
        r => r.name === '£'
      );

    if (!role) {
      return message.reply(
        "Role not found."
      );
    }

    if (
      role.position >=
      message.guild.members.me.roles.highest.position
    ) {
      return message.reply(
        "I can't manage the £ role because it is higher than or equal to my highest role."
      );
    }

    try {
      if (
        message.member.roles.cache.has(role.id)
      ) {
        await message.member.roles.remove(role);

        return message.reply(
          "Role removed."
        );
      }

      await message.member.roles.add(role);

      return message.reply(
        "Role added."
      );

    } catch (err) {
      console.error("Toggle staff error:", err);

      return message.reply(
        "Failed. Make sure the bot's role is above the £ role."
      );
    }
  }
    // ===== VERIFY =====
  if (command === 'verify') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageRoles
      )
    ) {
      return message.reply(
        "You do not have permission to use this command."
      );
    }

    const member =
      message.mentions.members.first();

    if (!member) {
      return message.reply(
        "Mention a user to verify."
      );
    }

    const unverifiedRole =
      message.guild.roles.cache.get(
        "1514951121762914324"
      );

    const verifiedRole =
      message.guild.roles.cache.get(
        "1482292139366023310"
      );

    if (!verifiedRole || !unverifiedRole) {
      return message.reply(
        "One or more roles could not be found."
      );
    }

    // Make sure the bot can manage both roles.
    const botHighestRole =
      message.guild.members.me.roles.highest;

    if (
      unverifiedRole.position >=
        botHighestRole.position ||
      verifiedRole.position >=
        botHighestRole.position
    ) {
      return message.reply(
        "I can't manage one or both verification roles. Make sure my highest role is above them."
      );
    }

    try {
      if (
        member.roles.cache.has(
          unverifiedRole.id
        )
      ) {
        await member.roles.remove(
          unverifiedRole
        );
      }

      if (
        !member.roles.cache.has(
          verifiedRole.id
        )
      ) {
        await member.roles.add(
          verifiedRole
        );
      }

      return message.channel.send(
        `${member} has been verified.`
      );

    } catch (err) {
      console.error(
        "Verify error:",
        err
      );

      return message.reply(
        "Failed to verify user. Make sure the bot role is above both roles."
      );
    }
  }

  // ===== BAN =====
  if (command === 'ban') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply("No permission.");
    }

    const user =
      message.mentions.users.first();

    if (!user) {
      return message.reply(
        "Mention a user."
      );
    }

    if (
      user.id === message.author.id
    ) {
      return message.reply(
        "You can't ban yourself."
      );
    }

    const member =
      await message.guild.members
        .fetch(user.id)
        .catch(() => null);

    if (
      member &&
      member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return message.reply(
        "Can't ban an admin."
      );
    }

    const reason =
      args
        .filter(
          arg => !/^<@!?\d+>$/.test(arg)
        )
        .join(' ') ||
      'No reason';

    try {
      await message.guild.members.ban(
        user.id,
        { reason }
      );

      return message.reply(
        `**${user.tag}** banned. Reason: ${reason}`
      );

    } catch (err) {
      console.error(
        "Ban error:",
        err
      );

      return message.reply(
        "Ban failed."
      );
    }
  }

  // ===== HARD BAN =====
  if (command === 'hb') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply("No permission.");
    }

    const firstArg = args[0];

    if (!firstArg) {
      return message.reply(
        "Mention a user, type a username, or provide a user ID."
      );
    }

    let userId = null;
    let user = null;

    const mention =
      message.mentions.users.first();

    // Mention
    if (mention) {
      user = mention;
      userId = mention.id;
    }

    // User ID
    else if (
      /^\d{17,20}$/.test(firstArg)
    ) {
      userId = firstArg;

      user =
        await client.users
          .fetch(userId)
          .catch(() => null);

      if (!user) {
        return message.reply(
          "That user ID is not valid."
        );
      }
    }

    // Username / display name
    else {
      const searchName =
        firstArg.toLowerCase();

      const foundMember =
        message.guild.members.cache.find(
          member =>
            member.user.username
              .toLowerCase() === searchName ||
            member.user.tag
              .toLowerCase() === searchName ||
            member.displayName
              .toLowerCase() === searchName
        );

      if (!foundMember) {
        return message.reply(
          "User not found. Use their user ID if they are not in the server."
        );
      }

      user = foundMember.user;
      userId = user.id;
    }

    if (
      userId === message.author.id
    ) {
      return message.reply(
        "You can't hardban yourself."
      );
    }

    const reason =
      args
        .slice(mention || /^\d{17,20}$/.test(firstArg) ? 1 : 1)
        .join(' ') ||
      'No reason';

    // Add to permanent hardban list.
    hardbannedUsers.set(
      userId,
      reason
    );

    saveHardbans();

    const member =
      await message.guild.members
        .fetch(userId)
        .catch(() => null);

    if (member) {
      if (
        member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {
        hardbannedUsers.delete(userId);
        saveHardbans();

        return message.reply(
          "Can't hardban an admin."
        );
      }

      await user.send(
        `You have been hardbanned from **${message.guild.name}**.\n` +
        `Reason: ${reason}\n` +
        `DM "1ny6" to appeal this sanction.`
      ).catch(() => {});

      try {
        await message.guild.members.ban(
          userId,
          { reason }
        );
      } catch (err) {
        console.error(
          "Hardban ban error:",
          err
        );

        return message.reply(
          "User was added to the hardban list, but I could not ban them from the server."
        );
      }

      return message.channel.send(
        `✅ **${user.tag}** has been hardbanned and banned now.\n` +
        `**User ID:** ${userId}\n` +
        `**Reason:** ${reason}`
      );
    }

    return message.channel.send(
      `✅ **${user?.tag || userId}** has been added to the hardban watchlist.\n` +
      `They will be banned automatically if they join.\n` +
      `**User ID:** ${userId}\n` +
      `**Reason:** ${reason}`
    );
  }

  // ===== UNBAN =====
  if (command === 'unban') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply(
        "No permission."
      );
    }

    const raw = args[0];

    if (!raw) {
      return message.reply(
        "Provide a user ID or mention."
      );
    }

    const userId =
      raw
        .replace(/^<@!?/, '')
        .replace(/>$/, '');

    try {
      await message.guild.members.unban(
        userId
      );

      return message.reply(
        "User unbanned."
      );

    } catch (err) {
      console.error(
        "Unban error:",
        err
      );

      return message.reply(
        "Unban failed. Make sure the user is actually banned."
      );
    }
  }

  // ===== REMOVE HARD BAN =====
  if (command === 'unhb') {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply(
        "No permission."
      );
    }

    const raw = args[0];

    if (!raw) {
      return message.reply(
        "Provide a user ID or mention."
      );
    }

    const userId =
      raw
        .replace(/^<@!?/, '')
        .replace(/>$/, '');

    if (
      !hardbannedUsers.has(userId)
    ) {
      return message.reply(
        "That user is not in the hardban list."
      );
    }

    hardbannedUsers.delete(
      userId
    );

    saveHardbans();

    try {
      await message.guild.members
        .unban(userId);
    } catch (err) {
      // They may already be unbanned.
      console.log(
        `Could not unban ${userId}:`,
        err.message
      );
    }

    return message.reply(
      "User un-hardbanned."
    );
  }
  // ===== SLOWMODE =====
  if (command === 'slowmode') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("No permission.");
    }

    const seconds = parseInt(args[0]);

    if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
      return message.reply("Provide a number of seconds between 0 and 21600.");
    }

    try {
      await message.channel.setRateLimitPerUser(seconds);

      return message.reply(
        seconds === 0
          ? "Slowmode disabled."
          : `Slowmode set to ${seconds} second(s).`
      );
    } catch {
      return message.reply("Failed to set slowmode.");
    }
  }

  // ===== LOCK =====
  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("No permission.");
    }

    const reason = args.join(' ') || 'No reason';

    try {
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      return message.channel.send(`🔒 Channel locked. Reason: ${reason}`);
    } catch {
      return message.reply("Failed to lock channel.");
    }
  }

  // ===== UNLOCK =====
  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("No permission.");
    }

    try {
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: null
        }
      );

      return message.channel.send("🔓 Channel unlocked.");
    } catch {
      return message.reply("Failed to unlock channel.");
    }
  }

  // ===== NICK =====
  if (command === 'nick') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const nick = args
      .filter(a => !a.match(/^<@!?\d+>$/))
      .join(' ');

    if (!nick) {
      return message.reply("Provide a nickname.");
    }

    const member = await message.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return message.reply("User not found in server.");
    }

    try {
      await member.setNickname(nick);

      return message.reply(
        `Nickname for **${user.tag}** set to **${nick}**.`
      );
    } catch {
      return message.reply("Failed to change nickname.");
    }
  }

  // ===== FORCE NICKNAME =====
  if (command === 'fn') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const nick = args
      .filter(a => !a.match(/^<@!?\d+>$/))
      .join(' ');

    if (!nick) {
      return message.reply("Provide a nickname to force.");
    }

    const member = await message.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return message.reply("User not found in server.");
    }

    const key = `${message.guild.id}_${user.id}`;

    try {
      await member.setNickname(nick);

      forcedNicks.set(key, nick);
      saveForcedNicks();

      return message.reply(
        `**${user.tag}**'s nickname is now force-locked to **${nick}**.`
      );
    } catch {
      return message.reply("Failed to set forced nickname.");
    }
  }

  // ===== CANCEL FORCE NICKNAME =====
  if (command === 'fnc') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    const key = `${message.guild.id}_${user.id}`;

    if (!forcedNicks.has(key)) {
      return message.reply("That user doesn't have a forced nickname.");
    }

    const member = await message.guild.members.fetch(user.id).catch(() => null);

    forcedNicks.delete(key);
    saveForcedNicks();

    if (member) {
      await member.setNickname(null).catch(() => null);
    }

    return message.reply(
      `Force nickname removed for **${user.tag}**. Their nickname has been reset.`
    );
  }

  // ===== ROLE =====
  if (command === 'role') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply("No permission.");
    }

    const targetUser = message.mentions.users.first();

    if (!targetUser) {
      return message.reply("Mention a user.");
    }

    const targetMember = await message.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!targetMember) {
      return message.reply("User not found in server.");
    }

    // Everything after the user mention is treated as the role input.
    const roleInput = args
      .filter(arg => !arg.match(/^<@!?\d+>$/))
      .join(' ')
      .trim();

    if (!roleInput) {
      return message.reply("Provide a role name, role ID, or mention a role.");
    }

    let role = null;

    // Role mention
    const mentionedRole = message.mentions.roles.first();

    if (mentionedRole) {
      role = mentionedRole;
    }

    // Role ID
    if (!role && /^\d{17,20}$/.test(roleInput)) {
      role = message.guild.roles.cache.get(roleInput);
    }

    // Exact role name
    if (!role) {
      role = message.guild.roles.cache.find(
        r => r.name.toLowerCase() === roleInput.toLowerCase()
      );
    }

    if (!role) {
      return message.reply(`Role "${roleInput}" not found.`);
    }

    // Prevent the bot from modifying roles it cannot manage.
    if (role.managed) {
      return message.reply("I can't manually manage that role.");
    }

    if (role.position >= message.guild.members.me.roles.highest.position) {
      return message.reply(
        "I can't manage that role because it is equal to or higher than my highest role."
      );
    }

    if (
      targetMember.roles.highest.position >=
      message.guild.members.me.roles.highest.position
    ) {
      return message.reply(
        "I can't manage that user because their highest role is equal to or higher than my highest role."
      );
    }

    try {
      // Toggle:
      // If they already have the role → remove it.
      // If they don't → add it.
      if (targetMember.roles.cache.has(role.id)) {
        await targetMember.roles.remove(role);

        return message.channel.send(
          `➖ Removed **${role.name}** from **${targetUser.tag}**.`
        );
      }

      await targetMember.roles.add(role);

      return message.channel.send(
        `➕ Added **${role.name}** to **${targetUser.tag}**.`
      );
    } catch (err) {
      console.error("Role command error:", err);

      return message.reply(
        "Failed to update the role. Make sure my bot role is above the target role and I have Manage Roles permission."
      );
    }
  }

  // ===== TOGGLE STAFF =====
  if (command === 'togglestaff') {
    if (message.author.id !== OWNER_ID) {
      return message.reply("Only the bot owner can use this.");
    }

    const roleName = '£';
    const role = message.guild.roles.cache.find(
      r => r.name === roleName
    );

    if (!role) {
      return message.reply("Role not found.");
    }

    if (
      role.position >= message.guild.members.me.roles.highest.position
    ) {
      return message.reply(
        "I can't manage the £ role because it is equal to or higher than my highest role."
      );
    }

    try {
      if (message.member.roles.cache.has(role.id)) {
        await message.member.roles.remove(role);
        return message.reply("Role removed.");
      }

      await message.member.roles.add(role);
      return message.reply("Role added.");
    } catch {
      return message.reply(
        "Failed. Make sure the bot's role is above the £ role."
      );
    }
  }

  // ===== VERIFY =====
  if (command === 'verify') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply("You do not have permission to use this command.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("Mention a user to verify.");
    }

    const unverifiedRole = message.guild.roles.cache.get(
      "1514951121762914324"
    );

    const verifiedRole = message.guild.roles.cache.get(
      "1482292139366023310"
    );

    if (!verifiedRole || !unverifiedRole) {
      return message.reply("One or more roles could not be found.");
    }

    try {
      if (member.roles.cache.has(unverifiedRole.id)) {
        await member.roles.remove(unverifiedRole);
      }

      if (!member.roles.cache.has(verifiedRole.id)) {
        await member.roles.add(verifiedRole);
      }

      return message.channel.send(
        `${member} has been verified.`
      );
    } catch (err) {
      console.error("Verify error:", err);

      return message.reply(
        "Failed to verify user. Make sure the bot role is above both roles."
      );
    }
  }
  // ===== BAN =====
  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("No permission.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("Mention a user.");
    }

    if (user.id === message.author.id) {
      return message.reply("You can't ban yourself.");
    }

    const member = await message.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (
      member &&
      member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply("Can't ban an admin.");
    }

    const reason =
      args
        .filter(a => !a.match(/^<@!?\d+>$/))
        .join(' ') || 'No reason';

    try {
      await message.guild.members.ban(user.id, { reason });

      return message.reply(
        `**${user.tag}** banned. Reason: ${reason}`
      );
    } catch {
      return message.reply("Ban failed.");
    }
  }

  // ===== HARDBAN =====
  if (command === 'hb') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("No permission.");
    }

    const firstArg = args[0];

    if (!firstArg) {
      return message.reply(
        "Mention a user, type a username, or provide a user ID."
      );
    }

    let userId = null;
    let user = null;

    const mention = message.mentions.users.first();

    if (mention) {
      user = mention;
      userId = mention.id;
    } else if (/^\d{17,20}$/.test(firstArg)) {
      userId = firstArg;

      user = await client.users.fetch(userId).catch(() => null);

      if (!user) {
        return message.reply("That user ID is not valid.");
      }
    } else {
      const searchName = firstArg.toLowerCase();

      const member = message.guild.members.cache.find(m =>
        m.user.username.toLowerCase() === searchName ||
        m.user.tag.toLowerCase() === searchName ||
        m.displayName.toLowerCase() === searchName
      );

      if (!member) {
        return message.reply(
          "User not found. Use their user ID if they are not in the server."
        );
      }

      user = member.user;
      userId = user.id;
    }

    if (userId === message.author.id) {
      return message.reply("You can't hardban yourself.");
    }

    const reason = args.slice(1).join(' ') || 'No reason';

    // Save the hardban before banning so the user remains
    // on the watchlist if they leave/rejoin later.
    hardbannedUsers.set(userId, reason);
    saveHardbans();

    const member = await message.guild.members
      .fetch(userId)
      .catch(() => null);

    if (member) {
      if (
        member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {
        hardbannedUsers.delete(userId);
        saveHardbans();

        return message.reply("Can't hardban an admin.");
      }

      await user.send(
        `You have been hardbanned from **${message.guild.name}**.\n` +
        `Reason: ${reason}\n` +
        `DM "1ny6" to appeal this sanction.`
      ).catch(() => null);

      try {
        await message.guild.members.ban(userId, { reason });
      } catch (err) {
        console.error("Hardban failed:", err);

        return message.reply(
          "Failed to ban the user. Make sure I have Ban Members permission and my role is high enough."
        );
      }

      return message.channel.send(
        `✅ **${user.tag}** has been hardbanned and banned now.\n` +
        `**User ID:** ${userId}\n` +
        `**Reason:** ${reason}`
      );
    }

    return message.channel.send(
      `✅ **${user ? user.tag : userId}** has been added to the hardban watchlist.\n` +
      `They will be DM'd and banned if they join.\n` +
      `**User ID:** ${userId}\n` +
      `**Reason:** ${reason}`
    );
  }

  // ===== UNBAN =====
  if (command === 'unban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("No permission.");
    }

    const raw = args[0];

    if (!raw) {
      return message.reply("Provide a user ID or mention.");
    }

    const userId = raw
      .replace(/^<@!?/, '')
      .replace(/>$/, '');

    try {
      await message.guild.members.unban(userId);

      return message.reply("User unbanned.");
    } catch {
      return message.reply(
        "Unban failed. Make sure the user is actually banned."
      );
    }
  }

  // ===== HARDUNBAN =====
  if (command === 'unhb') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("No permission.");
    }

    const raw = args[0];

    if (!raw) {
      return message.reply("Provide a user ID or mention.");
    }

    const userId = raw
      .replace(/^<@!?/, '')
      .replace(/>$/, '');

    if (!hardbannedUsers.has(userId)) {
      return message.reply(
        "That user is not in the hardban list."
      );
    }

    hardbannedUsers.delete(userId);
    saveHardbans();

    try {
      await message.guild.members.unban(userId);

      return message.reply("User un-hardbanned.");
    } catch {
      return message.reply(
        "Removed from the hardban list. They may have already been manually unbanned."
      );
    }
                           }
  // ===== MESSAGE DELETE LOGGER =====
  // Logs deleted messages to the channel configured with ,logs
  client.on('messageDelete', async (message) => {
    if (!message.guild) return;
    if (message.author?.bot) return;

    const logChannelId = logChannels[message.guild.id];

    if (!logChannelId) return;

    const logChannel = message.guild.channels.cache.get(logChannelId);

    if (!logChannel) return;

    const author = message.author;
    const avatarURL = author
      ? author.displayAvatarURL({ dynamic: true })
      : null;

    const tag = author ? author.tag : 'Unknown User';
    const userId = author ? author.id : 'Unknown';

    const channelMention = message.channel
      ? `<#${message.channel.id}>`
      : 'Unknown Channel';

    const content = message.content || '*No text content*';

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setAuthor({
        name: tag,
        iconURL: avatarURL || undefined
      })
      .setDescription(content)
      .addFields(
        {
          name: 'Author',
          value: author ? `<@${userId}>` : 'Unknown',
          inline: true
        },
        {
          name: 'Channel',
          value: channelMention,
          inline: true
        }
      )
      .setFooter({
        text: `Message Deleted • User ID: ${userId}`
      })
      .setTimestamp();

    // Show deleted image attachments directly in the embed.
    const imageAttachment = message.attachments?.find(
      attachment =>
        attachment.contentType?.startsWith('image/')
    );

    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    }

    try {
      await logChannel.send({
        embeds: [embed]
      });

      // Repost non-image attachments when possible.
      for (const [, attachment] of (message.attachments || [])) {
        if (!attachment.contentType?.startsWith('image/')) {
          await logChannel.send({
            content: `📎 Deleted file from **${tag}**:`,
            files: [attachment.url]
          }).catch(async () => {
            await logChannel.send(
              `📎 Deleted file from **${tag}** ` +
              `(could not repost): ${attachment.url}`
            );
          });
        }
      }
    } catch (err) {
      console.error(
        'Failed to log deleted message:',
        err.message
      );
    }
  });

  // ===== LEAVE LOGGER =====
  client.on('guildMemberRemove', async (member) => {
    const guild = member.guild;

    const leaveLogId = leaveLogChannels[guild.id];

    if (!leaveLogId) return;

    const leaveLogChannel =
      guild.channels.cache.get(leaveLogId);

    if (!leaveLogChannel) return;

    if (member.partial) {
      try {
        member = await member.fetch();
      } catch {
        return;
      }
    }

    const roleList = member.roles?.cache
      .filter(role => role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => `\`${role.name}\``)
      .join(', ') || 'None';

    const roleValue =
      roleList.length > 1024
        ? roleList.slice(0, 1021) + '...'
        : roleList;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setAuthor({
        name: `${member.user.tag} left`,
        iconURL: member.user.displayAvatarURL({
          dynamic: true
        })
      })
      .setThumbnail(
        member.user.displayAvatarURL({
          dynamic: true,
          size: 256
        })
      )
      .addFields(
        {
          name: 'User',
          value: `<@${member.id}>`,
          inline: true
        },
        {
          name: 'Member Count',
          value: `${guild.memberCount}`,
          inline: true
        },
        {
          name: `Roles [${member.roles.cache.size - 1}]`,
          value: roleValue
        }
      )
      .setFooter({
        text: `ID: ${member.id}`
      })
      .setTimestamp();

    leaveLogChannel
      .send({ embeds: [embed] })
      .catch(() => {});
  });

  // ===== MEMBER UPDATE =====
  // Handles:
  // 1. Server boost detection
  // 2. Forced nickname enforcement
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const key =
      `${newMember.guild.id}_${newMember.id}`;

    // ===== BOOST DETECTION =====
    if (
      !oldMember.premiumSince &&
      newMember.premiumSince
    ) {
      const boostChannelId =
        boostLogChannels[newMember.guild.id];

      if (boostChannelId) {
        const boostChannel =
          newMember.guild.channels.cache.get(
            boostChannelId
          );

        if (boostChannel) {
          const msg = await boostChannel
            .send(
              `<@${newMember.id}> has boosted the server!`
            )
            .catch(() => null);

          if (msg) {
            await msg.react('❤️').catch(() => {});
          }
        }
      }
    }

    // ===== FORCED NICKNAME =====
    if (!forcedNicks.has(key)) return;

    const forcedNick = forcedNicks.get(key);

    if (newMember.nickname !== forcedNick) {
      await newMember
        .setNickname(forcedNick)
        .catch(() => {});
    }
  });

  // ===== MEMBER JOIN =====
  client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;

    // ===== JOIN LOG =====
    const joinLogId = joinLogChannels[guild.id];

    if (
      joinLogId &&
      !hardbannedUsers.has(member.id)
    ) {
      const joinLogChannel =
        guild.channels.cache.get(joinLogId);

      if (joinLogChannel) {
        const accountAge = Math.floor(
          (Date.now() - member.user.createdAt) /
          (1000 * 60 * 60 * 24)
        );

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setAuthor({
            name: `${member.user.tag} joined`,
            iconURL: member.user.displayAvatarURL({
              dynamic: true
            })
          })
          .setThumbnail(
            member.user.displayAvatarURL({
              dynamic: true,
              size: 256
            })
          )
          .addFields(
            {
              name: 'User',
              value: `<@${member.id}>`,
              inline: true
            },
            {
              name: 'Member Count',
              value: `${guild.memberCount}`,
              inline: true
            },
            {
              name: 'Account Age',
              value:
                `${accountAge} day` +
                `${accountAge !== 1 ? 's' : ''}`,
              inline: true
            }
          )
          .setFooter({
            text: `ID: ${member.id}`
          })
          .setTimestamp();

        joinLogChannel
          .send({
            content:
              `Welcome to **${guild.name}**, ` +
              `<@${member.id}>! 🎉`,
            embeds: [embed]
          })
          .catch(() => {});
      }
    }

    // ===== AUTOROLE =====
    const roleId = autoroles[guild.id];

    if (
      roleId &&
      !hardbannedUsers.has(member.id)
    ) {
      try {
        const role = guild.roles.cache.get(roleId);

        if (role) {
          await member.roles.add(role);
        }
      } catch (err) {
        console.error(
          'Autorole failed:',
          err.message
        );
      }
    }

    // ===== HARDBAN WATCHLIST =====
    if (hardbannedUsers.has(member.id)) {
      const reason =
        hardbannedUsers.get(member.id) ||
        'No reason';

      try {
        await member.send(
          `You have been hardbanned from **${guild.name}**.\n` +
          `Reason: ${reason}\n` +
          `DM "hxdisns" to appeal this sanction.`
        ).catch(() => null);

        await guild.members.ban(member.id, {
          reason
        });

        const channel = guild.channels.cache.find(
          channel =>
            channel.name === 'chat' &&
            channel.isTextBased()
        );

        if (channel) {
          await channel.send(
            `🚫 **${member.user.tag}** joined and ` +
            `was automatically hardbanned.\n` +
            `**Reason:** ${reason}`
          );
        }
      } catch (err) {
        console.error(
          'Auto-hardban failed:',
          err
        );
      }
    }
  });
  // ===== ERROR HANDLING =====
  client.on('error', err => {
    console.error('Discord client error:', err);
  });

  client.on('warn', info => {
    console.warn('Discord warning:', info);
  });

  client.on('disconnect', () => {
    console.log(
      'Bot disconnected, attempting to reconnect...'
    );
  });

  client.on('reconnecting', () => {
    console.log('Bot reconnecting...');
  });

  process.on('unhandledRejection', err => {
    console.error(
      'Unhandled promise rejection:',
      err
    );
  });

  process.on('uncaughtException', err => {
    console.error(
      'Uncaught exception:',
      err
    );
  });

  // ===== /ch1p ROLE SYSTEM =====
  client.on('presenceUpdate', async (oldPresence, newPresence) => {
    try {
      if (!newPresence || !newPresence.member) return;

      const member = newPresence.member;

      const role = member.guild.roles.cache.get(ROLE_ID);
      const logChannel =
        member.guild.channels.cache.get(LOG_CHANNEL_ID);

      if (!role) return;

      const hasCh1p =
        newPresence.activities?.some(activity =>
          activity.type === 4 &&
          activity.state?.toLowerCase().includes('/ch1p')
        );

      if (hasCh1p) {
        if (!member.roles.cache.has(role.id)) {
          await member.roles.add(role);

          if (logChannel) {
            await logChannel.send(
              `${member.user.tag} **Thank you** for repping ` +
              `**/ch1p!** Enjoy your pic & gif perms ` +
              `<:smileheart:1516033429031092325>`
            );
          }
        }
      } else {
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);

          if (logChannel) {
            await logChannel.send(
              `⚠️ ${member.user.tag} stopped repping /ch1p`
            );
          }
        }
      }
    } catch (err) {
      console.error(
        'ch1p system error:',
        err
      );
    }
  });

  // ===== LOGIN =====
  client.login(process.env.TOKEN);
