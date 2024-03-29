import { Expose, Transform, plainToInstance } from 'class-transformer';

import { JWT, Token } from '@/dto/jwt.dto';
import { Method } from '@/enum/method';
import { ResponseType, RequestType, Headers, Parameters } from '@/utils/request_type';

export namespace AccessToken {
  export class Request implements RequestType {
    readonly baseURL: string = 'https://accounts.nintendo.com/';
    readonly headers: Headers = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'Content-Type': 'application/json',
      Host: 'accounts.nintendo.com'
    };
    readonly method: Method = Method.POST;
    readonly parameters: Parameters;
    readonly path: string = 'connect/1.0.0/api/token';

    constructor(session_token: JWT<Token.SessionToken>) {
      this.parameters = {
        client_id: '71b963c1b7b6d119',
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token',
        session_token: session_token.raw_value
      };
    }

    request(response: any): AccessToken.Response {
      return plainToInstance(Response, response, { excludeExtraneousValues: true });
    }
  }

  export class Response implements ResponseType {
    @Expose()
    @Transform(({ value }) => new JWT<Token.Token>(value))
    readonly access_token: JWT<Token.Token>;

    @Expose()
    readonly expires_in: number;

    @Expose()
    @Transform(({ value }) => new JWT<Token.Token>(value))
    readonly id_token: JWT<Token.Token>;

    @Expose()
    readonly scope: string[];

    @Expose()
    readonly token_type: string;
    /**
     * NA ID
     */
    get na_id(): string {
      return this.access_token.payload.sub;
    }
  }
}
