const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== INIT TABLES =====
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS collections (
      userId TEXT,
      entity TEXT,
      UNIQUE(userId, entity)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guilds (
      guildId TEXT PRIMARY KEY,
      spawnChannel TEXT
    );
  `);
}

// ===== USER =====
async function ensureUser(userId) {
  await pool.query(
    `INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [userId]
  );
}

// ===== COLLECTION =====
async function addEntity(userId, entity) {
  await ensureUser(userId);

  await pool.query(
    `INSERT INTO collections (userId, entity)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, entity]
  );
}

async function getUserEntities(userId) {
  const res = await pool.query(
    `SELECT entity FROM collections WHERE userId = $1`,
    [userId]
  );
  return res.rows.map(r => r.entity);
}

// ===== GUILDS =====
async function setSpawnChannel(guildId, channelId) {
  await pool.query(
    `INSERT INTO guilds (guildId, spawnChannel)
     VALUES ($1, $2)
     ON CONFLICT (guildId)
     DO UPDATE SET spawnChannel = EXCLUDED.spawnChannel`,
    [guildId, channelId]
  );
}

async function getAllGuilds() {
  const res = await pool.query(`SELECT * FROM guilds`);
  return res.rows;
}

module.exports = {
  init,
  addEntity,
  getUserEntities,
  setSpawnChannel,
  getAllGuilds
};
