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

// ================= SAFE STORAGE =================
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

// ================= DATA =================
let logChannel = load('logchannel.json');
let joinLogChannel = load('joinlogchannel.json');

// ================= CLIENT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // ✅ FIXED (IMPORTANT)
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
            .addStringOption(o => o.setName('message').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log("Slash commands registered");
    } catch (err) {
        console.error("Slash register error:", err);
    }
});

// ================= MESSAGE LOGS =================
client.on('messageDelete', async message => {
    try {
        if (!message.guild) return;

        const channelId = logChannel?.[message.guild.id];
        if (!channelId) return;

        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) return;

        channel.send(`🗑️ Deleted: ${message.content || '[no text]'}`).catch(() => {});
    } catch (e) {
        console.error("delete log error:", e);
    }
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
    try {
        if (!oldMsg.guild) return;
        if (oldMsg.content === newMsg.content) return;

        const channelId = logChannel?.[oldMsg.guild.id];
        if (!channelId) return;

        const channel = oldMsg.guild.channels.cache.get(channelId);
        if (!channel) return;

        channel.send(`✏️ Edited:\nBefore: ${oldMsg.content}\nAfter: ${newMsg.content}`).catch(() => {});
    } catch (e) {
        console.error("edit log error:", e);
    }
});

// ================= JOIN LOGS =================
client.on('guildMemberAdd', async member => {
    try {
        const channelId = joinLogChannel?.[member.guild.id];
        if (!channelId) return;

        const channel = member.guild.channels.cache.get(channelId);
        if (!channel) return;

        channel.send(`📥 Joined: ${member.user.tag}`).catch(() => {});
    } catch (e) {
        console.error("join log error:", e);
    }
});

// ================= COMMANDS =================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {

        // ===== LOGS =====
        if (commandName === 'logs') {
            logChannel[interaction.guild.id] = interaction.channel.id;
            save('logchannel.json', logChannel);

            return interaction.reply({ content: 'Message logs set', ephemeral: true });
        }

        // ===== LOG JOINS =====
        if (commandName === 'logjoins') {
            joinLogChannel[interaction.guild.id] = interaction.channel.id;
            save('joinlogchannel.json', joinLogChannel);

            return interaction.reply({ content: 'Join logs set', ephemeral: true });
        }

        // ===== DM (FULLY SAFE FIXED) =====
        if (commandName === 'dm') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const msg = interaction.options.getString('message');

            try {
                await user.send(msg);
                return interaction.editReply('DM sent');
            } catch {
                return interaction.editReply('User has DMs closed');
            }
        }

    } catch (err) {
        console.error(err);

        if (!interaction.replied) {
            return interaction.reply({
                content: 'Bot error occurred',
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
