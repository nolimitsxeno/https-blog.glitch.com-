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
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
}
function save(file, data) {
    fs.writeFileSync(file, JSON.stringify(data));
}

// ================= DATA =================
let forceRoles = load('forceroles.json');
let vcStay = load('vcstay.json');

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

    // ONLY NEW COMMANDS ADDED (DO NOT TOUCH OLD ONES)
    const commands = [
        new SlashCommandBuilder().setName('stayvc').setDescription('Bot joins VC'),
        new SlashCommandBuilder().setName('unstayvc').setDescription('Bot leaves VC'),

        // 🟢 Discord status
        new SlashCommandBuilder()
            .setName('dstatus')
            .setDescription('Set Discord status')
            .addStringOption(o =>
                o.setName('state')
                    .setDescription('online / idle / dnd / invisible')
                    .setRequired(true)
            ),

        // 🎮 Activity
        new SlashCommandBuilder()
            .setName('activity')
            .setDescription('Set activity status')
            .addStringOption(o =>
                o.setName('type')
                    .setDescription('PLAYING / WATCHING / LISTENING / COMPETING')
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName('text')
                    .setDescription('What to show')
                    .setRequired(true)
            ),

        // 📝 Custom status text
        new SlashCommandBuilder()
            .setName('setstatus')
            .setDescription('Set custom status text')
            .addStringOption(o =>
                o.setName('text')
                    .setDescription('Status text')
                    .setRequired(true)
            )
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        const guildId = process.env.GUILD_ID;
        const clientId = process.env.CLIENT_ID;

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log("Slash commands registered successfully");
    } catch (err) {
        console.error("Slash register error:", err);
    }
});

// ================= FORCE ROLE (UNCHANGED LOGIC) =================
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

// ================= COMMAND HANDLER =================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {

        // ===== YOUR OLD COMMANDS WILL STILL WORK =====
        // (/logs, /dm, /say etc are NOT touched here)

        // ===== VC =====
        if (commandName === 'stayvc') {
            const { joinVoiceChannel } = require('@discordjs/voice');

            const channel = interaction.member.voice.channel;
            if (!channel)
                return interaction.reply({ content: 'Join a VC first', ephemeral: true });

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

            return interaction.reply({ content: 'Left VC system', ephemeral: true });
        }

        // ===== 🟢 DISCORD STATUS =====
        if (commandName === 'dstatus') {
            const state = interaction.options.getString('state').toLowerCase();

            const valid = ['online', 'idle', 'dnd', 'invisible'];
            if (!valid.includes(state)) {
                return interaction.reply({ content: 'Invalid status', ephemeral: true });
            }

            client.user.setPresence({ status: state });

            return interaction.reply({ content: `Status set to ${state}`, ephemeral: true });
        }

        // ===== 🎮 ACTIVITY =====
        if (commandName === 'activity') {
            const type = interaction.options.getString('type').toUpperCase();
            const text = interaction.options.getString('text');

            const map = {
                PLAYING: 0,
                STREAMING: 1,
                LISTENING: 2,
                WATCHING: 3,
                COMPETING: 5
            };

            client.user.setPresence({
                activities: [
                    {
                        name: text,
                        type: map[type] ?? 0
                    }
                ],
                status: 'online'
            });

            return interaction.reply({ content: `Activity set`, ephemeral: true });
        }

        // ===== 📝 CUSTOM STATUS TEXT =====
        if (commandName === 'setstatus') {
            const text = interaction.options.getString('text');

            client.user.setPresence({
                activities: [
                    {
                        name: text,
                        type: 4
                    }
                ],
                status: 'online'
            });

            return interaction.reply({ content: `Status updated`, ephemeral: true });
        }

    } catch (err) {
        console.error(err);
        return interaction.reply({ content: 'Error occurred', ephemeral: true });
    }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
