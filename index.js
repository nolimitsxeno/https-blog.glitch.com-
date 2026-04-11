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

// ================= SAFE FILE SYSTEM =================
function load(file) {
    try {
        if (!fs.existsSync(file)) return {};
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        console.error(`Load error ${file}:`, e);
        return {};
    }
}

function save(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Save error ${file}:`, e);
    }
}

// ================= DATA =================
let forceRoles = load('forceroles.json');
let vcStay = load('vcstay.json');
let logChannel = load('logchannel.json');

// ================= CLIENT =================
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

// ================= READY =================
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('stayvc').setDescription('Join VC'),
        new SlashCommandBuilder().setName('unstayvc').setDescription('Leave VC'),

        new SlashCommandBuilder().setName('setlogs').setDescription('Set logs channel'),

        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('DM a user')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addStringOption(o => o.setName('message').setRequired(true)),

        new SlashCommandBuilder()
            .setName('say')
            .setDescription('Send message')
            .addStringOption(o => o.setName('message').setRequired(true)),

        new SlashCommandBuilder()
            .setName('activity')
            .setDescription('Set activity')
            .addStringOption(o => o.setName('type').setRequired(true))
            .addStringOption(o => o.setName('text').setRequired(true)),

        new SlashCommandBuilder()
            .setName('dstatus')
            .setDescription('Set Discord status')
            .addStringOption(o => o.setName('state').setRequired(true)),

        new SlashCommandBuilder()
            .setName('setstatus')
            .setDescription('Set custom status')
            .addStringOption(o => o.setName('text').setRequired(true))
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

// ================= LOGS =================
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
`🗑️ Deleted Message
👤 ${message.author?.tag || 'Unknown'}
💬 ${message.content || '[no text]'}
${image ? `🖼️ ${image}` : ''}`
        }).catch(() => {});
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

        channel.send({
            content:
`✏️ Edited Message
👤 ${oldMsg.author?.tag || 'Unknown'}
Before: ${oldMsg.content || '[empty]'}
After: ${newMsg.content || '[empty]'}`
        }).catch(() => {});
    } catch (e) {
        console.error("edit log error:", e);
    }
});

// ================= COMMANDS =================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {

        // ===== SET LOGS =====
        if (commandName === 'setlogs') {
            try {
                if (!interaction.guild) {
                    return interaction.reply({ content: 'Guild only', ephemeral: true });
                }

                logChannel[interaction.guild.id] = interaction.channel.id;
                save('logchannel.json', logChannel);

                return interaction.reply({ content: 'Logs set', ephemeral: true });

            } catch (e) {
                console.error(e);
                return interaction.reply({ content: 'Failed logs', ephemeral: true }).catch(() => {});
            }
        }

        // ===== DM =====
        if (commandName === 'dm') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const user = interaction.options.getUser('user');
                const msg = interaction.options.getString('message');

                await user.send(msg).catch(() => {
                    throw new Error('Cannot DM user');
                });

                return interaction.editReply('DM sent');

            } catch (e) {
                console.error(e);
                return interaction.editReply('DM failed');
            }
        }

        // ===== SAY =====
        if (commandName === 'say') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const msg = interaction.options.getString('message');

                await interaction.channel.send(msg);

                return interaction.editReply('Sent');

            } catch (e) {
                console.error(e);
                return interaction.editReply('Say failed');
            }
        }

        // ===== VC =====
        if (commandName === 'stayvc') {
            const { joinVoiceChannel } = require('@discordjs/voice');

            const channel = interaction.member.voice.channel;
            if (!channel)
                return interaction.reply({ content: 'Join VC first', ephemeral: true });

            vcStay[interaction.guild.id] = channel.id;
            save('vcstay.json', vcStay);

            joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });

            return interaction.reply({ content: 'Joined VC', ephemeral: true });
        }

        if (commandName === 'unstayvc') {
            delete vcStay[interaction.guild.id];
            save('vcstay.json', vcStay);

            return interaction.reply({ content: 'Left VC', ephemeral: true });
        }

        // ===== STATUS =====
        if (commandName === 'dstatus') {
            client.user.setPresence({
                status: interaction.options.getString('state')
            });

            return interaction.reply({ content: 'Status set', ephemeral: true });
        }

        // ===== ACTIVITY =====
        if (commandName === 'activity') {
            const type = interaction.options.getString('type');
            const text = interaction.options.getString('text');

            const map = {
                PLAYING: 0,
                WATCHING: 3,
                LISTENING: 2,
                COMPETING: 5
            };

            client.user.setPresence({
                activities: [{ name: text, type: map[type.toUpperCase()] ?? 0 }],
                status: 'online'
            });

            return interaction.reply({ content: 'Activity set', ephemeral: true });
        }

        // ===== CUSTOM STATUS =====
        if (commandName === 'setstatus') {
            const text = interaction.options.getString('text');

            client.user.setPresence({
                activities: [{ name: text, type: 4 }],
                status: 'online'
            });

            return interaction.reply({ content: 'Status set', ephemeral: true });
        }

    } catch (err) {
        console.error("Interaction error:", err);

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
