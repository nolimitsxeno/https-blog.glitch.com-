const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes } = require('discord.js');
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
  ]
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
      '`,clearwarns @user` — clear all warnings\n' +
      '`,slowmode <seconds>` — set channel slowmode\n' +
      '`,lock [reason]` — lock a channel\n' +
      '`,unlock` — unlock a channel\n' +
      '`,nick @user <nickname>` — change a user\'s nickname\n' +
      '`,fn @user <nickname>` — force-lock a user\'s nickname\n' +
      '`,fnc @user` — remove forced nickname\n' +
      '`,role @user <role name>` — add/remove a role\n' +
      '`,whitelist @user` — whitelist a user (owner only)\n' +
      '`/say` — make bot say something (slash)\n' +
      '`/dm` — DM a user as the bot (slash)\n' +
      '`/autorole` — set join role (slash)\n' +
      '`/invite` — get bot invite link (slash)'
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
    if (!timeArg) return message.reply('Provide a duration. Examples: `30s`, `10m`, `1h`, `1d`');

    const timeUnits = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = timeArg.match(/^(\d+)(s|m|h|d)?$/i);
    if (!match) return message.reply('Invalid duration. Examples: `30s`, `10m`, `1h`, `1d`');

    const value = parseInt(match[1]);
    const unit = match[2] ? match[2].toLowerCase() : 'm';
    const ms = value * timeUnits[unit];

    if (ms < 5000) return message.reply('Minimum mute duration is 5 seconds.');
    if (ms > 28 * 24 * 60 * 60 * 1000) return message.reply('Maximum mute duration is 28 days.');

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
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
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
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
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
