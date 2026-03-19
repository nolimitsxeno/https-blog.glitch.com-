const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const express = require('express');

// ===== WEB SERVER FOR UPTIME =====
const app = express();
const PORT = 3000;
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ===== BOT SETUP =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== PREFIX & WHITELIST =====
const PREFIX = ",";
const WHITELIST = [
  "1375128465430417610" // Replace with your Discord ID, add more if needed
];

// ===== Load hardbans =====
let hardbannedUsers = new Map();
if (fs.existsSync('hardbans.json')) {
  const data = JSON.parse(fs.readFileSync('hardbans.json'));
  hardbannedUsers = new Map(Object.entries(data));
}

// ===== Save function =====
function saveHardbans() {
  fs.writeFileSync('hardbans.json', JSON.stringify(Object.fromEntries(hardbannedUsers)));
}

// ===== READY =====
client.once('ready', () => {
  console.log(`Bot is online as ${client.user.tag}`);
});

// ===== COMMAND HANDLER =====
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===== GENERAL COMMANDS =====
  if (command === "ping") return message.reply("Pong!");
  if (command === "help") return message.reply("Commands: ,ping, ,help, ,userinfo, ,say, ,ban, ,hardban, ,hardunban");
  if (command === "userinfo") return message.reply(`Your username: ${message.author.tag}`);

  // ===== SAY COMMAND (WHITELIST ONLY) =====
  if (command === "say") {
    if (!WHITELIST.includes(message.author.id)) return message.reply("You can't use this command.");
    const text = args.join(" ");
    if (!text) return message.reply("You need to provide text to say!");
    message.channel.send(text);
  }

  // ===== BAN =====
  if (command === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("No permission.");
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    if (user.id === message.author.id) return message.reply("You can't ban yourself.");
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("Can't ban an admin.");
    try { await message.guild.members.ban(user.id); message.reply(`${user.tag} banned.`); } catch { message.reply("Ban failed."); }
  }

  // ===== HARDBAN =====
  if (command === "hardban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("No permission.");
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user.');
    if (user.id === message.author.id) return message.reply("You can't hardban yourself.");
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("Can't hardban an admin.");
    const reason = args.join(' ') || 'No reason';
    try {
      await message.guild.members.ban(user.id, { reason });
      hardbannedUsers.set(user.id, reason);
      saveHardbans();
      await message.react('👍'); // React instead of message
    } catch { message.reply("Hardban failed."); }
  }

  // ===== HARDUNBAN =====
  if (command === "hardunban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("No permission.");
    const userId = args[0];
    if (!userId) return message.reply('Provide user ID.');
    if (!hardbannedUsers.has(userId)) return message.reply('Not hardbanned.');
    try {
      hardbannedUsers.delete(userId);
      saveHardbans();
      await message.guild.members.unban(userId);
      message.reply(`User un-hardbanned.`);
    } catch { message.reply("Failed."); }
  }
});

// ===== AUTO REBAN =====
client.on('guildBanRemove', async (ban) => {
  const user = ban.user;
  const guild = ban.guild;
  if (hardbannedUsers.has(user.id)) {
    try {
      await guild.members.ban(user.id);
      const channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased());
      if (channel) channel.send(`${user.tag} was re-banned automatically.`);
    } catch (err) { console.error(err); }
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);