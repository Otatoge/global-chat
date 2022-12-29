const fs = require('node:fs');
const { Client, Intents, MessageEmbed, Permissions, WebhookClient, Formatters, DiscordAPIError } = require('discord.js');

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

const err = (msg) => {
  return new MessageEmbed({
    title: '❌ Error',
    description: msg,
    timestamp: new Date(),
    color: 'RED'
  });
}
const ok = (msg) => {
  return new MessageEmbed({
    title: '✅ Success',
    description: msg,
    timestamp: new Date(),
    color: 'DEFAULT'
  });
}
setInterval(() => {
  client.user.setPresence({
    status: 'idle',
    activities: [{
      name: `Joined ${guilds} servers | ping: ${client.ws.ping}ms | ${settings.length} servers globally`,
      type: 'PLAYING'
    }]
  });
}, 60000);
const send = (messageData, ignore) => {
  let errs = 0
  settings.forEach((setting) => {
    if (setting.guildId !== ignore) {
      const hook = new WebhookClient({ id: setting.webhook, token: setting.token });
      hook.send(messageData).catch((err) => {
        if (err instanceof DiscordAPIError) {
          if (err.code === 10015) {
            settings = settings.filter((setd) => setd.guildId !== setting.guildId);
            set();
          }
        }
        errs += 1
        console.error(err);
      });
    }
  });
  return errs !== settings.length
}

settings = JSON.parse(fs.readFileSync('./settings.json'));
block = JSON.parse(fs.readFileSync('./block.json'));
const set = () => {
  fs.writeFile('./settings.json', JSON.stringify(settings, null, '  '), () => { });
  fs.writeFile('./block.json', JSON.stringify(block, null, '  '), () => { });
}

let guilds = 0
let cooldown = []

client.on('ready', () => {
  client.application.commands.set([{
    name: 'gc',
    description: 'manege global chat',
    options: [{
      type: 'SUB_COMMAND',
      name: 'connect',
      description: 'connect to global chat',
      options: [{
        type: 'CHANNEL',
        name: 'channel',
        description: 'channel to connect',
        channelTypes: ['GUILD_TEXT'],
        required: true
      }]
    }, {
      type: 'SUB_COMMAND',
      name: 'disconnect',
      description: 'leave global chat'
    }, {
      type: 'SUB_COMMAND',
      name: 'block',
      description: 'block user or server.',
      options: [{
        type: 'STRING',
        name: 'id',
        description: 'server or user id',
        required: true
      }]
    }]
  }]).then(async () => {
    console.log('Ready!');
    guilds = (await client.guilds.fetch()).size
    client.user.setPresence({
      status: 'idle',
      activities: [{
        name: `Joined ${guilds} servers | ping: ${client.ws.ping}ms | ${settings.length} servers globally`,
        type: 'PLAYING'
      }]
    });
  }).catch(console.error);
});

client.on('guildCreate', (guild) => {
  if (block.guilds.includes(guild.id)) {
    guild.leave();
  } else {
    guilds += 1
  }
});
client.on('guildDelete', (guild) => {
  guilds -= 1
  settings = settings.filter((setting) => setting.guildId !== guild.id);
  set();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return
  await interaction.deferReply({ ephemeral: false }).catch(console.error);
  if (interaction.options.getSubcommand() === 'connect') {
    if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) return interaction.followUp({ embeds: [err('You do not have MANAGE_GUILD privilege to execute this command')] });
    if (settings.every((setting) => setting.guildId !== interaction.guild.id)) {
      interaction.options.getChannel('channel').createWebhook('global').then((webhook) => {
        settings.push({ webhook: webhook.id, token: webhook.token, guildId: interaction.guild.id, ch: interaction.options.getChannel('channel').id });
        set();
        interaction.followUp({ embeds: [ok('Successfully connected to global chat')] });
        send({
          username: 'Infomation message',
          avatarURL: client.user.displayAvatarURL(),
          embeds: [new MessageEmbed({
            title: `${interaction.guild.name} has joined`,
            description: 'Let\'s get along!',
            timestamp: webhook.createdAt,
            color: 'RANDOM',
            thumbnail: interaction.guild.icon,
            author: {
              name: interaction.member.displayName,
              iconURL: interaction.member.displayAvatarURL()
            },
            fields: [{
              name: 'Guild creation date',
              value: Formatters.time(interaction.guild.createdAt, 'F')
            }, {
              name: 'Guild id',
              value: Formatters.inlineCode(interaction.guild.id)
            }, {
              name: 'Current global chat participation count',
              value: settings.length.toString()
            }]
          })]
        });
      }).catch((errd) => {
        console.error(errd);
        interaction.followUp({ embeds: [err('Failed to create webhook. Check bot permissions')] });
      })
    } else {
      const guild = settings.find((setting) => setting.guildId === interaction.guild.id);
      client.fetchWebhook(guild.webhook, guild.token).then(() => {
        interaction.followUp({ embeds: [err('Already connected to global chat')] });
      }).catch((errd) => {
        console.error(errd);
        interaction.options.getChannel('channel').createWebhook('global').then((webhook) => {
          settings = settings.map((v) => {
            if (v.guildId === interaction.guild.id) {
              return { webhook: webhook.id, token: webhook.token, guildId: interaction.guild.id, ch: interaction.options.getChannel('channel').id }
            } else {
              return v
            }
          });
          set();
          interaction.followUp({ embeds: [ok('webhook successfully updated')] });
        }).catch((errd) => {
          console.error(errd);
          interaction.followUp({ embeds: [err('Failed to create webhook. Check bot permissions')] });
        });
      });
    }
  } else if (interaction.options.getSubcommand() === 'disconnect') {
    if (settings.find((setting) => setting.guildId === interaction.guild.id) === undefined) return interaction.followUp({ embeds: [err('You are not connected to global chat here yet')] });
    const setting = settings.find((setting) => setting.guildId === interaction.guild.id);
    client.fetchWebhook(setting.webhook, setting.token).then((webhook) => {
      webhook.delete().catch(console.error);
    }).catch(console.error);
    settings = settings.filter((setting) => setting.guildId !== interaction.guild.id);
    set();
    interaction.followUp({ embeds: [ok('Successfully disconnected from global chat')] });
  } else if (interaction.options.getSubcommand() === 'block') {
    (await client.guilds.fetch('1021237607071485962')).members.fetch(interaction.user.id).then(async (member) => {
      const adminRole = await member.guild.roles.fetch('1021568203555622912');
      if (!adminRole.members.every((admin) => member.id !== admin.id)) {
        const id = interaction.options.getString('id')
        if (block.guilds.includes(id)) {
          block.guilds = block.guilds.filter((gid) => gid !== id);
          set();
          return interaction.followUp({ embeds: [ok('Successfully unblocked guild')] });
        } else if (block.users.includes(id)) {
          block.users = block.users.filter((uid) => uid !== id);
          set();
          return interaction.followUp({ embeds: [ok('Successfully unblocked user')] });
        } else {
          client.guilds.fetch(id).then(async (guild) => {
            block.guilds.push(id);
            settings = settings.filter((setting) => setting.guildId !== id);
            set();
            await guild.leave();
            return interaction.followUp({ embeds: [ok('Successfully blocked the guild and left the guild')] });
          }).catch((errd) => {
            console.error(errd);
            client.users.fetch(id).then(() => {
              block.users.push(id);
              set();
              return interaction.followUp({ embeds: [ok('Successfully blocked user')] });
            }).catch((errdd) => {
              console.error(errdd);
              return interaction.followUp({ embeds: [err('Specify guild id or user id')] });
            });
          });
        }
      } else {
        return interaction.followUp({ embed: [err('Sorry, only administrators can run this command')] });
      }
    }).catch((errd) => {
      console.error(errd);
      return interaction.followUp({ embed: [err('Sorry, only administrators can run this command')] });
    });
  }
});

client.on('messageCreate', async (message) => {
  if (message.system || message.author.bot) return
  if (block.users.includes(message.author.id)) return message.react('❌').catch(console.error);
  if (message.channel.id !== settings.find((setting) => setting.guildId === message.guild.id)?.ch) return
  if (cooldown.includes(message.author.id)) return message.react('❌').catch(console.error);
  if (message.content >= 4096) return message.react('❌').catch(console.error);
  let embeds = [new MessageEmbed({
    description: message.content.replace(/\w{23,26}\.\w{6}\.\w{27}/g, '<token>'),
    timestamp: message.createdAt,
    author: {
      name: message.author.username,
      url: `https://discord.com/users/${message.author.id}`,
      iconURL: message.author.avatarURL()
    },
    color: message.author.accentColor
  })]
  message.stickers.forEach((sticker) => {
    embeds.push(new MessageEmbed({
      title: sticker.name,
      description: `sticker\n${sticker.description ?? ''}`,
      image: {
        url: sticker.url
      }
    }));
  });
  if (message.attachments.size !== 0) {
    let fields = []
    message.attachments.forEach((attachment) => {
      if (attachment.name >= 255) {
        fields.push({ name: attachment.name.slice(0, 252) + '...', value: attachment.url });
      } else {
        fields.push({ name: attachment.name, value: attachment.url });
      }
    });
    let video
    let image
    if (message.attachments[0]?.contentType !== undefined) {
      if (message.attachments[0].contentType.startsWith('image/')) {
        image = { url: message.attachments[0].url }
      } else if (message.attachments[0].contentType.startsWith('video/')) {
        video = { url: message.attachments[0].url }
      }
    }
    embeds.push(new MessageEmbed({
      title: 'Attachments',
      fields,
      video,
      image
    }));
  }
  if (message.type === 'REPLY') {
    const reply = await message.fetchReference();
    const serverhook = settings.find((setting) => setting.guildId === message.guild.id).webhook
    let res
    if (reply.webhookId) {
      if (reply.webhookId === serverhook) {
        let c = 0
        res = reply.embeds[c]
        while (res.title === 'Reply') {
          res = reply.embeds[c + 1]
          c++
        }
        res.setTitle('Reply');
      }
    } else {
      res = new MessageEmbed({
        title: 'Reply',
        description: reply.content.replace(/\w{23,26}\.\w{6}\.\w{27}/, '<token>'),
        timestamp: reply.createdAt,
        author: {
          name: reply.author.username,
          url: `https://discord.com/users/${reply.author.id}`,
          iconURL: reply.author.avatarURL()
        },
        color: reply.author.accentColor
      });
    }
    embeds.splice(0, 0, res);
  }

  await message.guild.fetch();
  const suc = send({
    username: message.guild.name,
    avatarURL: message.guild.iconURL() ?? 'https://cdn.discordapp.com/embed/avatars/0.png',
    embeds
  }, message.guild.id);
  if (!suc) return message.react('❌').catch(console.error);
  message.react('⭕').then(() => {
    cooldown.push(message.author.id);
    setTimeout(() => cooldown = cooldown.filter((v) => v !== message.author.id), 3000);
  }).catch(console.error);
});

console.log('logging in...');
client.login()
  .then(() => console.log('Logged on'))
  .catch(console.error)
