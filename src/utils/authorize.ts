import crypto from 'crypto';

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import base64url from 'base64url';
import { plainToInstance } from 'class-transformer';
import dayjs from 'dayjs';
import {
  APIEmbedField,
  ActionRowBuilder,
  AnyComponentBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextBasedChannel,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import Randomstring from 'randomstring';

import { config } from './config';
import { call_api } from './graph_ql';
import { request } from './request_type';

import { CoralCredential } from '@/dto/coral_credential';
import { JWT, Token } from '@/dto/jwt.dto';
import { ResultId } from '@/dto/result_id.dto';
import { StatusCode } from '@/enum/status_code';
import { CoopHistoryDetailQuery } from '@/requests/av5ja/coop_history_detail_query';
import { CoopHistoryQuery } from '@/requests/av5ja/coop_history_query';
import { AccessToken } from '@/requests/oauth/access_token';
import { BulletToken } from '@/requests/oauth/bullet_token';
import { CoralToken } from '@/requests/oauth/coral_token';
import { GameServiceToken } from '@/requests/oauth/game_service_token';
import { GameWebToken } from '@/requests/oauth/game_web_token';
import { SessionToken } from '@/requests/oauth/session_token';
import { UserMe } from '@/requests/oauth/user_me';
import { Version } from '@/requests/stats/version';

type CoralOAuthConfig = {
  readonly revision: string;
  readonly state: string;
  readonly verifier: string;
  readonly version: string;
};

export class CoralOAuth {
  private static readonly configs: CoralOAuthConfig[] = [];

  constructor() {}

  static oauthURL(state: string, verifier: string): string {
    // @ts-ignore
    const baseURL: URL = new URL('https://accounts.nintendo.com/connect/1.0.0/authorize');
    const challenge = base64url.fromBase64(crypto.createHash('sha256').update(verifier).digest('base64'));
    const parameters = new URLSearchParams({
      client_id: '71b963c1b7b6d119',
      redirect_uri: 'npf71b963c1b7b6d119://auth',
      response_type: 'session_token_code',
      scope: 'openid user user.birthday user.mii user.screenName',
      session_token_code_challenge: challenge,
      session_token_code_challenge_method: 'S256',
      state: state
    });
    baseURL.search = parameters.toString();
    return baseURL.toString();
  }

  static async get_cookie(url: string, verifier: string, version: string, revision: string): Promise<CoralCredential> {
    const regexp: RegExp = new RegExp('#session_token_code=(.*)&state=(.*)&session_state=(.*)$');
    const match: RegExpExecArray | null = regexp.exec(url);
    if (match === null) {
      throw new AxiosError('Invalid URL', StatusCode.ERROR_INVALID_URL);
    }
    const [, code, state, session_state] = match;
    const session_token = await this.get_session_token(code, verifier);
    return this.refresh(session_token, version, revision);
  }

  static async refresh(
    session_token: JWT<Token.SessionToken>,
    version: string,
    revision: string
  ): Promise<CoralCredential> {
    const access_token = await this.get_access_token(session_token);
    const user_me = await this.get_user_me(access_token);
    const coral_token_nso = await this.get_coral_token(access_token, undefined, version);
    const game_service_token = await this.get_game_service_token(access_token, coral_token_nso, version, user_me);
    const coral_token_app = await this.get_coral_token(
      game_service_token.access_token,
      access_token.payload.sub,
      version
    );
    const game_web_token = await this.get_game_web_token(game_service_token.access_token, coral_token_app, version);
    const bullet_token = await this.get_bullet_token(game_web_token, revision);

    return {
      birthday: user_me.birthday,
      bullet_token: bullet_token,
      country: user_me.country,
      expires_in: dayjs().add(115, 'minute').toDate(),
      game_web_token: game_web_token,
      id: user_me.id,
      language: user_me.language,
      nickname: user_me.nickname,
      revision: revision,
      session_token: session_token
    };
  }

  static async get_version(): Promise<Version.Response> {
    return await request(new Version.Request());
  }

  static async get_session_token(code: string, verifier: string): Promise<JWT<Token.SessionToken>> {
    return ((await request(new SessionToken.Request(code, verifier))) as SessionToken.Response).session_token;
  }

  static async get_access_token(session_token: JWT<Token.SessionToken>): Promise<JWT<Token.Token>> {
    return ((await request(new AccessToken.Request(session_token))) as AccessToken.Response).access_token;
  }

  static async get_user_me(access_token: JWT<Token.Token>): Promise<UserMe.Response> {
    return await request(new UserMe.Request(access_token));
  }

  static async get_coral_token(
    access_token: JWT<Token.Token> | JWT<Token.GameServiceToken>,
    id: string | undefined,
    version: string
  ): Promise<CoralToken.Response> {
    const hash_method = access_token.payload.typ === 'token' ? 1 : 2;
    const na_id = access_token.payload instanceof Token.Token ? access_token.payload.sub : id;
    const coral_user_id = access_token.payload instanceof Token.Token ? undefined : access_token.payload.sub;
    return await request(new CoralToken.Request(access_token.raw_value, hash_method, na_id, coral_user_id, version));
  }

  static async get_game_service_token(
    access_token: JWT<Token.Token>,
    hash: CoralToken.Response,
    version: string,
    user: UserMe.Response
  ): Promise<GameServiceToken.Response> {
    return (await request(
      new GameServiceToken.Request(access_token, hash, version, user)
    )) as GameServiceToken.Response;
  }

  static async get_game_web_token(
    access_token: JWT<Token.GameServiceToken>,
    hash: CoralToken.Response,
    version: string
  ): Promise<JWT<Token.GameWebToken>> {
    return ((await request(new GameWebToken.Request(access_token, hash, version))) as GameWebToken.Response)
      .access_token;
  }

  static async get_bullet_token(access_token: JWT<Token.GameWebToken>, version: string) {
    return ((await request(new BulletToken.Request(access_token, version))) as BulletToken.Response).bullet_token;
  }

  static async get_coop_histories(credential: CoralCredential): Promise<CoopHistoryQuery.Response> {
    return call_api(new CoopHistoryQuery.Request(), credential);
  }

  private static async get_coop_result(
    result_id: ResultId,
    credential: CoralCredential
  ): Promise<CoopHistoryDetailQuery.Response> {
    return call_api(new CoopHistoryDetailQuery.Request(result_id.rawValue), credential);
  }

  static async get_coop_results(
    history: CoopHistoryQuery.Response,
    credential: CoralCredential
  ): Promise<PromiseSettledResult<CoopHistoryDetailQuery.Response>[]> {
    const results = Promise.allSettled(
      history.histories
        .map((history) => history.results)
        .flat()
        .map((result_id) => this.get_coop_result(result_id, credential))
    );
    return results;
  }

  /**
   * 認証情報取得コマンド
   * @param interaction
   * @returns
   */
  static async get_credential(interaction: ButtonInteraction): Promise<CoralCredential> {
    const options: AxiosRequestConfig = {
      headers: {
        'Accept-Encoding': 'gzip, deflate'
      },
      method: 'GET',
      responseType: 'json',
      url: interaction.message.attachments.first()!.url
    };
    return plainToInstance(CoralCredential, (await axios.request(options)).data);
  }

  /**
   * リザルト取得コマンド
   */
  static get_results = {
    execute: async (interaction: ButtonInteraction): Promise<void> => {
      try {
        const channel: TextBasedChannel | null = interaction.channel;
        if (channel === null) {
          interaction.reply({ content: 'This command is not available in DM.', ephemeral: true });
        }
        console.log(interaction.message.id);

        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({ content: 'Fetching token ...' });
        const credential: CoralCredential = await (async () => {
          const credential: CoralCredential = await this.get_credential(interaction);
          if (credential.expires_in < dayjs().toDate()) {
            await interaction.editReply({ content: 'Regenerating token ...' });
            return await this.refresh(credential.session_token);
          }
          return credential;
        })();
        await interaction.editReply({ content: 'Checking token expiration ...' });
        await interaction.editReply({ content: 'Fetching coop histories ...' });
        const histories = await this.get_coop_histories(credential);
        await interaction.editReply({ content: 'Fetching coop results ...' });

        // const lastPlayedTime: Date = dayjs().subtract(7, 'day').toDate();
        // const history = histories.histories
        //   .map((history) => history.results)
        //   .flat()
        //   .sort((a, b) => dayjs(b.playTime).unix() - dayjs(a.playTime).unix())
        //   .at(0);
        // const results = await this.get_coop_results(histories, credential);
        const content: EmbedBuilder = new EmbedBuilder().setColor('#0099FF').setTitle('Authorization Success');
        content.setColor('#FF3300').setTitle('Fetch Results').addFields(
          {
            inline: true,
            name: 'Histories',
            value: histories.histories.length.toString()
          },
          {
            inline: true,
            name: 'Results',
            value: '50'
          }
        );
        const action: ActionRowBuilder = new ActionRowBuilder().addComponents([
          new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('Get results').setCustomId('get_results')
        ]);
        // @ts-ignore
        await interaction.editReply({ components: [action], embeds: [content], ephemeral: false });
      } catch (error: any) {
        const content: EmbedBuilder = new EmbedBuilder().setColor('#0099FF').setTitle('Authorization Failed');
        content
          .setColor('#FF3300')
          .setTitle('SplatNet3')
          .setDescription('Fetching results is failed with a following error.')
          .addFields(
            {
              inline: true,
              name: 'Error',
              value: error.message
            },
            {
              inline: true,
              name: 'Code',
              value: error.code
            }
          );
        interaction.editReply({ embeds: [content] });
      }
    }
  };

  static get_auth_config(interaction: ModalSubmitInteraction): CoralOAuthConfig {
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

  /**
   * 認証コマンド
   */
  static login = {
    execute: async (interaction: ModalSubmitInteraction): Promise<void> => {
      const { revision, state, verifier, version } = this.get_auth_config(interaction);
      const url: string = interaction.fields.getTextInputValue('oauthURL');
      try {
        await interaction.deferReply();
        const credential = await this.get_cookie(url, verifier, version, revision);
        const attachment: AttachmentBuilder = new AttachmentBuilder(Buffer.from(JSON.stringify(credential)), {
          name: 'token.json'
        });
        const action: ActionRowBuilder = new ActionRowBuilder().addComponents([
          new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('Get results').setCustomId('get_results'),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('Refresh').setCustomId('refresh')
        ]);
        const content: EmbedBuilder = new EmbedBuilder().setColor('#0099FF').setTitle('Authorization Success');
        content
          .setColor('#0033FF')
          .setTitle('SplatNet3 Authorization')
          .setDescription('Authorization is succeeded.')
          .setFooter({ text: 'Do not share this token with anyone, It is secret.' })
          .setTimestamp(dayjs().add(2, 'hour').toDate());
        // @ts-ignore
        interaction.editReply({ components: [action], embeds: [content], files: [attachment] });
      } catch (error: any) {
        const content: EmbedBuilder = new EmbedBuilder().setColor('#0099FF').setTitle('Authorization Failed');
        content
          .setColor('#FF3300')
          .setTitle('SplatNet3 Authorization')
          .setDescription('Authorization is failed with a following error.')
          .addFields(
            {
              inline: true,
              name: 'Error',
              value: error.message
            },
            {
              inline: true,
              name: 'Code',
              value: error.code
            }
          );
        interaction.editReply({ embeds: [content] });
      }
    }
  };

  /**
   * 入力認証URL表示コマンド
   */
  static submit = {
    execute: async (interaction: ButtonInteraction): Promise<void> => {
      const modal: ModalBuilder = new ModalBuilder().setCustomId('submit').setTitle('SplatNet3 Authorization');
      const content: TextInputBuilder = new TextInputBuilder()
        .setCustomId('oauthURL')
        .setLabel('Authorization URL')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph);
      const action = new ActionRowBuilder().addComponents(content);
      // @ts-ignore
      modal.addComponents(action);
      interaction.showModal(modal);
    }
  };

  /**
   * 認証用URL送信コマンド
   */
  static authorize = {
    data: new SlashCommandBuilder().setName('authorize').setDescription('Get SplatNet3 Authorization URL'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
      const verifier: string = Randomstring.generate(64);
      const state: string = Randomstring.generate(64);
      const reply = await interaction.deferReply({ fetchReply: true });
      const user_id: string = interaction.user.id;
      const version: Version.Response = await this.get_version();
      const action: ActionRowBuilder<AnyComponentBuilder> = new ActionRowBuilder().addComponents(
        ...[
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open URL').setURL(this.oauthURL(state, verifier)),
          new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('Authorize').setCustomId('authorize')
        ]
      );
      const content: EmbedBuilder = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('SplatNet3 Authorization')
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
        .setTimestamp();
      await reply.delete();
      // @ts-ignore
      interaction.user.send({ components: [action], embeds: [content] });
    }
  };
}
