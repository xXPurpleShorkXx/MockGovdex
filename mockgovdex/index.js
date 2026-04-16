const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const stringSimilarity = require('string-similarity');
const fs = require('fs');
require('dotenv').config();

const db = require('./db/db');

// ===== LOAD ENTITIES =====
const entities = JSON.parse(fs.readFileSync('./data/entities.json'));

// ===== BOT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== SPAWN =====
let currentSpawn = null;

function spawnEntity(channel) {
  if (currentSpawn) return;

  const entity = entities[Math.floor(Math.random() * entities.length)];

  currentSpawn = {
    data: entity,
    answers: [
      entity.name.toLowerCase(),
      ...entity.aliases.map(a => a.toLowerCase())
    ]
  };

  const attachment = new AttachmentBuilder(entity.image);

  channel.send({
    content: "🌍 A political entity has appeared! Guess its name!",
    files: [attachment]
  });
}

// ===== MATCHING =====
function similarity(a, b) {
  return stringSimilarity.compareTwoStrings(a, b);
}

function isCorrectGuess(guess, spawn) {
  return spawn.answers.some(ans => similarity(guess, ans) > 0.85);
}

// ===== EVENTS =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase().trim();

  // ===== GUESS =====
  if (currentSpawn && msg.length > 2) {
    if (isCorrectGuess(msg, currentSpawn)) {
      const entity = currentSpawn.data;

      await db.addEntity(message.author.id, entity.name);

      message.reply(`🎉 ${message.author.username} claimed **${entity.name}**!`);

      currentSpawn = null;
    }
  }

  // ===== SET SPAWN =====
  if (msg.startsWith("!setspawn")) {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("Admin only.");
    }

    const channel = message.mentions.channels.first();
    if (!channel) return message.reply("Mention a channel.");

    await db.setSpawnChannel(message.guild.id, channel.id);

    message.reply(`Spawn channel set to ${channel}`);
  }

  // ===== INVENTORY =====
  if (msg === "!inventory") {
    const owned = await db.getUserEntities(message.author.id);

    if (!owned.length) return message.reply("You have nothing.");

    message.reply(owned.join("\n"));
  }

  // ===== DEX =====
  if (msg.startsWith("!dex")) {
    const owned = await db.getUserEntities(message.author.id);
    const all = entities.map(e => e.name);

    if (msg === "!dex owned") {
      return message.reply(owned.join("\n") || "None");
    }

    if (msg === "!dex missing") {
      const missing = all.filter(e => !owned.includes(e));
      return message.reply(missing.join("\n") || "None");
    }

    const formatted = all.map(name =>
      owned.includes(name) ? `✅ ${name}` : `❌ ${name}`
    );

    message.reply(formatted.join("\n"));
  }

  // ===== TEST SPAWN =====
  if (msg === "!spawn") {
    spawnEntity(message.channel);
  }
});

// ===== READY =====
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await db.init();

  setInterval(async () => {
    const guilds = await db.getAllGuilds();

    for (const g of guilds) {
      const channel = client.channels.cache.get(g.spawnChannel);
      if (channel) spawnEntity(channel);
    }
  }, 60000);
});

client.login(process.env.TOKEN);
