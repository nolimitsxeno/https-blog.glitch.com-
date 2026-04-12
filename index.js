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

const app = express();
app.get('/', (req, res) => res.send('Bot is alive'));
app.listen(process.env.PORT || 5000);

// ===== SAFE FILE =====
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

// ===== DATA =====
let logs = load('logs.json');
let joinLogs = load('joinlogs.json');

// ===== CLIENT =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// ===== READY =====
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
    } catch (e) {
        console.error(e);
    }
});

// ===== DELETE LOG =====
client.on('messageDelete', async msg => {
    try {
        if (msg.partial) await msg.fetch().catch(() => {});
        if (!msg.guild) return;

        const channelId = logs[msg.guild.id];
        if (!channelId) return;

        const channel = msg.guild.channels.cache.get(channelId);
        if (!channel) return;

        const image = msg.attachments?.first()?.url;

        channel.send(
`🗑️ Deleted
User: ${msg.author?.tag || 'unknown'}
Message: ${msg.content || 'none'}
${image ? `Image: ${image}` : ''}`
        ).catch(() => {});
    } catch {}
});

// ===== EDIT LOG =====
client.on('messageUpdate', async (oldMsg, newMsg) => {
    try {
        if (oldMsg.partial) await oldMsg.fetch().catch(() => {});
        if (!oldMsg.guild) return;
        if (oldMsg.content === newMsg.content) return;

        const channelId = logs[oldMsg.guild.id];
        if (!channelId) return;

        const channel = oldMsg.guild.channels.cache.get(channelId);
        if (!channel) return;

        channel.send(
`✏️ Edited
User: ${oldMsg.author?.tag || 'unknown'}
Before: ${oldMsg.content || 'none'}
After: ${newMsg.content || 'none'}`
        ).catch(() => {});
    } catch {}
});

// ===== JOIN LOG =====
client.on('guildMemberAdd', member => {
    try {
        const channelId = joinLogs[member.guild.id];
        if (!channelId) return;

        const channel = member.guild.channels.cache.get(channelId);
        if (!channel) return;

        channel.send(`📥 Joined: ${member.user.tag}`).catch(() => {});
    } catch {}
});

// ===== COMMANDS =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.commandName;

    try {
        // 🔥 ALWAYS ACKNOWLEDGE FIRST (fixes your issue)
        await interaction.deferReply({ ephemeral: true });

        // ===== LOGS =====
        if (name === 'logs') {
            logs[interaction.guild.id] = interaction.channel.id;
            save('logs.json', logs);

            return interaction.editReply('Logs set');
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
                return interaction.editReply('User has DMs off');
            }
        }

        // ===== SAY =====
        if (name === 'say') {
            const msg = interaction.options.getString('message');

            await interaction.channel.send(msg);
            return interaction.editReply('Sent');
        }

        return interaction.editReply('Unknown command');

    } catch (err) {
        console.error(err);

        if (interaction.deferred) {
            interaction.editReply('Error occurred').catch(() => {});
        } else {
            interaction.reply({ content: 'Error', ephemeral: true }).catch(() => {});
        }
    }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
