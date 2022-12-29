const fs = require('node:fs');
const { Client, Intents, MessageEmbed, Permissions, WebhookClient, Formatters, DiscordAPIError } = require('discord.js');

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});
const settings = JSON.parse(fs.readFileSync('./settings.json'));
client.on('ready', async () => {
  console.log('ready');
  for (const guild of (await client.guilds.fetch()).values()){
    console.log('fixing settings of ' + guild.name);
    const hook = (await (await client.guilds.fetch(guild.id)).fetchWebhooks()).find((hook) => hook.owner === client.user);
    if (hook) {
      settings.push({ webhook: hook.id, guildId: hook.guildId, token: hook.token, ch: hook.channelId })
      fs.writeFileSync('./settings.json', JSON.stringify(settings, null, '  '));
      console.log('fixed');
    } else {
      console.log('the guild is not setuped gc');
    }
  }
  console.log('fix is end');
  client.destroy();
})
client.login();