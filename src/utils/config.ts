import { Transform, plainToInstance } from 'class-transformer';
import { IsBoolean, IsJWT, IsNotEmpty, IsSemVer, IsString, validateSync } from 'class-validator';
import * as dotenv from 'dotenv';

import { JWT, Token } from '@/dto/jwt.dto';

import 'reflect-metadata';

export class TestConfig {
  @IsBoolean()
  readonly is_development: boolean;

  @IsJWT()
  @Transform(({ value }) => new JWT<Token.SessionToken>(value))
  readonly session_token: JWT<Token.SessionToken>;

  @IsSemVer()
  readonly version: string;

  @IsString()
  @IsNotEmpty()
  readonly application_id: string;

  @IsString()
  @IsNotEmpty()
  readonly application_secret: string;

  @IsString()
  @IsNotEmpty()
  readonly guild_id: string;

  @IsString()
  @IsNotEmpty()
  readonly bot_version: string;
}

export const config: TestConfig = (() => {
  dotenv.config({ path: '.env' });

  const configuration = plainToInstance(
    TestConfig,
    {
      application_id: process.env.DISCORD_APPLICATION_ID,
      application_secret: process.env.DISCORD_APPLICATION_SECRET,
      bot_version: process.env.BOT_VERSION,
      guild_id: process.env.DISCORD_GUILD_ID,
      is_development: process.env.NODE_ENV === 'development',
      session_token: process.env.SESSION_TOKEN,
      version: process.env.VERSION
    },
    { enableImplicitConversion: true, excludeExtraneousValues: false }
  );
  const errors = validateSync(configuration, { enableDebugMessages: true, stopAtFirstError: true, whitelist: true });
  // if (errors.length > 0) {
  //   throw new Error(errors.toString());
  // }
  return configuration;
})();
