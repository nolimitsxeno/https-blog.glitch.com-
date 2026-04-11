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

// ================= STORAGE =================
function load(file) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
}
function save(file, data) {
    fs.writeFileSync(file, JSON.stringify(data));
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
        new SlashCommandBuilder().setName('stayvc').setDescription('Bot joins VC'),
        new SlashCommandBuilder().setName('unstayvc').setDescription('Bot leaves VC'),

        new SlashCommandBuilder().setName('setlogs').setDescription('Set logs channel'),

        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('DM a user')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addStringOption(o => o.setName('message').setRequired(true)),

        new SlashCommandBuilder()
            .setName('say')
            .setDescription('Send message in channel')
            .addStringOption(o => o.setName('message').setRequired(true)),

        new SlashCommandBuilder()
            .setName('activity')
            .setDescription('Set activity')
            .addStringOption(o =>
                o.setName('type').setRequired(true)
            )
            .addStringOption(o =>
                o.setName('text').setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('dstatus')
            .setDescription('Set Discord status')
            .addStringOption(o =>
                o.setName('state').setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('setstatus')
            .setDescription('Set custom status')
            .addStringOption(o =>
                o.setName('text').setRequired(true)
            )
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

// ================= FORCE ROLE =================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
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
    } catch (e) {
        console.error(e);
    }
});

// ================= LOGS SYSTEM =================
client.on('messageDelete', async message => {
    if (!message.guild) return;

    const channelId = logChannel[message.guild.id];
    if (!channelId) return;

    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) return;

    const image = message.attachments.first()?.url;

    channel.send({
        content:
`🗑️ **Message Deleted**
👤 User: ${message.author?.tag || 'Unknown'}
💬 Content: ${message.content || '[no text]'}
${image ? `🖼️ Image: ${image}` : ''}`
    }).catch(() => {});
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (!oldMsg.guild) return;
    if (oldMsg.content === newMsg.content) return;

    const channelId = logChannel[oldMsg.guild.id];
    if (!channelId) return;

    const channel = oldMsg.guild.channels.cache.get(channelId);
    if (!channel) return;

    channel.send({
        content:
`✏️ **Message Edited**
👤 User: ${oldMsg.author?.tag || 'Unknown'}

Before: ${oldMsg.content || '[empty]'}
After: ${newMsg.content || '[empty]'}`
    }).catch(() => {});
});

// ================= COMMAND HANDLER =================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const { commandName } = interaction;

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

            await user.send(msg).catch(() => {});

            return interaction.reply({
                content: 'DM sent',
                ephemeral: true
            });
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
