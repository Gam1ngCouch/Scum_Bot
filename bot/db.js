const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

async function saveSteamId(discordId, steamId, verifyCode) {
  await pool.query(
    'REPLACE INTO users (discord_id, steam_id, verify_code, verified, banned) VALUES (?, ?, ?, ?, ?)',
    [discordId, steamId, verifyCode, steamId ? true : false, false]
  );
}

async function verifyUserByCode(code, steamId) {
  const [rows] = await pool.query('SELECT * FROM users WHERE verify_code = ?', [code]);
  if (rows.length && !rows[0].verified && !rows[0].banned) {
    await pool.query('UPDATE users SET steam_id = ?, verified = TRUE WHERE verify_code = ?', [steamId, code]);
    return rows[0];
  }
  return null;
}

async function getVerifiedSteamId(discordId) {
  const [rows] = await pool.query(
    'SELECT steam_id FROM users WHERE discord_id = ? AND verified = TRUE AND banned = FALSE',
    [discordId]
  );
  return rows.length ? rows[0].steam_id : null;
}

async function banUser(discordId) {
  await pool.query('UPDATE users SET banned = TRUE, verified = FALSE WHERE discord_id = ?', [discordId]);
}

async function isUserBanned(discordId) {
  const [rows] = await pool.query('SELECT banned FROM users WHERE discord_id = ?', [discordId]);
  return rows.length ? rows[0].banned : false;
}

module.exports = { saveSteamId, verifyUserByCode, getVerifiedSteamId, banUser, isUserBanned };
