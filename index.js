const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const express = require('express');

// ================= SAFETY =================
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// ================= EXPRESS =================
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ================= READY =================
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: 'Starting...', type: ActivityType.Playing }],
    status: 'online'
  });

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: [
      { name: 'say', description: 'Send message', options: [{ name: 'text', type: 3, required: true }] },
      { name: 'invite', description: 'Invite link' },
      { name: 'dm', description: 'DM user', options: [
        { name: 'user', type: 6, required: true },
        { name: 'message', type: 3, required: true }
      ]},

      { name: 'joinvc', description: 'Join VC' },
      { name: 'leavevc', description: 'Leave VC' },

      // ORIGINAL STATUS
      { name: 'status', description: 'Change bot status', options: [
        { name: 'state', type: 3, required: true }
      ]},

      { name: 'activity', description: 'Change bot activity', options: [
        { name: 'type', type: 3, required: true },
        { name: 'text', type: 3, required: true }
      ]},

      // ✅ FIX ADDED COMMANDS
      { name: 'dstatus', description: 'Change bot status (alt)', options: [
        { name: 'state', type: 3, required: true }
      ]},

      { name: 'stayvc', description: 'Join VC and stay' }
    ]
  });

  console.log("Slash commands registered");
});

// ================= SLASH COMMANDS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply().catch(() => {});

    const { commandName, options } = interaction;

    // ===== BASIC =====
    if (commandName === 'say') {
      return interaction.editReply(options.getString('text'));
    }

    if (commandName === 'invite') {
      return interaction.editReply('Invite link here');
    }

    if (commandName === 'dm') {
      const user = options.getUser('user');
      await user.send(options.getString('message'));
      return interaction.editReply('Sent');
    }

    // ===== JOIN VC =====
    if (commandName === 'joinvc' || commandName === 'stayvc') {
      const channel = interaction.member.voice.channel;

      if (!channel) {
        return interaction.editReply('Join a VC first');
      }

      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
      });

      return interaction.editReply('Joined VC');
    }

    // ===== LEAVE VC =====
    if (commandName === 'leavevc') {
      const connection = getVoiceConnection(interaction.guild.id);

      if (!connection) {
        return interaction.editReply('Not in VC');
      }

      connection.destroy();
      return interaction.editReply('Left VC');
    }

    // ===== STATUS =====
    if (commandName === 'status' || commandName === 'dstatus') {
      const state = options.getString('state');

      client.user.setPresence({
        status: state.toLowerCase(),
        activities: client.user.presence?.activities || []
      });

      return interaction.editReply(`Status set to ${state}`);
    }

    // ===== ACTIVITY =====
    if (commandName === 'activity') {
      const type = options.getString('type');
      const text = options.getString('text');

      const map = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening
      };

      client.user.setPresence({
        status: client.user.presence?.status || 'online',
        activities: [{
          name: text,
          type: map[type.toLowerCase()] || ActivityType.Playing
        }]
      });

      return interaction.editReply('Activity updated');
    }

  } catch (err) {
    console.error(err);
    try { await interaction.editReply('Error'); } catch {}
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
