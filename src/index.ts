import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { Client, Events, GatewayIntentBits, REST, Routes, User } from 'discord.js';

import { ButtonCommand, ModalCommand, SlashCommand } from './enum/commnad_id';
import { CommandManager } from './utils/commnad';
import { config } from './utils/config';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});
const rest = new REST({ version: '10' }).setToken(config.application_secret);
rest
  .put(Routes.applicationGuildCommands(config.application_id, config.guild_id), {
    body: [CommandManager.authorize.data]
  })
  .then(() => {
    console.log('Successfully registered application commands.');
  });
client.on(Events.InteractionCreate, async (interaction) => {
  /**
   * チャットへの入力
   */
  if (!interaction.isChatInputCommand()) {
    /**
     * ボタンコマンド
     */
    if (interaction.isButton()) {
      if (interaction.customId === ButtonCommand.AUTHORIZE) {
        CommandManager.authorize.show_model(interaction);
      }
      if (interaction.customId === ButtonCommand.GET_RESULTS) {
        /** Botを落とすとキャッシュから再生成できないので */
        const user: User | undefined = client.users.cache.get(interaction.user.id);
        if (user?.dmChannel == null) {
          const message = await interaction.deferReply({ fetchReply: true });
          await interaction.user.createDM(true);
          message.delete();
          return;
        }
        CommandManager.get_results.fetch(interaction);
      }
    }
  }
  if (interaction.isModalSubmit()) {
    switch (interaction.customId) {
      case ModalCommand.AUTHORIZE:
        CommandManager.authorize.login(interaction);
        break;
      default:
        break;
    }
  }
  /**
   * スラッシュコマンド
   */
  if (interaction.isCommand()) {
    switch (interaction.commandName) {
      case SlashCommand.AUTHORIZE:
        CommandManager.authorize.send_dm(interaction);
        break;
      default:
        break;
    }
  }
});
client.on(Events.MessageCreate, async (message) => {});
client.login(config.application_secret);
