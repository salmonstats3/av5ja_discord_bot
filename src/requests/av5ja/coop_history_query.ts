import { Expose, Transform, Type, plainToInstance } from 'class-transformer';

import 'reflect-metadata';

import { ResultId } from '@/dto/result_id.dto';
import { CoopBossInfoId } from '@/enum/coop_enemy';
import { CoopMode } from '@/enum/coop_mode';
import { CoopRule } from '@/enum/coop_rule';
import { CoopStageId } from '@/enum/coop_stage';
import { WeaponInfoMain } from '@/enum/coop_weapon_info/main';
import { SHA256Hash } from '@/enum/sha256_hash';
import { GraphQL, ResponseType } from '@/utils/graph_ql';
import { Parameters } from '@/utils/request_type';

export namespace CoopHistoryQuery {
  export class Request implements GraphQL {
    readonly hash: SHA256Hash = SHA256Hash.CoopHistoryQuery;
    readonly version: number = 1;
    readonly destination: string = 'histories';
    readonly parameters: Parameters;

    request(response: any): CoopHistoryQuery.Response {
      return plainToInstance(Response, { ...response, ...{ raw_value: response } }, { excludeExtraneousValues: true });
    }
  }

  class CoopSchedule {
    @Expose()
    readonly id: string;

    @Expose()
    readonly startTime: Date;

    @Expose()
    readonly endTime: Date;

    @Expose()
    readonly mode: CoopMode;

    @Expose()
    readonly rule: CoopRule;

    @Expose()
    readonly bossId: CoopBossInfoId;

    @Expose()
    readonly stageId: CoopStageId;

    @Expose()
    readonly rareWeapons: WeaponInfoMain.Id[];

    @Expose()
    readonly weaponList: WeaponInfoMain.Id[];
  }

  class CoopHisory {
    @Expose()
    readonly schedule: CoopSchedule;

    @Expose()
    @Transform(({ value }) => value.map((value: any) => ResultId.from(value)))
    @Type(() => ResultId)
    readonly results: ResultId[];
  }

  export class Response implements ResponseType {
    @Expose()
    @Type(() => CoopHisory)
    readonly histories: CoopHisory[];

    @Expose()
    private readonly rawValue: JSON;

    json(): JSON {
      return this.rawValue;
    }
  }
}
