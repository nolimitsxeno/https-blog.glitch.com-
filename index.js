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
        fs.writeFileSync(file, JSON.stringify(data));
    } catch {}
}

// ================= DATA =================
let logChannel = load('logchannel.json');

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
        new SlashCommandBuilder().setName('setlogs').setDescription('Set logs channel'),

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

        console.log("Slash commands registered");
    } catch (err) {
        console.error(err);
    }
});

// ================= LOGS =================
client.on('messageDelete', async message => {
    try {
        if (!message.guild) return;

        const channelId = logChannel?.[message.guild.id];
        if (!channelId) return;

        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) return;

        channel.send(`🗑️ Deleted: ${message.content || '[no text]'}`).catch(() => {});
    } catch {}
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
    } catch {}
});

// ================= COMMANDS =================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {

        // ===== SET LOGS =====
        if (commandName === 'setlogs') {
            logChannel[interaction.guild.id] = interaction.channel.id;
            save('logchannel.json', logChannel);

            return interaction.reply({
                content: 'Logs channel set',
                ephemeral: true
            });
        }

        // ===== DM =====
        if (commandName === 'dm') {
            const user = interaction.options.getUser('user');
            const msg = interaction.options.getString('message');

            try {
                await user.send(msg);
                return interaction.reply({ content: 'DM sent', ephemeral: true });
            } catch {
                return interaction.reply({ content: 'Cannot DM user', ephemeral: true });
            }
        }

        // ===== SAY =====
        if (commandName === 'say') {
            const msg = interaction.options.getString('message');

            await interaction.channel.send(msg);

            return interaction.reply({
                content: 'Sent',
                ephemeral: true
            });
        }

        // ===== FALLBACK SAFETY =====
        return interaction.reply({
            content: 'Command received but not handled.',
            ephemeral: true
        });

    } catch (err) {
        console.error(err);

        if (!interaction.replied) {
            return interaction.reply({
                content: 'Bot error',
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
