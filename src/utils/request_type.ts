import axios, { AxiosError, AxiosRequestConfig } from 'axios';

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
    url: url.href,
  };
  try {
    const response = await axios.request(options);
    if (response.status !== 200 && response.status !== 201) {
      throw new AxiosError(`Request failed with status code ${response.status}`);
    }
    if (response.data.status !== undefined && response.data.status !== 200) {
      throw new AxiosError(`Request failed with status code ${response.data.status - 9000}`);
    }
    return request.request(snakecaseKeys(response.data)) as U;
  } catch (error: any) {
    const error_description = error.response.data.error_description;
    throw new AxiosError(error_description);
  }
}
