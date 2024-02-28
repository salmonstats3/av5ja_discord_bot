import { Expose, Transform, plainToInstance } from 'class-transformer';
import { IsUUID } from 'class-validator';
import dayjs from 'dayjs';

/**
 * TODO: 既存コードのコピーなので修正予定
 */
export class ResultId {
  @Expose()
  readonly type: string;

  @Expose()
  readonly prefix: string;

  @Expose()
  readonly nplnUserId: string;

  @Expose()
  @Transform(({ value }) => dayjs(value).toDate())
  readonly playTime: Date;

  @Expose()
  @IsUUID()
  @Transform(({ value }) => value.toUpperCase())
  readonly uuid: string;

  /**
   * オリジナルのリザルトID
   */
  get rawValue(): string {
    return btoa(
      `${this.type}-${this.prefix}-${this.nplnUserId}:${dayjs(this.playTime).format('YYYYMMDDTHHmmss')}_${this.uuid.toLowerCase()}`
    );
  }

  static from(rawValue: string): ResultId {
    const regexp = /([\w]*)-([\w]{1})-([\w\d]{20}):([\dT]{15})_([a-f0-9-]{36})/;
    const match = regexp.exec(atob(rawValue));
    if (match !== null) {
      const [, type, prefix, nplnUserId, playTime, uuid] = match;
      return plainToInstance(ResultId, {
        nplnUserId: nplnUserId,
        playTime: dayjs(playTime).toDate(),
        prefix: prefix,
        type: type,
        uuid: uuid
      });
    } else {
      throw new Error('Invalid result id');
    }
  }
}
