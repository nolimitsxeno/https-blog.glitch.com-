const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

const PREFIX = ",";
const OWNER_ID = "1375128465430417610";

// ===== Load data files =====
let whitelist = fs.existsSync('whitelist.json') ? JSON.parse(fs.readFileSync('whitelist.json')) : [OWNER_ID];
function saveWhitelist() { fs.writeFileSync('whitelist.json', JSON.stringify(whitelist)); }

let hardbannedUsers = fs.existsSync('hardbans.json') ? new Map(Object.entries(JSON.parse(fs.readFileSync('hardbans.json')))) : new Map();
function saveHardbans() { fs.writeFileSync('hardbans.json', JSON.stringify(Object.fromEntries(hardbannedUsers))); }

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

let activeChannels = fs.existsSync('activechannels.json') ? JSON.parse(fs.readFileSync('activechannels.json')) : {};
function saveActiveChannels() { fs.writeFileSync('activechannels.json', JSON.stringify(activeChannels)); }

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Message, Partials.Channel]
});

// ===== Ready =====
client.once('ready', () => {
    console.log(`Bot online as ${client.user.tag}`);

    // /active messages every 2 hours
    setInterval(() => {
        for (const [guildId, channelId] of Object.entries(activeChannels)) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            const channel = guild.channels.cache.get(channelId);
            if (channel) channel.send('Hello guys!');
        }
    }, 2 * 60 * 60 * 1000); // 2 hours
});

// ===== Logging events =====
client.on('messageDelete', async message => {
    if (!message.guild) return;
    const channelId = logChannels[message.guild.id];
    if (!channelId) return;
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) return;
    let content = message.content || '[No text]';
    if (message.attachments.size) content += `\nAttachments: ${message.attachments.map(a => a.url).join(', ')}`;
    channel.send(`🗑️ **Deleted message from ${message.author.tag}:** ${content}`);
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild) return;
    const channelId = logChannels[oldMessage.guild.id];
    if (!channelId) return;
    const channel = oldMessage.guild.channels.cache.get(channelId);
    if (!channel) return;
    if (oldMessage.content === newMessage.content) return;
    channel.send(`✏️ **Edited message by ${oldMessage.author.tag}:**\nBefore: ${oldMessage.content}\nAfter: ${newMessage.content}`);
});

// ===== Guild events =====
client.on('guildMemberAdd', member => {
    const roleId = autoroles[member.guild.id];
    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) member.roles.add(role).catch(console.error);
    }

    const channelId = joinLogChannels[member.guild.id];
    if (!channelId) return;
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('Member Joined')
        .setDescription(`${member} has joined the server!`) // ping user
        .addFields({ name: 'Account Created', value: `${member.user.createdAt.toUTCString()}` })
        .setColor('Green')
        .setTimestamp();
    channel.send({ embeds: [embed] });
});

client.on('guildMemberRemove', member => {
    const channelId = leaveLogChannels[member.guild.id];
    if (!channelId) return;
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setTitle('Member Left')
        .setDescription(`${member.user.tag} left the server.`)
        .setColor('Red')
        .setTimestamp();
    channel.send({ embeds: [embed] });
});

// ===== Prefix commands =====
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'hb') {
        if (!args[0]) return; // do nothing if invalid
        let userId;
        try {
            if (message.mentions.users.size) userId = message.mentions.users.first().id;
            else userId = args[0].replace(/[<@!>]/g, '');
            await client.users.fetch(userId);
        } catch { return; } // invalid user, do nothing
        if (!hardbannedUsers.has(userId)) {
            hardbannedUsers.set(userId, true);
            saveHardbans();
        }
        const member = message.guild.members.cache.get(userId);
        if (member) member.ban({ reason: 'Hardbanned by bot' }).catch(() => { });
        await message.reply('👍'); // only thumbs up
    }
});

// ===== Slash commands =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'logs') {
        // Save the channel for logging
        logChannels[interaction.guild.id] = interaction.channel.id;
        saveLogChannels();
        await interaction.reply({ content: `Logging enabled in ${interaction.channel}`, ephemeral: true });
    }

    // /logboosts untouched
});

// ===== Login =====
client.login(process.env.TOKEN);
