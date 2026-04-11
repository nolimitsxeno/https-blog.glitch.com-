const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(process.env.PORT || 5000);

// ===== SAFE VOICE IMPORT (PREVENT CRASH) =====
let voice;
try {
    voice = require('@discordjs/voice');
} catch (e) {
    console.log('⚠️ Voice module not installed. VC features disabled.');
}

// ===== STORAGE =====
function load(file) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}; }
function save(file, data) { fs.writeFileSync(file, JSON.stringify(data)); }

let logChannels = load('logchannels.json');
let joinLogChannels = load('joinlog.json');
let leaveLogChannels = load('leavelog.json');
let boostLogChannels = load('boostlog.json');
let autoroles = load('autorole.json');
let activeChannels = load('activechannels.json');
let forceRoles = load('forceroles.json');
let vcStay = load('vcstay.json');

// ===== CLIENT =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel]
});

// ===== READY =====
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // ===== SLASH COMMANDS =====
    const commands = [
        new SlashCommandBuilder().setName('logs').setDescription('Set logs channel'),
        new SlashCommandBuilder().setName('logjoins').setDescription('Set join logs'),
        new SlashCommandBuilder().setName('logleaves').setDescription('Set leave logs'),
        new SlashCommandBuilder().setName('logboosts').setDescription('Set boost logs'),

        new SlashCommandBuilder()
            .setName('autorole')
            .setDescription('Set autorole')
            .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),

        new SlashCommandBuilder()
            .setName('active')
            .setDescription('Set active channel'),

        new SlashCommandBuilder()
            .setName('say')
            .setDescription('Say something')
            .addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),

        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('DM user')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addStringOption(o => o.setName('text').setRequired(true)),

        new SlashCommandBuilder()
            .setName('forcerole')
            .setDescription('Force role')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addRoleOption(o => o.setName('role').setRequired(true)),

        new SlashCommandBuilder()
            .setName('unforcerole')
            .setDescription('Unforce role')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addRoleOption(o => o.setName('role').setRequired(true)),

        new SlashCommandBuilder()
            .setName('status')
            .setDescription('Set bot status')
            .addStringOption(o => o.setName('text').setRequired(true))
            .addIntegerOption(o => o.setName('type').setRequired(false)),

        new SlashCommandBuilder()
            .setName('stayvc')
            .setDescription('Bot stay in VC'),

        new SlashCommandBuilder()
            .setName('unstayvc')
            .setDescription('Stop VC stay')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Slash commands registered');
    } catch (err) {
        console.error(err);
    }

    // ===== VC REJOIN (SAFE) =====
    if (voice) {
        for (const [guildId, channelId] of Object.entries(vcStay)) {
            const guild = client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(channelId);

            if (!guild || !channel) continue;

            voice.joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator
            });
        }
    }

    // ACTIVE LOOP
    setInterval(() => {
        for (const [guildId, channelId] of Object.entries(activeChannels)) {
            const channel = client.guilds.cache.get(guildId)?.channels.cache.get(channelId);
            if (channel) channel.send("Hello guys!");
        }
    }, 2 * 60 * 60 * 1000);
});

// ===== FORCE ROLE =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const data = forceRoles[newMember.guild.id];
    if (!data) return;

    const roles = data[newMember.id];
    if (!roles) return;

    for (const roleId of roles) {
        if (!newMember.roles.cache.has(roleId)) {
            const role = newMember.guild.roles.cache.get(roleId);
            if (role) await newMember.roles.add(role).catch(() => {});
        }
    }
});

// ===== STATUS =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });
    const name = interaction.commandName;

    try {

        if (name === 'status') {
            const text = interaction.options.getString('text');
            const type = interaction.options.getInteger('type') ?? 0;

            client.user.setPresence({
                activities: [{ name: text, type }],
                status: 'online'
            });

            return interaction.editReply('Status updated.');
        }

        if (name === 'stayvc') {
            if (!voice) return interaction.editReply('VC not installed.');

            const channel = interaction.member.voice.channel;
            if (!channel) return interaction.editReply('Join VC first.');

            vcStay[interaction.guild.id] = channel.id;
            save('vcstay.json', vcStay);

            voice.joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator
            });

            return interaction.editReply('Staying in VC.');
        }

        if (name === 'unstayvc') {
            delete vcStay[interaction.guild.id];
            save('vcstay.json', vcStay);

            if (voice) {
                const conn = voice.getVoiceConnection(interaction.guild.id);
                if (conn) conn.destroy();
            }

            return interaction.editReply('Stopped VC stay.');
        }

        if (name === 'forcerole') {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            if (!forceRoles[interaction.guild.id]) forceRoles[interaction.guild.id] = {};
            if (!forceRoles[interaction.guild.id][user.id]) forceRoles[interaction.guild.id][user.id] = [];

            if (!forceRoles[interaction.guild.id][user.id].includes(role.id)) {
                forceRoles[interaction.guild.id][user.id].push(role.id);
            }

            save('forceroles.json', forceRoles);

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (member) await member.roles.add(role).catch(() => {});

            return interaction.editReply('Forced.');
        }

        if (name === 'unforcerole') {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            const roles = forceRoles[interaction.guild.id]?.[user.id];
            if (!roles) return interaction.editReply('None.');

            forceRoles[interaction.guild.id][user.id] =
                roles.filter(r => r !== role.id);

            save('forceroles.json', forceRoles);

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (member) await member.roles.remove(role).catch(() => {});

            return interaction.editReply('Removed.');
        }

    } catch (err) {
        console.error(err);
        interaction.editReply('Error.');
    }
});

client.login(process.env.TOKEN);
