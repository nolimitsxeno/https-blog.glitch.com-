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
        new SlashCommandBuilder().setName('logs').setDescription('Set logs channel'),

        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('DM a user')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addStringOption(o => o.setName('message').setRequired(true)),

        new SlashCommandBuilder()
            .setName('say')
            .setDescription('Send message in channel')
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

// ================= LOG SYSTEM =================
client.on('messageDelete', async message => {
    try {
        if (!message.guild) return;

        const channelId = logChannel?.[message.guild.id];
        if (!channelId) return;

        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) return;

        const image = message.attachments?.first()?.url;

        channel.send({
            content:
`🗑️ **Message Deleted**
👤 ${message.author?.tag || 'Unknown'}
💬 ${message.content || '[no text]'}
${image ? `🖼️ ${image}` : ''}`
        }).catch(() => {});
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

        channel.send({
            content:
`✏️ **Message Edited**
👤 ${oldMsg.author?.tag || 'Unknown'}
Before: ${oldMsg.content || '[empty]'}
After: ${newMsg.content || '[empty]'}`
        }).catch(() => {});
    } catch {}
});

// ================= COMMANDS =================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {

        // ===== /LOGS =====
        if (commandName === 'logs') {
            logChannel[interaction.guild.id] = interaction.channel.id;
            save('logchannel.json', logChannel);

            return interaction.reply({
                content: 'Logs channel set successfully',
                ephemeral: true
            });
        }

        // ===== /DM =====
        if (commandName === 'dm') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const user = interaction.options.getUser('user');
                const msg = interaction.options.getString('message');

                await user.send(msg).catch(() => {
                    throw new Error('Cannot DM user');
                });

                return interaction.editReply('DM sent');
            } catch {
                return interaction.editReply('Failed to send DM');
            }
        }

        // ===== /SAY =====
        if (commandName === 'say') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const msg = interaction.options.getString('message');

                await interaction.channel.send(msg);

                return interaction.editReply('Message sent');
            } catch {
                return interaction.editReply('Failed to send message');
            }
        }

        // ===== FALLBACK SAFETY =====
        return interaction.reply({
            content: 'Command not handled',
            ephemeral: true
        });

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
