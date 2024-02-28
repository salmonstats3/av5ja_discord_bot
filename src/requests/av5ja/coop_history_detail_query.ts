import { Expose } from 'class-transformer';

import { SHA256Hash } from '@/enum/sha256_hash';
import { GraphQL, Parameters, ResponseType } from '@/utils/graph_ql';
import 'reflect-metadata';

export namespace CoopHistoryDetailQuery {
  export class Request implements GraphQL {
    readonly hash: SHA256Hash = SHA256Hash.CoopHistoryDetailQuery;
    readonly version: number = 3;
    readonly destination: string = 'results';
    readonly parameters: Parameters;

    constructor(result_id: string) {
      this.parameters = {
        coopHistoryDetailId: result_id
      };
      console.log(result_id);
    }

    request(response: any): Response {
      return response;
    }
  }

  export class Response implements ResponseType {
    @Expose()
    private readonly raw_value: JSON;

    json(): JSON {
      return this.raw_value;
    }
  }
}
