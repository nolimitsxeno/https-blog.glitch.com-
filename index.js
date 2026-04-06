const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http');

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

// ===== Keep-alive web server =====
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is alive!');
}).listen(5000, () => {
  console.log('Keep-alive server running on port 5000');
});

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
        }
      ]
    });
    console.log('Slash commands registered');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }

  // ===== 12-hour auto-message =====
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

// ===== Slash Command Handler =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'say') {
    if (!whitelist.includes(interaction.user.id)) {
      return interaction.reply({ content: "You do not have permission to use this.", ephemeral: true });
    }
    const text = interaction.options.getString('text');
    await interaction.reply({ content: '✅', ephemeral: true });
    await interaction.channel.send(text);
    await notifyOwner(interaction.user, '/say', `"${text}" in #${interaction.channel.name} (${interaction.guild.name})`);
  }

  if (interaction.commandName === 'invite') {
    const link = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`;
    await interaction.reply({ content: `**Bot Invite Link:**\n${link}`, ephemeral: true });
    await notifyOwner(interaction.user, '/invite', `Requested invite link in ${interaction.guild.name}`);
  }

  if (interaction.commandName === 'logjoins') {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: "Only the bot owner can use this.", ephemeral: true });
    const channel = interaction.options.getChannel('channel');
    if (!channel) {
      delete joinLogChannels[interaction.guild.id];
      saveJoinLog();
      return interaction.reply({ content: 'Join logging has been **disabled**.', ephemeral: true });
    }
    joinLogChannels[interaction.guild.id] = channel.id;
    saveJoinLog();
    return interaction.reply({ content: `✅ Join logs will be sent to ${channel}.`, ephemeral: true });
  }

  if (interaction.commandName === 'logleaves') {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: "Only the bot owner can use this.", ephemeral: true });
    const channel = interaction.options.getChannel('channel');
    if (!channel) {
      delete leaveLogChannels[interaction.guild.id];
      saveLeaveLog();
      return interaction.reply({ content: 'Leave logging has been **disabled**.', ephemeral: true });
    }
    leaveLogChannels[interaction.guild.id] = channel.id;
    saveLeaveLog();
    return interaction.reply({ content: `✅ Leave logs will be sent to ${channel}.`, ephemeral: true });
  }

  if (interaction.commandName === 'active') {
    if (!whitelist.includes(interaction.user.id)) {
      return interaction.reply({ content: "You do not have permission to use this.", ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel');
    if (!channel) {
      delete activeChannels[interaction.guild.id];
      saveActiveChannels();
      return interaction.reply({ content: 'Auto-message has been **disabled** for this server.', ephemeral: true });
    }
    activeChannels[interaction.guild.id] = channel.id;
    saveActiveChannels();
    return interaction.reply({ content: `✅ The bot will now say **Hello guys!** in ${channel} every 12 hours.`, ephemeral: true });
  }

  if (interaction.commandName === 'logs') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "Only the bot owner can use this command.", ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel');
    if (!channel) {
      delete logChannels[interaction.guild.id];
      saveLogChannels();
      return interaction.reply({ content: 'Message logging has been **disabled** for this server.', ephemeral: true });
    }
    logChannels[interaction.guild.id] = channel.id;
    saveLogChannels();
    return interaction.reply({ content: `Logs will now be sent to ${channel}.`, ephemeral: true });
  }

  if (interaction.commandName === 'unwhitelist') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "Only the bot owner can use this command.", ephemeral: true });
    }
    const target = interaction.options.getUser('user');
    if (!whitelist.includes(target.id)) {
      return interaction.reply({ content: `**${target.username}** is not on the whitelist.`, ephemeral: true });
    }
    if (target.id === OWNER_ID) {
      return interaction.reply({ content: "You can't remove yourself from the whitelist.", ephemeral: true });
    }
    whitelist = whitelist.filter(id => id !== target.id);
    saveWhitelist();
    return interaction.reply({ content: `**${target.username}** has been removed from the whitelist.`, ephemeral: true });
  }

  if (interaction.commandName === 'dm') {
    if (!whitelist.includes(interaction.user.id)) {
      return interaction.reply({ content: "You do not have permission to use this.", ephemeral: true });
    }
    const target = interaction.options.getUser('user');
    const msg = interaction.options.getString('message');
    try {
      await target.send(msg);
      await interaction.reply({ content: `✅ DM sent to **${target.tag}**.`, ephemeral: true });
      await notifyOwner(interaction.user, '/dm', `Sent DM to ${target.tag} (${target.id}): "${msg}" — in ${interaction.guild.name}`);
    } catch (err) {
      await interaction.reply({ content: `❌ Could not DM **${target.tag}**. They may have DMs disabled.`, ephemeral: true });
    }
  }

  if (interaction.commandName === 'autorole') {
    if (!whitelist.includes(interaction.user.id)) {
      return interaction.reply({ content: "You do not have permission to use this.", ephemeral: true });
    }
    const role = interaction.options.getRole('role');
    if (!role) {
      delete autoroles[interaction.guild.id];
      saveAutoroles();
      return interaction.reply({ content: 'Autorole has been **disabled** for this server.', ephemeral: true });
    }
    autoroles[interaction.guild.id] = role.id;
    saveAutoroles();
    await interaction.reply({ content: `Autorole set! New members will automatically receive the **${role.name}** role.`, ephemeral: true });
    await notifyOwner(interaction.user, '/autorole', `Set autorole to "${role.name}" in ${interaction.guild.name}`);
  }
});

// ===== Commands =====
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(' ');
  const command = args.shift().toLowerCase();

  if (!whitelist.includes(message.author.id)) {
    return message.reply("You do not have permission to use this bot.");
  }

  // ===== Log command usage to owner =====
  if (message.author.id !== OWNER_ID) {
    notifyOwner(
      message.author,
      `,${command}`,
      `Full message: \`${message.content}\` | Server: ${message.guild.name} | Channel: #${message.channel.name}`
    );
  }

  // ===== WHITELIST =====
  if (command === 'whitelist') {
    if (message.author.id !== OWNER_ID) return message.reply("Only the bot owner can use this command.");
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user to whitelist.');
    if (whitelist.includes(user.id)) return message.reply(`**${user.username}** is already whitelisted.`);
    whitelist.push(user.id);
    saveWhitelist();
    return message.reply(`**${user.username}** has been whitelisted to use the bot!`);
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
      '`,mute @user <minutes> [reason]` — timeout a user\n' +
      '`,unmute @user` — remove timeout\n' +
      '`,warn @user <reason>` — warn a user\n' +
      '`,warnings [@user]` — view warnings\n' +
      '`,clearwarns @user` — clear all warnings\n' +
      '`,slowmode <seconds>` — set channel slowmode\n' +
      '`,lock [reason]` — lock a channel\n' +
      '`,unlock` — unlock a channel\n' +
      '`,nick @user <nickname>` — change a user\'s nickname\n' +
      '`,fn @user <nickname>` — force-lock a user\'s nickname\n' +
      '`,fnc @user` — remove forced nickname\n' +
      '`,role @user <role name>` — add/remove a role\n' +
      '`,whitelist @user` — whitelist a user (owner only)'
    );
  }

  // ===== USERINFO =====
  if (command === 'userinfo') {
    const target = message.mentions.members.first() || message.member;
    const user = target.user;
    return message.reply(
      `**User:** ${user.tag}\n` +
      `**ID:** ${user.id}\n` +
      `**Joined Server:** ${target.joinedAt.toDateString()}\n` +
      `**Account Created:** ${user.createdAt.toDateString()}\n` +
      `**Roles:** ${target.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.name).join(', ') || 'None'}`
    );
  }

  // ===== AVATAR =====
  if (command === 'avatar') {
    const target = message.mentions.users.first() || message.author;
    return message.reply(target.displayAvatarURL({ size: 512, dynamic: true }));
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
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("No permission.");
    }
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply("Provide a number between 1 and 100.");
    }
    try {
      await message.delete();
      const deleted = await message.channel.bulkDelete(amount, true);
      const confirm = await message.channel.send(`Successfully purged ${deleted.size} messages.`);
      setTimeout(() => confirm.delete().catch(() => null), 3000);
    } catch {
      message.channel.send("Purge failed. Messages older than 14 days can't be bulk deleted.");
    }
  }

  // ===== KICK =====
  if (command === 'kick') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    if (user.id === message.author.id) return message.reply("You can't kick yourself.");
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return message.reply("User not found in server.");
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Can't kick an admin.");
    }
    const reason = args.filter(a => !a.match(/^<@!?\d+>$/)).join(' ') || 'No reason';
    try {
      await member.kick(reason);
      message.reply(`**${user.tag}** has been kicked. Reason: ${reason}`);
    } catch {
      message.reply("Kick failed.");
    }
  }

  // ===== MUTE (timeout) =====
  if (command === 'mute') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return message.reply("User not found in server.");

    const timeArg = args.filter(a => !a.match(/^<@!?\d+>$/))[0];
    if (!timeArg) return message.reply('Provide a duration. Examples: `30s`, `10m`, `1h`, `1d`, or just `10` (minutes).');

    const timeUnits = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = timeArg.match(/^(\d+)(s|m|h|d)?$/i);
    if (!match) return message.reply('Invalid duration. Examples: `30s`, `10m`, `1h`, `1d`, or just `10` (minutes).');

    const value = parseInt(match[1]);
    const unit = match[2] ? match[2].toLowerCase() : 'm';
    const ms = value * timeUnits[unit];

    if (ms < 5000) return message.reply('Minimum mute duration is 5 seconds.');
    if (ms > 28 * 24 * 60 * 60 * 1000) return message.reply('Maximum mute duration is 28 days (Discord limit).');

    const unitLabels = { s: 'second(s)', m: 'minute(s)', h: 'hour(s)', d: 'day(s)' };
    const displayTime = `${value} ${unitLabels[unit]}`;

    const reason = args.filter(a => !a.match(/^<@!?\d+>$/) && !a.match(/^\d+(s|m|h|d)?$/i)).join(' ') || 'No reason';

    try {
      await user.send(`You have been timed out in **${message.guild.name}** by **${message.author.tag}** for ${displayTime}. Reason: ${reason}`).catch(() => null);
      await member.timeout(ms, reason);
      message.reply(`**${user.tag}** has been muted for ${displayTime}. Reason: ${reason}`);
    } catch {
      message.reply("Mute failed.");
    }
  }

  // ===== UNMUTE =====
  if (command === 'unmute') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return message.reply("User not found in server.");
    try {
      await member.timeout(null);
      message.reply(`**${user.tag}** has been unmuted.`);
    } catch {
      message.reply("Unmute failed.");
    }
  }

  // ===== WARN =====
  if (command === 'warn') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    const reason = args.filter(a => !a.match(/^<@!?\d+>$/)).join(' ');
    if (!reason) return message.reply('Provide a reason.');
    const key = `${message.guild.id}_${user.id}`;
    const userWarnings = warnings.get(key) || [];
    userWarnings.push({ reason, by: message.author.tag, date: new Date().toDateString() });
    warnings.set(key, userWarnings);
    saveWarnings();
    await user.send(`You have been warned in **${message.guild.name}** by **${message.author.tag}**. Reason: ${reason}`).catch(() => null);
    message.reply(`**${user.tag}** has been warned. They now have ${userWarnings.length} warning(s).`);
  }

  // ===== WARNINGS =====
  if (command === 'warnings') {
    const user = message.mentions.users.first() || message.author;
    const key = `${message.guild.id}_${user.id}`;
    const userWarnings = warnings.get(key) || [];
    if (userWarnings.length === 0) return message.reply(`**${user.tag}** has no warnings.`);
    const list = userWarnings.map((w, i) => `${i + 1}. **${w.reason}** — by ${w.by} on ${w.date}`).join('\n');
    message.reply(`**Warnings for ${user.tag}:**\n${list}`);
  }

  // ===== CLEARWARNS =====
  if (command === 'clearwarns') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    const key = `${message.guild.id}_${user.id}`;
    warnings.delete(key);
    saveWarnings();
    message.reply(`All warnings cleared for **${user.tag}**.`);
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
      message.reply(seconds === 0 ? "Slowmode disabled." : `Slowmode set to ${seconds} second(s).`);
    } catch {
      message.reply("Failed to set slowmode.");
    }
  }

  // ===== LOCK =====
  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("No permission.");
    }
    const reason = args.join(' ') || 'No reason';
    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });
      message.channel.send(`🔒 Channel locked. Reason: ${reason}`);
    } catch {
      message.reply("Failed to lock channel.");
    }
  }

  // ===== UNLOCK =====
  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("No permission.");
    }
    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });
      message.channel.send(`🔓 Channel unlocked.`);
    } catch {
      message.reply("Failed to unlock channel.");
    }
  }

  // ===== NICK =====
  if (command === 'nick') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    const nick = args.filter(a => !a.match(/^<@!?\d+>$/)).join(' ');
    if (!nick) return message.reply('Provide a nickname.');
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return message.reply("User not found in server.");
    try {
      await member.setNickname(nick);
      message.reply(`Nickname for **${user.tag}** set to **${nick}**.`);
    } catch {
      message.reply("Failed to change nickname.");
    }
  }

  // ===== FORCE NICKNAME =====
  if (command === 'fn') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    const nick = args.filter(a => !a.match(/^<@!?\d+>$/)).join(' ');
    if (!nick) return message.reply('Provide a nickname to force.');
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return message.reply("User not found in server.");
    const key = `${message.guild.id}_${user.id}`;
    try {
      await member.setNickname(nick);
      forcedNicks.set(key, nick);
      saveForcedNicks();
      message.reply(`**${user.tag}**'s nickname is now force-locked to **${nick}**.`);
    } catch {
      message.reply("Failed to set forced nickname.");
    }
  }

  // ===== CANCEL FORCE NICKNAME =====
  if (command === 'fnc') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    const key = `${message.guild.id}_${user.id}`;
    if (!forcedNicks.has(key)) return message.reply("That user doesn't have a forced nickname.");
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    forcedNicks.delete(key);
    saveForcedNicks();
    if (member) await member.setNickname(null).catch(() => null);
    message.reply(`Force nickname removed for **${user.tag}**. Their nickname has been reset.`);
  }

  // ===== ROLE =====
  if (command === 'role') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    const roleName = args.filter(a => !a.match(/^<@!?\d+>$/)).join(' ');
    if (!roleName) return message.reply('Provide a role name.');
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) return message.reply(`Role "${roleName}" not found.`);
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return message.reply("User not found in server.");
    try {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        message.reply(`Removed **${role.name}** from **${user.tag}**.`);
      } else {
        await member.roles.add(role);
        message.reply(`Added **${role.name}** to **${user.tag}**.`);
      }
    } catch {
      message.reply("Failed to update role. Make sure the bot's role is above the target role.");
    }
  }

  // ===== BAN =====
  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    if (user.id === message.author.id) return message.reply("You can't ban yourself.");
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Can't ban an admin.");
    }
    const reason = args.filter(a => !a.match(/^<@!?\d+>$/)).join(' ') || 'No reason';
    try {
      await message.guild.members.ban(user.id, { reason });
      message.reply(`**${user.tag}** banned. Reason: ${reason}`);
    } catch {
      message.reply("Ban failed.");
    }
  }

  // ===== HARDBAN =====
  if (command === 'hb') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("No permission.");
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    if (user.id === message.author.id) return message.reply("You can't hardban yourself.");
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Can't hardban an admin.");
    }
    const reason = args.filter(a => !a.match(/^<@!?\d+>$/)).join(' ') || 'No reason';
    try {
      await user.send(`You have been banned from **${message.guild.name}** by **${message.author.tag}**. Reason: ${reason}`).catch(() => null);
      await message.guild.members.ban(user.id, { reason });
      hardbannedUsers.set(user.id, reason);
      saveHardbans();
      await message.channel.send('👍');
    } catch {
      message.reply("Hardban failed.");
    }
  }

  // ===== UNBAN =====
  if (command === 'unban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("No permission.");
    }
    const raw = args[0];
    if (!raw) return message.reply('Provide a user ID or mention.');
    const userId = raw.replace(/^<@!?/, '').replace(/>$/, '');
    try {
      await message.guild.members.unban(userId);
      message.reply(`User unbanned.`);
    } catch {
      message.reply("Unban failed. Make sure the user is actually banned.");
    }
  }

  // ===== BLACKTEA =====
  if (command === 'blacktea') {
    if (activeGames.has(message.channel.id)) {
      return message.reply('A game is already running in this channel!');
    }

    activeGames.set(message.channel.id, true);

    const joinMsg = await message.channel.send(
      `**🍵 Blacktea Word Chain Game!**\n` +
      `React with ✅ to join! You have **30 seconds**.\n` +
      `*Each turn you'll be given letters — say a word that contains them!*`
    );
    await joinMsg.react('✅');

    await new Promise(r => setTimeout(r, 30000));

    const fetchedMsg = await message.channel.messages.fetch(joinMsg.id);
    const reaction = fetchedMsg.reactions.cache.get('✅');
    let players = [];
    if (reaction) {
      const users = await reaction.users.fetch();
      players = users.filter(u => !u.bot).map(u => u);
    }

    if (players.length < 2) {
      activeGames.delete(message.channel.id);
      return message.channel.send('❌ Not enough players joined (need at least 2). Game cancelled.');
    }

    const alphabet = 'abcdefghijklmnoprstw';
    function randomLetters() {
      const count = Math.random() < 0.5 ? 1 : 2;
      let result = '';
      for (let i = 0; i < count; i++) result += alphabet[Math.floor(Math.random() * alphabet.length)];
      return result;
    }

    function getRequired(lastWord) {
      if (!lastWord) return randomLetters();
      if (Math.random() < 0.5) {
        const count = Math.random() < 0.5 ? 1 : 2;
        return lastWord.slice(-count);
      }
      return randomLetters();
    }

    players = players.sort(() => Math.random() - 0.5);
    const usedWords = new Set();
    let lastWord = null;
    let currentIndex = 0;

    const lives = new Map();
    for (const p of players) lives.set(p.id, 2);

    await message.channel.send(`**Game starting with ${players.length} players!**\n${players.map(p => p.toString()).join(', ')}\n❤️ Everyone starts with **2 lives**.`);

    while (players.length > 1) {
      currentIndex = currentIndex % players.length;
      const currentPlayer = players[currentIndex];
      const required = getRequired(lastWord);

      const prompt = `<@${currentPlayer.id}>, say a word containing **"${required.toUpperCase()}"**! ❤️ ${lives.get(currentPlayer.id)}/2 lives — 10 seconds!`;
      const promptMsg = await message.channel.send(prompt);

      const t1 = setTimeout(() => promptMsg.react('3️⃣').catch(() => {}), 7000);
      const t2 = setTimeout(() => promptMsg.react('2️⃣').catch(() => {}), 8000);
      const t3 = setTimeout(() => promptMsg.react('1️⃣').catch(() => {}), 9000);

      const filter = m => m.author.id === currentPlayer.id && /^[a-zA-Z]+$/.test(m.content.trim());
      let collected;
      let timedOut = false;
      try {
        collected = await message.channel.awaitMessages({ filter, max: 1, time: 10000, errors: ['time'] });
      } catch {
        timedOut = true;
      } finally {
        clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      }

      if (timedOut) {
        const remaining = lives.get(currentPlayer.id) - 1;
        lives.set(currentPlayer.id, remaining);
        if (remaining <= 0) {
          await message.channel.send(`💀 <@${currentPlayer.id}> took too long and has been **eliminated!**`);
          players.splice(currentIndex, 1);
          if (currentIndex >= players.length) currentIndex = 0;
        } else {
          await message.channel.send(`⏰ <@${currentPlayer.id}> took too long! Lost a life. ❤️ **${remaining} life remaining.**`);
          currentIndex++;
        }
        continue;
      }

      const wordMsg = collected.first();
      const word = wordMsg.content.trim().toLowerCase();

      if (!word.includes(required)) {
        const remaining = lives.get(currentPlayer.id) - 1;
        lives.set(currentPlayer.id, remaining);
        if (remaining <= 0) {
          await message.channel.send(`💀 <@${currentPlayer.id}> **"${word}"** doesn't contain **"${required.toUpperCase()}"**! **Eliminated!**`);
          players.splice(currentIndex, 1);
          if (currentIndex >= players.length) currentIndex = 0;
        } else {
          await message.channel.send(`❌ <@${currentPlayer.id}> **"${word}"** doesn't contain **"${required.toUpperCase()}"**! Lost a life. ❤️ **${remaining} life remaining.**`);
          currentIndex++;
        }
        continue;
      }

      if (usedWords.has(word)) {
        const remaining = lives.get(currentPlayer.id) - 1;
        lives.set(currentPlayer.id, remaining);
        if (remaining <= 0) {
          await message.channel.send(`💀 <@${currentPlayer.id}> **"${word}"** was already used! **Eliminated!**`);
          players.splice(currentIndex, 1);
          if (currentIndex >= players.length) currentIndex = 0;
        } else {
          await message.channel.send(`❌ <@${currentPlayer.id}> **"${word}"** was already used! Lost a life. ❤️ **${remaining} life remaining.**`);
          currentIndex++;
        }
        continue;
      }

      usedWords.add(word);
      lastWord = word;
      await wordMsg.react('✅');
      currentIndex++;
    }

    activeGames.delete(message.channel.id);
    if (players.length === 1) {
      message.channel.send(`🏆 <@${players[0].id}> **wins Blacktea!** Congratulations!`);
    } else {
      message.channel.send('The game has ended.');
    }
  }

  // ===== HARDUNBAN =====
  if (command === 'unhb') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("No permission.");
    }
    const raw = args[0];
    if (!raw) return message.reply('Provide a user ID or mention.');
    const userId = raw.replace(/^<@!?/, '').replace(/>$/, '');
    if (!hardbannedUsers.has(userId)) {
      return message.reply('That user is not in the hardban list.');
    }
    try {
      hardbannedUsers.delete(userId);
      saveHardbans();
      await message.guild.members.unban(userId);
      message.reply(`User un-hardbanned.`);
    } catch {
      message.reply("Failed to unban. They may have already been manually unbanned.");
    }
  }
});

// ===== MESSAGE DELETE LOGGER =====
client.on('messageDelete', async (message) => {
  if (!message.guild) return;
  if (message.author?.bot) return;

  const logChannelId = logChannels[message.guild.id];
  if (!logChannelId) return;

  const logChannel = message.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const author = message.author;
  const avatarURL = author ? author.displayAvatarURL({ dynamic: true }) : null;
  const tag = author ? author.tag : 'Unknown User';
  const userId = author ? author.id : 'Unknown';
  const channelMention = message.channel ? `<#${message.channel.id}>` : 'Unknown Channel';
  const content = message.content || '*No text content*';

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setAuthor({
      name: `${tag}`,
      iconURL: avatarURL || undefined
    })
    .setDescription(content)
    .addFields(
      { name: 'Author', value: author ? `<@${userId}>` : 'Unknown', inline: true },
      { name: 'Channel', value: channelMention, inline: true }
    )
    .setFooter({ text: `Message Deleted  •  User ID: ${userId}` })
    .setTimestamp();

  const imageAttachment = message.attachments?.find(a => a.contentType?.startsWith('image/'));
  if (imageAttachment) {
    embed.setImage(imageAttachment.url);
  }

  try {
    await logChannel.send({ embeds: [embed] });

    for (const [, attachment] of (message.attachments || [])) {
      if (!attachment.contentType?.startsWith('image/')) {
        await logChannel.send({
          content: `📎 Deleted file from **${tag}**:`,
          files: [attachment.url]
        }).catch(() => {
          logChannel.send(`📎 Deleted file from **${tag}** (could not repost): ${attachment.url}`);
        });
      }
    }
  } catch (err) {
    console.error('Failed to log deleted message:', err.message);
  }
});

// ===== LEAVE LOGGER =====
client.on('guildMemberRemove', async (member) => {
  const guild = member.guild;
  const leaveLogId = leaveLogChannels[guild.id];
  if (!leaveLogId) return;
  const leaveLogChannel = guild.channels.cache.get(leaveLogId);
  if (!leaveLogChannel) return;

  if (member.partial) {
    try { member = await member.fetch(); } catch { return; }
  }

  const roleList = member.roles?.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(r => `\`${r.name}\``)
    .join(', ') || 'None';

  const roleValue = roleList.length > 1024 ? roleList.slice(0, 1021) + '...' : roleList;

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setAuthor({ name: `${member.user.tag} left`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: 'User', value: `<@${member.id}>`, inline: true },
      { name: 'Member Count', value: `${guild.memberCount}`, inline: true },
      { name: `Roles [${member.roles.cache.size - 1}]`, value: roleValue }
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  leaveLogChannel.send({ embeds: [embed] }).catch(() => {});
});

// ===== AUTO REFORCE NICKNAME =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const key = `${newMember.guild.id}_${newMember.id}`;
  if (!forcedNicks.has(key)) return;
  const forcedNick = forcedNicks.get(key);
  if (newMember.nickname !== forcedNick) {
    await newMember.setNickname(forcedNick).catch(() => null);
  }
});

// ===== AUTO REBAN ON JOIN =====
client.on('guildMemberAdd', async (member) => {
  const guild = member.guild;

  // ===== JOIN LOG =====
  const joinLogId = joinLogChannels[guild.id];
  if (joinLogId && !hardbannedUsers.has(member.id)) {
    const joinLogChannel = guild.channels.cache.get(joinLogId);
    if (joinLogChannel) {
      const accountAge = Math.floor((Date.now() - member.user.createdAt) / (1000 * 60 * 60 * 24));
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setAuthor({ name: `${member.user.tag} joined`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Member Count', value: `${guild.memberCount}`, inline: true },
          { name: 'Account Age', value: `${accountAge} day${accountAge !== 1 ? 's' : ''}`, inline: true }
        )
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
      joinLogChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  // ===== AUTOROLE =====
  const roleId = autoroles[guild.id];
  if (roleId && !hardbannedUsers.has(member.id)) {
    try {
      const role = guild.roles.cache.get(roleId);
      if (role) await member.roles.add(role);
    } catch (err) {
      console.error('Autorole failed:', err.message);
    }
  }

  // ===== HARDBAN REBAN =====
  if (hardbannedUsers.has(member.id)) {
    try {
      await member.send(`You have been rehardbanned in **${guild.name}**. DM "hxdisns" to appeal this sanction.`).catch(() => null);
      await guild.members.ban(member.id);
      const channel = guild.channels.cache.find(c => c.name === 'chat' && c.isTextBased());
      if (channel) {
        channel.send(`${member.user.tag} attempted to rejoin and was automatically re-banned.`);
      }
    } catch (err) {
      console.error(err);
    }
  }
});

// ===== ERROR HANDLING =====
client.on('error', err => console.error('Discord client error:', err));
client.on('warn', info => console.warn('Discord warning:', info));
client.on('disconnect', () => console.log('Bot disconnected, attempting to reconnect...'));
client.on('reconnecting', () => console.log('Bot reconnecting...'));

process.on('unhandledRejection', err => console.error('Unhandled promise rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));

// ===== LOGIN =====
client.login(process.env.TOKEN);
