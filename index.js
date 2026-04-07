const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const https = require('https');
const express = require('express');

// ===== Express server (Render) =====
const app = express();
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ===== Helpers =====
async function isRealWord(word) {
  return new Promise((resolve) => {
    const req = https.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      (res) => { resolve(res.statusCode === 200); res.resume(); }
    );
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

const PREFIX = ",";
const OWNER_ID = "1375128465430417610";

// ===== Data =====
let whitelist = fs.existsSync('whitelist.json') ? JSON.parse(fs.readFileSync('whitelist.json')) :
