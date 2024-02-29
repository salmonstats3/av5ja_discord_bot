import { plainToInstance } from 'class-transformer';

import { Method } from '@/enum/method';
import { config } from '@/utils/config';
import { ResponseType, RequestType, Headers, Parameters } from '@/utils/request_type';

export namespace CoralToken {
  export class Request implements RequestType {
    readonly baseURL: string = config.f_api_url;
    readonly headers: Headers;
    readonly method: Method = Method.POST;
    readonly parameters: Parameters;
    readonly path: string = 'f';

    constructor(
      token: string,
      hash_method: 1 | 2,
      na_id: string | undefined,
      coral_user_id: string | number | undefined,
      version: string
    ) {
      this.headers = {
        'Content-Type': 'application/json',
        'User-Agent': `av5ja/${config.bot_version}`,
        'X-znca-Platform': 'Android',
        'X-znca-Version': version
      };
      this.parameters = {
        coral_user_id: coral_user_id,
        hash_method: hash_method,
        na_id: na_id,
        token: token
      };
    }

    request(response: any): CoralToken.Response {
      return plainToInstance(Response, response, { excludeExtraneousValues: false });
    }
  }

  export class Response implements ResponseType {
    readonly f: string;
    readonly request_id: string;
    readonly timestamp: number;
  }
}
