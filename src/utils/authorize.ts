import crypto from 'crypto';

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import base64url from 'base64url';
import { plainToInstance } from 'class-transformer';
import dayjs from 'dayjs';
import {
  ActionRowBuilder,
  AnyComponentBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
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
  readonly state: string;
  readonly user_id: string;
  readonly verifier: string;
};

export class CoralOAuth {
  private static readonly configs: CoralOAuthConfig[] = [];

  constructor() {}

  static get_config(user_id: string): CoralOAuthConfig {
    const config: CoralOAuthConfig = (() => {
      const config: CoralOAuthConfig | undefined = this.configs.find((config) => config.user_id === user_id);
      if (config !== undefined) {
        return config;
      }
      const new_config: CoralOAuthConfig = {
        state: Randomstring.generate(64),
        user_id,
        verifier: Randomstring.generate(64)
      };
      this.configs.push(new_config);
      return new_config;
    })();
    return config;
  }

  static oauthURL(user_id: string): string {
    const config: CoralOAuthConfig = this.get_config(user_id);
    // @ts-ignore
    const baseURL: URL = new URL('https://accounts.nintendo.com/connect/1.0.0/authorize');
    const challenge = base64url.fromBase64(crypto.createHash('sha256').update(config.verifier).digest('base64'));
    const parameters = new URLSearchParams({
      client_id: '71b963c1b7b6d119',
      redirect_uri: 'npf71b963c1b7b6d119://auth',
      response_type: 'session_token_code',
      scope: 'openid user user.birthday user.mii user.screenName',
      session_token_code_challenge: challenge,
      session_token_code_challenge_method: 'S256',
      state: config.state
    });
    baseURL.search = parameters.toString();
    return baseURL.toString();
  }

  static async get_cookie(user_id: string, url: string): Promise<CoralCredential> {
    const config: CoralOAuthConfig | undefined = this.configs.find((config) => config.user_id === user_id);
    if (config === undefined) {
      throw new AxiosError('This user has been not authorized yet.', StatusCode.ERROR_INVALID_PARAMETERS);
    }
    const regexp: RegExp = new RegExp('#session_token_code=(.*)&state=(.*)&session_state=(.*)$');
    const match: RegExpExecArray | null = regexp.exec(url);
    if (match === null) {
      throw new AxiosError('Invalid URL', StatusCode.ERROR_INVALID_URL);
    }
    const [, code, state, session_state] = match;
    const session_token = await this.get_session_token(code, config.verifier);
    return this.refresh(session_token);
  }

  static async refresh(session_token: JWT<Token.SessionToken>): Promise<CoralCredential> {
    const version = await this.get_version();
    const access_token = await this.get_access_token(session_token);
    const user_me = await this.get_user_me(access_token);
    const coral_token_nso = await this.get_coral_token(access_token, undefined, config.version);
    const game_service_token = await this.get_game_service_token(
      access_token,
      coral_token_nso,
      config.version,
      user_me
    );
    const coral_token_app = await this.get_coral_token(
      game_service_token.access_token,
      access_token.payload.sub,
      config.version
    );
    const game_web_token = await this.get_game_web_token(
      game_service_token.access_token,
      coral_token_app,
      config.version
    );
    const bullet_token = await this.get_bullet_token(game_web_token, version.revision);
    return {
      birthday: user_me.birthday,
      bullet_token: bullet_token,
      country: user_me.country,
      game_web_token: game_web_token,
      id: user_me.id,
      language: user_me.language,
      nickname: user_me.nickname,
      revision: version.revision,
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
        // console.log(interaction.)
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({ content: 'Fetching token ...' });
        const credential: CoralCredential = await this.get_credential(interaction);
        await interaction.editReply({ content: 'Fetching coop histories ...' });
        const histories = await this.get_coop_histories(credential);
        await interaction.editReply({ content: 'Fetching coop results ...' });
        const results = await this.get_coop_results(histories, credential);
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
            value: results.length.toString()
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
  /**
   * 認証コマンド
   */
  static login = {
    execute: async (interaction: ModalSubmitInteraction): Promise<void> => {
      const user_id: string = interaction.user.id;
      const url: string = interaction.fields.getTextInputValue('oauthURL');
      try {
        await interaction.deferReply({ ephemeral: true });
        const credential = await this.get_cookie(user_id, url);
        const attachment: AttachmentBuilder = new AttachmentBuilder(Buffer.from(JSON.stringify(credential)), {
          name: 'token.json'
        });
        const action: ActionRowBuilder = new ActionRowBuilder().addComponents([
          new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('Get results').setCustomId('get_results')
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
   * 認証URL入力モーダルコマンド
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
   * 認証ダイアログ表示コマンド
   */
  static authorize = {
    data: new SlashCommandBuilder().setName('authorize').setDescription('Get SplatNet3 Authorization URL'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
      const user_id: string = interaction.user.id;
      const version: Version.Response = await this.get_version();
      const action: ActionRowBuilder<AnyComponentBuilder> = new ActionRowBuilder().addComponents(
        ...[
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open URL').setURL(this.oauthURL(user_id)),
          new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('Authorize').setCustomId('authorize')
        ]
      );
      const content: EmbedBuilder = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('SplatNet3 Authorization')
        .setDescription('Click the link below to authorize SplatNet3.')
        .addFields(
          {
            inline: true,
            name: 'Issuer',
            value: user_id
          },
          {
            inline: true,
            name: 'Version',
            value: version.version
          },
          {
            inline: true,
            name: 'Revision',
            value: version.revision
          }
        )
        .setTimestamp();
      // @ts-ignore
      interaction.reply({ components: [action], embeds: [content], ephemeral: true });
    }
  };
}
