const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(process.env.PORT || 5000);

const PREFIX = ",";

// ===== JSON =====
function load(file) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}; }
function save(file, data) { fs.writeFileSync(file, JSON.stringify(data)); }

let logChannels = load('logchannels.json');
let joinLogChannels = load('joinlog.json');
let leaveLogChannels = load('leavelog.json');
let boostLogChannels = load('boostlog.json');
let autoroles = load('autorole.json');
let activeChannels = load('activechannels.json');
let forceRoles = load('forceroles.json');

// ===== CLIENT =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

// ===== READY =====
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    setInterval(() => {
        for (const [guildId, channelId] of Object.entries(activeChannels)) {
            const channel = client.guilds.cache.get(guildId)?.channels.cache.get(channelId);
            if (channel) channel.send("Hello guys!");
        }
    }, 2 * 60 * 60 * 1000);
});

// ===== FORCE ROLE AUTO =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        const guildData = forceRoles[newMember.guild.id];
        if (!guildData) return;

        const userRoles = guildData[newMember.id];
        if (!userRoles) return;

        for (const roleId of userRoles) {
            if (!newMember.roles.cache.has(roleId)) {
                const role = newMember.guild.roles.cache.get(roleId);
                if (role) await newMember.roles.add(role).catch(() => {});
            }
        }
    } catch (err) {
        console.error('Force role error:', err);
    }
});

// ===== JOIN =====
client.on('guildMemberAdd', member => {
    const roleId = autoroles[member.guild.id];
    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) member.roles.add(role).catch(() => {});
    }

    const channel = member.guild.channels.cache.get(joinLogChannels[member.guild.id]);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('Member Joined')
        .setDescription(`${member} joined`)
        .addFields({ name: 'Created', value: member.user.createdAt.toUTCString() })
        .setColor('Green');

    channel.send({ embeds: [embed] });
});

// ===== LEAVE =====
client.on('guildMemberRemove', member => {
    const channel = member.guild.channels.cache.get(leaveLogChannels[member.guild.id]);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('Member Left')
        .setDescription(`${member.user.tag} left`)
        .setColor('Red');

    channel.send({ embeds: [embed] });
});

// ===== DELETE LOG =====
client.on('messageDelete', async message => {
    try {
        if (message.partial) await message.fetch().catch(() => {});
        if (!message.guild) return;

        const logChannel = message.guild.channels.cache.get(logChannels[message.guild.id]);
        if (!logChannel) return;

        const attachments = message.attachments.size
            ? message.attachments.map(a => a.url).join('\n')
            : 'None';

        logChannel.send(`🗑️ ${message.author?.tag || 'Unknown'} deleted:\n${message.content || 'No text'}\n${attachments}`);
    } catch {}
});

// ===== EDIT LOG =====
client.on('messageUpdate', async (oldMsg, newMsg) => {
    try {
        if (oldMsg.partial) await oldMsg.fetch().catch(() => {});
        if (!oldMsg.guild) return;

        const logChannel = oldMsg.guild.channels.cache.get(logChannels[oldMsg.guild.id]);
        if (!logChannel) return;

        logChannel.send(`✏️ ${oldMsg.author?.tag} edited:\nBefore: ${oldMsg.content}\nAfter: ${newMsg.content}`);
    } catch {}
});

// ===== SLASH COMMANDS =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    const name = interaction.commandName;

    try {

        if (name === 'logs') {
            logChannels[interaction.guild.id] = interaction.channel.id;
            save('logchannels.json', logChannels);
            return interaction.editReply('Logs set.');
        }

        if (name === 'logjoins') {
            joinLogChannels[interaction.guild.id] = interaction.channel.id;
            save('joinlog.json', joinLogChannels);
            return interaction.editReply('Join logs set.');
        }

        if (name === 'logleaves') {
            leaveLogChannels[interaction.guild.id] = interaction.channel.id;
            save('leavelog.json', leaveLogChannels);
            return interaction.editReply('Leave logs set.');
        }

        if (name === 'logboosts') {
            boostLogChannels[interaction.guild.id] = interaction.channel.id;
            save('boostlog.json', boostLogChannels);
            return interaction.editReply('Boost logs set.');
        }

        if (name === 'autorole') {
            const role = interaction.options.getRole('role');
            autoroles[interaction.guild.id] = role.id;
            save('autorole.json', autoroles);
            return interaction.editReply('Autorole set.');
        }

        if (name === 'active') {
            activeChannels[interaction.guild.id] = interaction.channel.id;
            save('activechannels.json', activeChannels);
            return interaction.editReply('Active set.');
        }

        // ===== SAY =====
        if (name === 'say') {
            const text = interaction.options.getString('text');
            await interaction.channel.send(text);
            return interaction.editReply('Sent.');
        }

        // ===== DM =====
        if (name === 'dm') {
            const user = interaction.options.getUser('user');
            const text = interaction.options.getString('text');

            await user.send(text).catch(() => {
                return interaction.editReply('Failed to DM.');
            });

            return interaction.editReply('DM sent.');
        }

        // ===== FORCE ROLE =====
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

            return interaction.editReply('Force role added.');
        }

        // ===== UNFORCE ROLE =====
        if (name === 'unforcerole') {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            const userRoles = forceRoles[interaction.guild.id]?.[user.id];
            if (!userRoles) return interaction.editReply('No forced roles.');

            forceRoles[interaction.guild.id][user.id] =
                userRoles.filter(r => r !== role.id);

            save('forceroles.json', forceRoles);

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (member) await member.roles.remove(role).catch(() => {});

            return interaction.editReply('Force role removed.');
        }

    } catch (err) {
        console.error(err);
        interaction.editReply('Error.');
    }
});

client.login(process.env.TOKEN);
