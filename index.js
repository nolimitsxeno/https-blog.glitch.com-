const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is alive'));
app.listen(process.env.PORT || 5000);

// ===== SAFE FILE HELPERS =====
function load(file) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
}
function save(file, data) {
    fs.writeFileSync(file, JSON.stringify(data));
}

// ===== DATA =====
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

    const commands = [
        new SlashCommandBuilder().setName('stayvc').setDescription('Bot joins VC'),
        new SlashCommandBuilder().setName('unstayvc').setDescription('Bot leaves VC'),

        new SlashCommandBuilder()
            .setName('status')
            .setDescription('Set bot status')
            .addStringOption(o => o.setName('text').setRequired(true)),

        new SlashCommandBuilder()
            .setName('forcerole')
            .setDescription('Force role on user')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addRoleOption(o => o.setName('role').setRequired(true)),

        new SlashCommandBuilder()
            .setName('unforcerole')
            .setDescription('Remove forced role')
            .addUserOption(o => o.setName('user').setRequired(true))
            .addRoleOption(o => o.setName('role').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    // ===== SAFE SLASH REGISTER (FIX) =====
    setTimeout(async () => {
        try {
            const guildId = process.env.GUILD_ID;

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: commands }
            );

            console.log("Slash commands registered successfully");
        } catch (err) {
            console.error("Slash command error:", err);
        }
    }, 5000);
});

// ===== FORCE ROLE SYSTEM =====
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

// ===== INTERACTIONS =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {

        if (commandName === 'stayvc') {
            const { joinVoiceChannel } = require('@discordjs/voice');

            const channel = interaction.member.voice.channel;
            if (!channel) return interaction.reply({ content: 'Join a VC first', ephemeral: true });

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

        if (commandName === 'status') {
            const text = interaction.options.getString('text');

            client.user.setPresence({
                activities: [{ name: text }],
                status: 'online'
            });

            return interaction.reply({ content: 'Status updated', ephemeral: true });
        }

        if (commandName === 'forcerole') {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            if (!forceRoles[interaction.guild.id]) forceRoles[interaction.guild.id] = {};
            if (!forceRoles[interaction.guild.id][user.id]) forceRoles[interaction.guild.id][user.id] = [];

            forceRoles[interaction.guild.id][user.id].push(role.id);
            save('forceroles.json', forceRoles);

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (member) await member.roles.add(role).catch(() => {});

            return interaction.reply({ content: 'Role forced', ephemeral: true });
        }

        if (commandName === 'unforcerole') {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            const data = forceRoles[interaction.guild.id]?.[user.id];
            if (!data) return interaction.reply({ content: 'No forced roles', ephemeral: true });

            forceRoles[interaction.guild.id][user.id] =
                data.filter(r => r !== role.id);

            save('forceroles.json', forceRoles);

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (member) await member.roles.remove(role).catch(() => {});

            return interaction.reply({ content: 'Removed forced role', ephemeral: true });
        }

    } catch (err) {
        console.error(err);
        interaction.reply({ content: 'Error occurred', ephemeral: true });
    }
});

client.login(process.env.TOKEN);
