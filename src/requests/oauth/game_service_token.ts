import { Expose, Transform, Type, plainToInstance } from 'class-transformer';

import { JWT, Membership, Token } from '@/dto/jwt.dto';
import { Method } from '@/enum/method';
import { CoralToken } from '@/requests/oauth/coral_token';
import 'reflect-metadata';
import { UserMe } from '@/requests/oauth/user_me';
import { ResponseType, RequestType, Headers, Parameters } from '@/utils/request_type';

export namespace GameServiceToken {
  export class Request implements RequestType {
    readonly baseURL: string = 'https://api-lp1.znc.srv.nintendo.net/';
    readonly headers: Headers;
    readonly method: Method = Method.POST;
    readonly parameters: Parameters;
    readonly path: string = 'v3/Account/Login';

    constructor(token: JWT<Token.Token>, hash: CoralToken.Response, version: string, user: UserMe.Response) {
      this.headers = {
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': `com.nintendo.znca/${version}(Android/7.1.2)`,
        'X-Platform': 'Android',
        'X-ProductVersion': version
      };
      this.parameters = {
        parameter: {
          f: hash.f,
          language: user.language,
          naBirthday: user.birthday,
          naCountry: user.country,
          naIdToken: token.raw_value,
          requestId: hash.request_id,
          timestamp: hash.timestamp.toString()
        }
      };
    }

    request(response: any): GameServiceToken.Response {
      return plainToInstance(Response, response, { excludeExtraneousValues: false });
    }
  }

  class NintendoAccount {
    @Expose()
    @Type(() => Membership)
    readonly membership: Membership;
  }

  class FriendCode {
    @Expose()
    readonly regenerable: boolean;

    @Expose()
    readonly regenerable_at: number;

    @Expose()
    readonly id: string;
  }

  class Links {
    @Expose()
    @Type(() => NintendoAccount)
    readonly nintendo_account: NintendoAccount;

    @Expose()
    @Type(() => FriendCode)
    readonly friend_code: FriendCode;
  }

  export class User {
    /**
     * Coral User ID
     */
    @Expose()
    readonly id: number;
    /**
     * Network Service Account ID(NSA ID)
     */
    @Expose()
    readonly nsa_id: string;

    @Expose()
    readonly image_uri: URL;

    @Expose()
    readonly name: string;
    readonly support_id: string;

    @Expose()
    readonly is_child_restricted: boolean;

    readonly etag: string;

    readonly links: Links;
  }

  class Credential {
    @Transform(({ value }) => new JWT<Token.GameServiceToken>(value))
    readonly access_token: JWT<Token.GameServiceToken>;
    readonly expires_in: number;
  }

  class Result {
    @Expose()
    @Type(() => User)
    readonly user: User;

    @Expose()
    @Type(() => Credential)
    readonly web_api_server_credential: Credential;
  }

  export class Response implements ResponseType {
    readonly status: number;

    @Expose()
    @Type(() => Result)
    readonly result: Result;

    get access_token(): JWT<Token.GameServiceToken> {
      return this.result.web_api_server_credential.access_token;
    }

    /**
     * Coral User ID
     */
    get coral_user_id(): number {
      return this.access_token.payload.sub;
    }

    /**
     * Network Service Account ID(NSA ID)
     */
    get nsa_id(): string {
      return this.result.user.nsa_id;
    }

    /**
     * Coral User ID
     */
    get id(): number {
      return this.result.user.id;
    }

    get user(): User {
      return this.result.user;
    }
  }
}
