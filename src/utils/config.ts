import { Transform, plainToInstance } from 'class-transformer';
import { IsJWT, IsSemVer, validateSync } from 'class-validator';
import * as dotenv from 'dotenv';

import { JWT, Token } from '@/dto/jwt.dto';

import 'reflect-metadata';

export class TestConfig {
  @IsJWT()
  @Transform(({ value }) => new JWT<Token.SessionToken>(value))
  readonly session_token: JWT<Token.SessionToken>;

  @IsSemVer()
  readonly version: string;
}

export const config: TestConfig = (() => {
  dotenv.config({ path: '.env' });

  const configuration = plainToInstance(
    TestConfig,
    {
      session_token: process.env.SESSION_TOKEN,
      version: process.env.VERSION,
    },
    { enableImplicitConversion: true, excludeExtraneousValues: false },
  );
  const errors = validateSync(configuration, { enableDebugMessages: true, stopAtFirstError: true, whitelist: true });
  // if (errors.length > 0) {
  //   throw new Error(errors.toString());
  // }
  return configuration;
})();
