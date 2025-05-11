const { Tail } = require('tail');
const { verifyUserByCode } = require('./db');
require('dotenv').config();

const tail = new Tail(process.env.SCUM_LOG_PATH);

tail.on('line', async line => {
  const match = line.match(/\[Chat\] (.+?) \((\d{17})\): (\w+)/);
  if (match) {
    const [, playerName, steamId, code] = match;
    const result = await verifyUserByCode(code, steamId);
    if (result) {
      console.log(`✅ Verifiziert: ${playerName} mit SteamID ${steamId}`);
    }
  }
});

tail.on('error', console.error);
