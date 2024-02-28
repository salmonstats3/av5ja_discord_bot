import { Expose, Transform, Type, plainToInstance } from 'class-transformer';
import dayjs from 'dayjs';

import 'reflect-metadata';
import { Common } from '@/dto/common.dto';
import { CoopMode } from '@/enum/coop_mode';
import { CoopRule } from '@/enum/coop_rule';
import { SHA256Hash } from '@/enum/sha256_hash';
import { snakecaseKeys } from '@/utils/convert_keys';
import { GraphQL, ResponseType } from '@/utils/graph_ql';
import { Parameters } from '@/utils/request_type';

export namespace CoopHistoryQuery {
  export class Request implements GraphQL {
    readonly hash: SHA256Hash = SHA256Hash.CoopHistoryQuery;
    readonly version: number = 3;
    readonly destination: string = 'coop_history_query';
    readonly parameters: Parameters;

    request(response: any): CoopHistoryQuery.Response {
      return plainToInstance(
        Response,
        { ...snakecaseKeys(response), ...{ raw_value: response } },
        { excludeExtraneousValues: true }
      );
    }
  }

  class HistoryDetail {
    @Expose()
    @Transform(({ value }) => new Common.CoopHistoryDetailId(value))
    readonly id: Common.CoopHistoryDetailId;
  }

  class HistoryGroupNode {
    @Expose()
    @Type(() => HistoryGroup)
    readonly nodes: HistoryGroup[];
  }

  class HistoryDetailNode {
    @Expose()
    @Type(() => HistoryDetail)
    readonly nodes: HistoryDetail[];
  }

  export class HistoryGroup {
    @Expose()
    @Transform(({ value }) => (value === null ? null : dayjs(value).toDate()))
    readonly start_time: Date | null;

    @Expose()
    @Transform(({ value }) => (value === null ? null : dayjs(value).toDate()))
    readonly end_time: Date | null;

    @Expose()
    @Transform(({ value }) => Object.values(CoopMode).find((mode) => mode === value) || CoopMode.UNDEFINED)
    readonly mode: CoopMode;

    @Expose()
    @Transform(({ value }) => Object.values(CoopRule).find((rule) => rule === value) || CoopRule.UNDEFINED)
    readonly rule: CoopRule;

    @Expose()
    @Type(() => HistoryDetailNode)
    readonly history_details: HistoryDetailNode;

    get result_id_list(): Common.CoopHistoryDetailId[] {
      return this.history_details.nodes.map((node) => node.id);
    }
  }

  class CoopResult {
    @Expose()
    @Type(() => HistoryGroupNode)
    readonly history_groups: HistoryGroupNode;
  }

  class DataClass {
    @Expose()
    @Type(() => CoopResult)
    readonly coop_result: CoopResult;
  }

  export class Response implements ResponseType {
    @Expose()
    @Type(() => DataClass)
    readonly data: DataClass;

    get history_groups(): HistoryGroup[] {
      return this.data.coop_result.history_groups.nodes;
    }

    /**
     * リザルトIDをプレイ時間で昇順にソート
     */
    get coop_result_detail_ids(): Common.CoopHistoryDetailId[] {
      return this.history_groups
        .flatMap((v) => v.history_details.nodes.map((v) => v.id))
        .sort((a, b) => dayjs(a.play_time).unix() - dayjs(b.play_time).unix());
    }

    @Expose()
    private readonly raw_value: JSON;

    json(): JSON {
      return this.raw_value;
    }
  }
}
