const { Client, GatewayIntentBits, Partials, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events } = require('discord.js');
const { Rcon } = require('rcon-client');
const { v4: uuidv4 } = require('uuid');
const { saveSteamId, getVerifiedSteamId, banUser, isUserBanned } = require('./db');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

client.once('ready', () => console.log(`✅ Bot gestartet als ${client.user.tag}`));

async function logToChannel(client, content) {
  const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
  if (channel) channel.send(content);
}

client.on('messageCreate', async msg => {
  if (msg.content === '!registrieren') {
    const banned = await isUserBanned(msg.author.id);
    if (banned) return msg.reply('🚫 Du bist gebannt.');

    const verifyCode = uuidv4().split('-')[0];
    await saveSteamId(msg.author.id, null, verifyCode);

    msg.reply(`✅ Verifizierungscode: **${verifyCode}**\nBitte gib ihn im SCUM-Spielchat ein.`);
  }

  if (msg.content === '!regeln') {
    const button = new ButtonBuilder()
      .setCustomId('accept_rules')
      .setLabel('✅ Ich stimme zu')
      .setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(button);
    await msg.channel.send({ content: 'Bitte stimme den Regeln zu:', components: [row] });
  }

  if (msg.content.startsWith('!ban')) {
    if (!msg.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return msg.reply('❌ Du hast keine Berechtigung.');
    }

    const userToBan = msg.mentions.members.first();
    if (!userToBan) return msg.reply('⚠️ Bitte nutze `!ban @User`');

    await banUser(userToBan.id);
    await userToBan.roles.remove(process.env.WELCOME_ROLE_ID);

    msg.reply(`⛔ ${userToBan.user.tag} gebannt.`);
    await logToChannel(client, `⛔ **${msg.author.tag}** hat **${userToBan.user.tag}** gebannt.`);

    const steamId = await getVerifiedSteamId(userToBan.id);
    if (steamId) {
      try {
        const rcon = await Rcon.connect({
          host: process.env.RCON_HOST,
          port: parseInt(process.env.RCON_PORT),
          password: process.env.RCON_PASSWORD,
        });
        await rcon.send(`#Ban ${steamId}`);
        await rcon.end();

        msg.channel.send(`⛔ SCUM-Ban durchgeführt für ${steamId}`);
        await logToChannel(client, `🎮 SCUM-Ban für ${steamId} (Discord: ${userToBan.user.tag})`);
      } catch (err) {
        console.error(err);
        await logToChannel(client, `❌ RCON-Fehler beim Ban von ${userToBan.user.tag}: ${err.message}`);
      }
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() || interaction.customId !== 'accept_rules') return;

  const banned = await isUserBanned(interaction.member.id);
  if (banned) {
    return interaction.reply({ content: '🚫 Du bist gebannt.', ephemeral: true });
  }

  const steamId = await getVerifiedSteamId(interaction.member.id);
  if (!steamId) {
    return interaction.reply({ content: '⚠️ Bitte zuerst `!registrieren` ausführen & im Spiel verifizieren.', ephemeral: true });
  }

  await interaction.member.roles.add(process.env.WELCOME_ROLE_ID);
  await interaction.reply({ content: '🎉 Willkommen! Dein Paket wird verschickt.', ephemeral: true });

  try {
    const rcon = await Rcon.connect({
      host: process.env.RCON_HOST,
      port: parseInt(process.env.RCON_PORT),
      password: process.env.RCON_PASSWORD,
    });

    await rcon.send(process.env.GIVE_COMMAND.replace('<steamid>', steamId));
    await rcon.end();
  } catch (error) {
    console.error('RCON-Fehler:', error);
  }
});

client.login(process.env.BOT_TOKEN);
