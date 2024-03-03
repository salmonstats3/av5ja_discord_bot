import crypto from 'crypto';

import { AxiosError } from 'axios';
import base64url from 'base64url';
import dayjs from 'dayjs';

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

  static get_oauth_url(state: string, verifier: string): URL {
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
    return baseURL;
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
    credential: CoralCredential,
    play_time: Date = dayjs(0).toDate()
  ): Promise<PromiseSettledResult<CoopHistoryDetailQuery.Response>[]> {
    if (config.is_development) {
      const result_id_list: ResultId[] = history.histories.flatMap((history) => history.results).slice(0, 5);
      return Promise.allSettled(result_id_list.map((result_id) => this.get_coop_result(result_id, credential)));
    } else {
      const result_id_list: ResultId[] = history.histories
        .flatMap((history) => history.results)
        .filter((result_id) => dayjs(result_id.playTime).unix() > dayjs(play_time).unix());
      return Promise.allSettled(result_id_list.map((result_id) => this.get_coop_result(result_id, credential)));
    }
  }
}
