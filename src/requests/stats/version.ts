import { Expose, plainToInstance } from 'class-transformer';
import { IsSemVer, IsString } from 'class-validator';

import { Method } from '@/enum/method';
import { ResponseType, RequestType, Headers, Parameters } from '@/utils/request_type';

export namespace Version {
  export class Request implements RequestType {
    readonly baseURL: string = 'https://api.splatnet3.com/';
    readonly headers: Headers;
    readonly method: Method = Method.GET;
    readonly parameters: Parameters;
    readonly path: string = 'v1/version';

    constructor() {
      this.headers = {
        'User-Agent': 'av5ja_discord_bot/2.1.7'
      };
    }

    request(response: any): Version.Response {
      return plainToInstance(Response, response, { excludeExtraneousValues: true });
    }
  }

  export class Response implements ResponseType {
    @Expose()
    @IsSemVer()
    readonly version: string;

    @Expose()
    @IsString()
    readonly revision: string;
  }
}
