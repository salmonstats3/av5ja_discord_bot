import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import { Method } from '../enum/method';

import { config } from './config';
import { snakecaseKeys } from './convert_keys';

import { CoralCredential } from '@/dto/coral_credential';
import { SHA256Hash } from '@/enum/sha256_hash';
import { StatusCode } from '@/enum/status_code';

export interface ResponseType {
  json(): JSON;
}
export type Headers = Record<string, string>;
export type Parameters =
  | string
  | URLSearchParams
  | undefined
  | Record<string, string | number | undefined | Record<string, string | number | undefined>>;

export interface GraphQL {
  readonly destination: string;
  readonly hash: SHA256Hash;
  readonly parameters: Parameters;
  request(response: any): ResponseType | void;

  readonly version: number;
}

async function submit<T extends GraphQL>(request: T, body: any): Promise<any> {
  const url = new URL(`${config.url}/v${request.version}/${request.destination}`);
  const options: AxiosRequestConfig = {
    data: body,
    headers: {
      'User-Agent': `av5ja_discord/${config.bot_version}`
    },
    method: Method.POST,
    responseType: 'json',
    url: url.href
  };
  return (await axios.request(options)).data;
}

export async function call_api<T extends GraphQL, U extends ReturnType<T['request']>>(
  request: T,
  credential: CoralCredential
): Promise<U> {
  const url = new URL('https://api.lp1.av5ja.srv.nintendo.net/api/graphql');
  const body = JSON.stringify({
    extensions: {
      persistedQuery: {
        sha256Hash: request.hash,
        version: 1
      }
    },
    variables: request.parameters
  });

  const headers = {
    Accept: '*/*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-US',
    Authorization: `Bearer ${credential.bullet_token}`,
    'Content-Type': 'application/json',
    Referer: `https://api.lp1.av5ja.srv.nintendo.net?lang=${credential.language}&na_country=${credential.country}&na_lang=${credential.language}`,
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Mobile Safari/537.36',
    'X-Requested-With': 'com.nintendo.znca',
    'X-Web-View-Ver': credential.revision
  };
  const options: AxiosRequestConfig = {
    data: body,
    headers: headers,
    method: Method.POST,
    responseType: 'json',
    url: url.href
  };
  // eslint-disable-next-line no-useless-catch
  try {
    const response = await axios.request(options);

    switch (response.status) {
      case 401:
        throw new AxiosError('', StatusCode.ERROR_INVALID_GAME_WEB_TOKEN);
      case 403:
        throw new AxiosError('', StatusCode.ERROR_OBSOLETE_VERSION);
      default:
        break;
    }

    const errors = snakecaseKeys(response.data).errors;
    if (errors !== undefined) {
      if (errors[0].message === 'PersistedQueryNotFound') {
        throw new AxiosError('SHA256Hash update required.', StatusCode.ERROR_DEPRECATED_SHA256HASH);
      }
      throw new AxiosError('Unknown error occurred.', StatusCode.ERROR_UNKNOWN_STATUS);
    }
    return request.request(await submit(request, response.data)) as U;
  } catch (error: any) {
    if (error.isAxiosError) {
      const status_code: number = error.response.status;
      const error_description: string = error.response.data.error_description;
      switch (status_code) {
        case 400:
          throw new AxiosError(error_description, StatusCode.ERROR_INVALID_PARAMETERS, undefined, {
            status: status_code
          });
        case 401:
          throw new AxiosError(error_description, StatusCode.ERROR_INVALID_GAME_WEB_TOKEN, undefined, {
            status: status_code
          });
        case 403:
          throw new AxiosError(error_description, StatusCode.ERROR_OBSOLETE_VERSION, undefined, {
            status: status_code
          });
        case 404:
          throw new AxiosError(error_description, StatusCode.ERROR_NOT_FOUND, undefined, { status: status_code });
        case 429:
          throw new AxiosError(error_description, StatusCode.ERROR_RATE_LIMIT, undefined, { status: status_code });
        case 499:
          throw new AxiosError(error_description, StatusCode.ERROR_BANNED_USER, undefined, { status: status_code });
        case 500:
        case 509:
          throw new AxiosError(error_description, StatusCode.ERROR_SERVER, undefined, { status: status_code });
        case 503:
          throw new AxiosError(error_description, StatusCode.ERROR_SERVER_MAINTENANCE, undefined, {
            status: status_code
          });
        default:
          throw new AxiosError(error_description, StatusCode.ERROR_UNKNOWN_STATUS, undefined, { status: status_code });
      }
    } else {
      throw new AxiosError('UNKNOWN_ERROR', StatusCode.ERROR_UNKNOWN_STATUS);
    }
  }
}
