import axios, { AxiosRequestConfig } from 'axios';

import { Method } from '@/enum/method';
import { snakecaseKeys } from '@/utils/convert_keys';
export interface ResponseType {}
export type Headers = Record<string, string>;
export type Parameters =
  | URLSearchParams
  | undefined
  | Record<string, string | number | undefined | Record<string, string | number | undefined>>;

export interface RequestType {
  readonly baseURL: string;
  readonly headers: Headers;
  readonly method: Method;
  readonly parameters: Parameters;
  readonly path: string;

  request(response: any): ResponseType | void;
}

export async function request<T extends RequestType, U extends ReturnType<T['request']>>(request: T): Promise<U> {
  const url = new URL(request.path, request.baseURL);
  if (request.method === Method.GET) {
    url.search = new URLSearchParams(request.parameters as Record<string, string>).toString();
  }
  const body = request.method === Method.GET ? undefined : JSON.stringify(request.parameters);
  const options: AxiosRequestConfig = {
    data: body,
    headers: request.headers,
    method: request.method,
    responseType: 'json',
    url: url.href
  };
  try {
    const response = await axios.request(options);
    const status_code: number = response.status ?? 0;
    console.log(status_code, url.href, response.data.status);
    // if (status_code !== 200 && status_code !== 201 && status_code !== 0) {
    //   const error_description: string = response.data.error_description;
    //   const error_message: string = response.data.error_message;
    //   switch (status_code) {
    //     case 400:
    //       throw new AxiosError(error_description, StatusCode.ERROR_INVALID_PARAMETERS);
    //       break;
    //     case 401:
    //       throw new AxiosError(error_description, StatusCode.ERROR_INVALID_GAME_WEB_TOKEN);
    //       break;
    //     case 403:
    //       throw new AxiosError(error_description, StatusCode.ERROR_OBSOLETE_VERSION);
    //       break;
    //     case 404:
    //       throw new AxiosError(error_description, StatusCode.ERROR_NOT_FOUND);
    //       break;
    //     case 429:
    //       throw new AxiosError(error_description, StatusCode.ERROR_RATE_LIMIT);
    //       break;
    //     case 499:
    //       throw new AxiosError(error_description, StatusCode.ERROR_BANNED_USER);
    //       break;
    //     case 500:
    //     case 509:
    //       throw new AxiosError(error_description, StatusCode.ERROR_SERVER);
    //       break;
    //     case 503:
    //       throw new AxiosError(error_description, StatusCode.ERROR_SERVER_MAINTENANCE);
    //       break;
    //     default:
    //       throw new AxiosError(error_description, StatusCode.ERROR_UNKNOWN_STATUS);
    //       break;
    //   }
    // }
    return request.request(snakecaseKeys(response.data)) as U;
  } catch (error: any) {
    console.error(error);
    // if (error.isAxiosError === true) {
    //   const status_code: number = error.response.status;
    //   const error_description: string = error.response.data.error_description;
    //   const error_message: string = error.response.data.error_message;
    //   switch (status_code) {
    //     case 400:
    //       throw new AxiosError(error_description, StatusCode.ERROR_INVALID_PARAMETERS);
    //       break;
    //     case 401:
    //       throw new AxiosError(error_description, StatusCode.ERROR_INVALID_GAME_WEB_TOKEN);
    //       break;
    //     case 403:
    //       throw new AxiosError(error_description, StatusCode.ERROR_OBSOLETE_VERSION);
    //       break;
    //     case 404:
    //       throw new AxiosError(error_description, StatusCode.ERROR_NOT_FOUND);
    //       break;
    //     case 429:
    //       throw new AxiosError(error_description, StatusCode.ERROR_RATE_LIMIT);
    //       break;
    //     case 499:
    //       throw new AxiosError(error_description, StatusCode.ERROR_BANNED_USER);
    //       break;
    //     case 500:
    //     case 509:
    //       throw new AxiosError(error_description, StatusCode.ERROR_SERVER);
    //       break;
    //     case 503:
    //       throw new AxiosError(error_description, StatusCode.ERROR_SERVER_MAINTENANCE);
    //       break;
    //     default:
    //       throw new AxiosError(error_description, StatusCode.ERROR_UNKNOWN_STATUS);
    //       break;
    //   }
    // } else {
    //   throw new AxiosError('UNKNOWN_ERROR', StatusCode.ERROR_UNKNOWN_STATUS);
    // }
  }
}
