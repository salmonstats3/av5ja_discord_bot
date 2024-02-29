import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsSemVer, IsString, IsUrl, validateSync } from 'class-validator';
import * as dotenv from 'dotenv';

import 'reflect-metadata';

export class TestConfig {
  @IsBoolean()
  readonly is_development: boolean;

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

  @IsUrl()
  readonly url: string;

  @IsUrl()
  readonly f_api_url: string;
}

export const config: TestConfig = (() => {
  dotenv.config({ path: '.env' });

  const configuration = plainToInstance(
    TestConfig,
    {
      application_id: process.env.DISCORD_APPLICATION_ID,
      application_secret: process.env.DISCORD_APPLICATION_SECRET,
      bot_version: process.env.BOT_VERSION,
      f_api_url: process.env.F_API_URL,
      guild_id: process.env.DISCORD_GUILD_ID,
      is_development: process.env.NODE_ENV === 'development',
      url: process.env.API_URL,
      version: process.env.VERSION
    },
    { enableImplicitConversion: true, excludeExtraneousValues: false }
  );
  const errors = validateSync(configuration, { enableDebugMessages: true, stopAtFirstError: true, whitelist: true });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return configuration;
})();
