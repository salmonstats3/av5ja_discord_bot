import { ChatInputCommandInteraction, Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';

import { CoralOAuth } from './utils/authorize';
import { config } from './utils/config';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});
const rest = new REST({ version: '10' }).setToken(config.application_secret);
rest
  .put(Routes.applicationGuildCommands(config.application_id, config.guild_id), {
    body: [CoralOAuth.authorize.data]
  })
  .then(() => {
    console.log('Successfully registered application commands.');
  });
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    if (interaction.isButton()) {
      if (interaction.customId === 'authorize') {
        CoralOAuth.submit.execute(interaction);
      }
      if (interaction.customId === 'get_results') {
        CoralOAuth.get_results.execute(interaction);
      }
    }
  }
  if (interaction.isModalSubmit()) {
    console.log(interaction.customId);
    switch (interaction.customId) {
      case 'submit':
        CoralOAuth.login.execute(interaction);
        break;
      default:
        break;
    }
  }
  if (interaction.isCommand()) {
    switch (interaction.commandName) {
      case 'authorize':
        CoralOAuth.authorize.execute(interaction as ChatInputCommandInteraction);
        break;
      default:
        break;
    }
  }
});
client.on(Events.MessageCreate, async (message) => {});
client.login(config.application_secret);
