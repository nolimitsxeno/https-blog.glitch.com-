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

    setInterval(() => {
        try {
            for (const [guildId, channelId] of Object.entries(activeChannels)) {
                const guild = client.guilds.cache.get(guildId);
                if (!guild) continue;
                const channel = guild.channels.cache.get(channelId);
                if (channel) channel.send('Hello guys!');
            }
        } catch (err) {
            console.error('Active error:', err);
        }
    }, 2 * 60 * 60 * 1000);
});

// ===== Join =====
client.on('guildMemberAdd', member => {
    try {
        const roleId = autoroles[member.guild.id];
        if (roleId) {
            const role = member.guild.roles.cache.get(roleId);
            if (role) member.roles.add(role).catch(() => {});
        }

        const channelId = joinLogChannels[member.guild.id];
        if (!channelId) return;
        const channel = member.guild.channels.cache.get(channelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('Member Joined')
            .setDescription(`${member} has joined the server!`)
            .addFields({ name: 'Account Created', value: member.user.createdAt.toUTCString() })
            .setColor('Green')
            .setTimestamp();

        channel.send({ embeds: [embed] });

    } catch (err) {
        console.error('Join error:', err);
    }
});

// ===== Leave =====
client.on('guildMemberRemove', member => {
    try {
        const channelId = leaveLogChannels[member.guild.id] || joinLogChannels[member.guild.id];
        if (!channelId) return;
        const channel = member.guild.channels.cache.get(channelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('Member Left')
            .setDescription(`${member} has left the server.`)
            .setColor('Red')
            .setTimestamp();

        channel.send({ embeds: [embed] });

    } catch (err) {
        console.error('Leave error:', err);
    }
});

// ===== Prefix =====
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        if (command === 'hb') {
            let userId;
            try {
                if (message.mentions.users.size) userId = message.mentions.users.first().id;
                else userId = args[0];
                await client.users.fetch(userId);
            } catch { return; }

            if (!hardbannedUsers.has(userId)) {
                hardbannedUsers.set(userId, true);
                saveHardbans();
            }

            const member = message.guild.members.cache.get(userId);
            if (member) member.ban().catch(() => {});
            message.reply('👍');
        }
    } catch (err) {
        console.error('Prefix error:', err);
    }
});

// ===== SLASH COMMANDS (FIXED) =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.commandName;

        if (name === 'logs') {
            logChannels[interaction.guild.id] = interaction.channel.id;
            saveLogChannels();
            await interaction.editReply(`Logging enabled in ${interaction.channel}`);
        }

        if (name === 'logboosts') {
            boostLogChannels[interaction.guild.id] = interaction.channel.id;
            saveBoostLog();
            await interaction.editReply(`Boost logs enabled in ${interaction.channel}`);
        }

        if (name === 'logjoins') {
            joinLogChannels[interaction.guild.id] = interaction.channel.id;
            saveJoinLog();
            await interaction.editReply(`Join logs enabled in ${interaction.channel}`);
        }

        if (name === 'logleaves') {
            leaveLogChannels[interaction.guild.id] = interaction.channel.id;
            saveLeaveLog();
            await interaction.editReply(`Leave logs enabled in ${interaction.channel}`);
        }

        if (name === 'autorole') {
            const role = interaction.options.getRole('role');
            if (!role) return interaction.editReply('❌ Select a role.');
            autoroles[interaction.guild.id] = role.id;
            saveAutoroles();
            await interaction.editReply(`Autorole set to ${role}`);
        }

        if (name === 'active') {
            activeChannels[interaction.guild.id] = interaction.channel.id;
            saveActiveChannels();
            await interaction.editReply(`Active messages enabled here.`);
        }

    } catch (err) {
        console.error('Slash error:', err);
        if (interaction.deferred) {
            await interaction.editReply('❌ Error occurred.');
        }
    }
});

client.login(process.env.TOKEN);
