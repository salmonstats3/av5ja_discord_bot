import { ActionRowBuilder, AnyComponentBuilder, ButtonBuilder } from '@discordjs/builders';
import axios, { AxiosRequestConfig } from 'axios';
import { plainToInstance } from 'class-transformer';
import dayjs from 'dayjs';
import {
  APIEmbedField,
  Attachment,
  AttachmentBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import Randomstring from 'randomstring';

import { CoralOAuth } from './authorize';
import { config } from './config';

import { CoralOAuthConfig } from '@/dto/coral_config';
import { CoralCredential } from '@/dto/coral_credential';
import { JWT, Token } from '@/dto/jwt.dto';
import { ButtonCommand, ModalCommand, SlashCommand, TextCommnad } from '@/enum/commnad_id';
import { Version } from '@/requests/stats/version';

export class CommandManager {
  /**
   * リザルトを取得する
   */
  static readonly get_results = {
    edit: async (interaction: ButtonInteraction, play_time: Date, credential: CoralCredential): Promise<void> => {
      const content: EmbedBuilder = this.embeds_builder(interaction.user.id, play_time);
      const attachment: AttachmentBuilder = new AttachmentBuilder(Buffer.from(JSON.stringify(credential)), {
        name: 'token.json'
      });
      await interaction.message.edit({ embeds: [content], files: [attachment] });
    },
    fetch: async (interaction: ButtonInteraction): Promise<void> => {
      try {
        const message = await interaction.deferReply({ ephemeral: false, fetchReply: true });
        await interaction.editReply({ content: 'Fetching token ...' });
        const credential = await this.get_results.refresh(interaction);
        await interaction.editReply({ content: 'Fetching coop histories ...' });
        const histories = await CoralOAuth.get_coop_histories(credential);
        await interaction.editReply({ content: 'Fetching coop results ...' });
        const last_play_time: Date = await this.get_results.play_time(interaction);
        const results = await CoralOAuth.get_coop_results(histories, credential, last_play_time);
        // データ更新
        const play_time: Date = histories.histories
          .flatMap((history) => history.results.map((result) => result.playTime))
          .reduce((a, b) => (dayjs(a).unix() > dayjs(b).unix() ? a : b), last_play_time);
        await this.get_results.edit(interaction, play_time, credential);
        if (interaction.replied) {
          await message.delete();
        }
      } catch (error: any) {
        await this.errorReply(interaction, 'Fetch Results Failed', error);
      }
    },
    get_credential: async (interaction: ButtonInteraction): Promise<CoralCredential> => {
      const attachment: Attachment | undefined = interaction.message.attachments.first();
      if (attachment === undefined) {
        throw new Error('Attachment is not found.');
      }
      const options: AxiosRequestConfig = {
        headers: {
          'Accept-Encoding': 'gzip, deflate'
        },
        method: 'GET',
        responseType: 'json',
        url: attachment.url
      };
      return plainToInstance(CoralCredential, (await axios.request(options)).data);
    },
    play_time: async (interaction: ButtonInteraction): Promise<Date> => {
      const message: Message | null = interaction.message;
      if (message === null) {
        return dayjs(0).toDate();
      }
      if (message.embeds.length === 0) {
        return dayjs(0).toDate();
      }
      const play_time: string =
        message.embeds[0].fields.find((field) => field.name === 'PlayTime')?.value ??
        dayjs(0).format('YYYY-MM-DD HH:mm:ss');
      return dayjs(play_time).toDate();
    },
    refresh: async (interaction: ButtonInteraction): Promise<CoralCredential> => {
      const credential: CoralCredential = await this.get_results.get_credential(interaction);
      await interaction.editReply({ content: 'Checking token expiration ...' });
      if (dayjs(credential.expires_in).unix() < dayjs().unix()) {
        const session_token: JWT<Token.SessionToken> = JWT.from(
          credential.session_token.header,
          credential.session_token.payload,
          credential.session_token.signature
        );
        await interaction.editReply({ content: 'Regenerating token ...' });
        return await CoralOAuth.refresh(session_token, credential.revision, credential.revision);
      }
      return credential;
    }
  };

  /**
   * DMを送信する
   */
  static readonly authorize = {
    data: new SlashCommandBuilder().setName(SlashCommand.AUTHORIZE).setDescription('Get SplatNet3 Authorization URL'),
    /**
     * ログイン
     * @param interaction
     */
    login: async (interaction: ModalSubmitInteraction): Promise<void> => {
      try {
        const { revision, state, verifier, version } = this.get_auth_config(interaction);
        const oauth_url: string = interaction.fields.getTextInputValue(TextCommnad.OAUTH_URL);
        await interaction.deferReply();
        const credential = await CoralOAuth.get_cookie(oauth_url, verifier, version, revision);
        const attachment: AttachmentBuilder = new AttachmentBuilder(Buffer.from(JSON.stringify(credential)), {
          name: 'token.json'
        });
        const action: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>().addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel('Get results')
            .setCustomId(ButtonCommand.GET_RESULTS),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Refresh')
            .setCustomId(ButtonCommand.REFRESH)
            .setDisabled(true),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Danger)
            .setLabel('Share')
            .setCustomId(ButtonCommand.SHARE)
            .setDisabled(true)
        ]);
        const content: EmbedBuilder = this.embeds_builder(interaction.user.id);
        await interaction.editReply({ components: [action], embeds: [content], files: [attachment] });
      } catch (error: any) {
        await this.errorReply(interaction, 'Authorization Failed', error);
      }
    },
    /**
     * DM送信
     * @param interaction
     */
    send_dm: async (interaction: ChatInputCommandInteraction): Promise<void> => {
      const verifier: string = Randomstring.generate(64);
      const state: string = Randomstring.generate(64);
      const user_id: string = interaction.user.id;
      const version: Version.Response = await CoralOAuth.get_version();
      const oauthURL: URL = CoralOAuth.get_oauth_url(state, verifier);
      const action: ActionRowBuilder<AnyComponentBuilder> = new ActionRowBuilder().addComponents(
        ...[
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open URL').setURL(oauthURL.href),
          new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('Authorize').setCustomId(ButtonCommand.AUTHORIZE)
        ]
      );
      const content: EmbedBuilder = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('Authorization')
        .setDescription(
          'Press the Open URL button, sign in with your Nintendo Account, right-click on the Select this account and copy the URL. Then press Authorize, paste the copied URL and submit.'
        )
        .addFields(
          {
            inline: true,
            name: 'Version',
            value: config.version
          },
          {
            inline: true,
            name: 'Revision',
            value: version.revision
          },
          {
            inline: true,
            name: 'Bot',
            value: process.env.BOT_VERSION!
          },
          {
            inline: true,
            name: 'Verifier',
            value: verifier
          },
          {
            inline: true,
            name: 'State',
            value: state
          },
          {
            inline: true,
            name: 'Issuer',
            value: user_id
          }
        )
        .setFooter({ text: 'This authentication flow uses third-party APIs, at your own risk.' })
        .setTimestamp();
      // await reply.delete();
      try {
        await interaction.reply({ content: 'Request accepted!' });
        // @ts-ignore
        await interaction.user.send({ components: [action], embeds: [content] });
      } catch (error) {
        await interaction.reply({ content: 'Please enable DMs from server members.' });
        throw error;
      }
    },
    /**
     * モーダル表示
     * @param interaction
     */
    show_model: async (interaction: ButtonInteraction): Promise<void> => {
      const modal: ModalBuilder = new ModalBuilder()
        .setCustomId(ModalCommand.AUTHORIZE)
        .setTitle('SplatNet3 Authorization');
      const content: TextInputBuilder = new TextInputBuilder()
        .setCustomId(TextCommnad.OAUTH_URL)
        .setLabel('Authorization URL')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph);
      const action = new ActionRowBuilder().addComponents(content);
      // @ts-ignore
      modal.addComponents(action);
      await interaction.showModal(modal);
    }
  };

  /**
   *
   * @param user_id
   * @param play_time
   * @returns
   */
  private static embeds_builder(user_id: string, play_time: Date = dayjs(0).toDate()): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('#0033FF')
      .setTitle('Status')
      .setFields(
        {
          inline: true,
          name: 'UserId',
          value: user_id
        },
        {
          inline: true,
          name: 'PlayTime',
          value: dayjs(play_time).format('YYYY-MM-DD HH:mm:ss')
        }
      )
      .setFooter({ text: 'Do not share `token.json` with anyone, It is secret.' })
      .setTimestamp();
  }

  private static async errorReply(
    interaction: ChatInputCommandInteraction | ModalSubmitInteraction | ButtonInteraction,
    title: string,
    error: any
  ): Promise<void> {
    if (error.isAxiosError) {
      const content: EmbedBuilder = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(title)
        .setDescription(error.code)
        .addFields(
          {
            inline: true,
            name: 'Status Code',
            value: error.request.status.toString()
          },
          {
            inline: true,
            name: 'Version',
            value: config.version
          },
          {
            name: 'Error Description',
            value: error.message
          }
        )
        .setFooter({ text: 'This authentication flow uses third-party APIs, at your own risk.' })
        .setTimestamp();
      await interaction.editReply({ embeds: [content] });
    }
  }
  /**
   * メッセージから認証に必要な情報を取得する
   * @param interaction
   * @returns
   */
  private static get_auth_config(interaction: ModalSubmitInteraction): CoralOAuthConfig {
    const message: Message | null = interaction.message;
    if (message === null) {
      throw new Error('Message is not found.');
    }
    if (message.embeds.length === 0) {
      throw new Error('Embed is not found.');
    }
    const fields: APIEmbedField[] = message.embeds[0].fields;
    const user_id: string = interaction.user.id;
    const verifier: string | undefined = fields.find((field) => field.name === 'Verifier')?.value;
    const state: string | undefined = fields.find((field) => field.name === 'State')?.value;
    const version: string | undefined = fields.find((field) => field.name === 'Version')?.value;
    const revision: string | undefined = fields.find((field) => field.name === 'Revision')?.value;
    // every, someで書くと補完が効かない
    if (state === undefined || verifier === undefined || version === undefined || revision === undefined) {
      throw new Error('Verifier or State is not found.');
    }
    return {
      revision,
      state,
      verifier,
      version
    };
  }
}
