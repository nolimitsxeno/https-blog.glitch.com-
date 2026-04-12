const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const fs = require('fs');
const express = require('express');

// ================= KEEP ALIVE =================
const app = express();
app.get('/', (req, res) => res.send('Bot is alive'));
app.listen(process.env.PORT || 5000);

// ================= STORAGE =================
function load(file) {
    try {
        if (!fs.existsSync(file)) return {};
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return {};
    }
}
function save(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch {}
}

let logs = load('logs.json');
let joinLogs = load('joinlogs.json');

// ================= CLIENT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

// ================= READY =================
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('logs').setDescription('Set message logs channel'),
        new SlashCommandBuilder().setName('logjoins').setDescription('Set join logs channel'),

        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('DM a user')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addStringOption(o => o.setName('message').setRequired(true)),

        new SlashCommandBuilder()
            .setName('say')
            .setDescription('Send message')
            .addStringOption(o => o.setName('message').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log("Commands registered");
    } catch (err) {
        console.error("Command register error:", err);
    }
});

// ================= LOGS =================
client.on('messageDelete', async msg => {
    try {
        if (!msg.guild) return;

        const channelId = logs[msg.guild.id];
        if (!channelId) return;

        const channel = await msg.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return;

        channel.send(`🗑️ Deleted: ${msg.content || 'none'}`).catch(() => {});
    } catch {}
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
    try {
        if (!oldMsg.guild) return;
        if (oldMsg.content === newMsg.content) return;

        const channelId = logs[oldMsg.guild.id];
        if (!channelId) return;

        const channel = await oldMsg.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return;

        channel.send(`✏️ Edited:\nBefore: ${oldMsg.content}\nAfter: ${newMsg.content}`).catch(() => {});
    } catch {}
});

client.on('guildMemberAdd', async member => {
    try {
        const channelId = joinLogs[member.guild.id];
        if (!channelId) return;

        const channel = await member.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return;

        channel.send(`📥 Joined: ${member.user.tag}`).catch(() => {});
    } catch {}
});

// ================= COMMAND HANDLER =================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.commandName;

    try {
        await interaction.deferReply({ ephemeral: true });

        // ===== LOGS =====
        if (name === 'logs') {
            logs[interaction.guild.id] = interaction.channel.id;
            save('logs.json', logs);

            return interaction.editReply('Logs channel set');
        }

        // ===== JOIN LOGS =====
        if (name === 'logjoins') {
            joinLogs[interaction.guild.id] = interaction.channel.id;
            save('joinlogs.json', joinLogs);

            return interaction.editReply('Join logs set');
        }

        // ===== DM =====
        if (name === 'dm') {
            const user = interaction.options.getUser('user');
            const msg = interaction.options.getString('message');

            try {
                await user.send(msg);
                return interaction.editReply('DM sent');
            } catch {
                return interaction.editReply('User has DMs disabled');
            }
        }

        // ===== SAY (SAFE + GUARANTEED) =====
        if (name === 'say') {
            const msg = interaction.options.getString('message');

            const channel = await client.channels.fetch(interaction.channelId).catch(() => null);

            if (!channel || !channel.isTextBased()) {
                return interaction.editReply('Cannot send messages here');
            }

            await channel.send(msg);

            return interaction.editReply('Sent');
        }

    } catch (err) {
        console.error(err);

        if (interaction.deferred) {
            return interaction.editReply('Error occurred');
        }
    }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
