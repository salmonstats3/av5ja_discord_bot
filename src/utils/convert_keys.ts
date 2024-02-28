import { camelCase, snakeCase, isObject, isArray, reduce, isDate } from 'lodash';

export const camelcaseKeys = (obj: any): any => {
  if (!isObject(obj)) {
    return obj;
  }
  if (isArray(obj)) {
    return obj.map((v: any) => camelcaseKeys(v));
  }
  if (isDate(obj)) {
    return obj;
  }
  return reduce(
    obj,
    (r: any, v: any, k: any) => {
      return {
        ...r,
        [camelCase(k)]: camelcaseKeys(v)
      };
    },
    {}
  );
};

export const snakecaseKeys = (obj: any): any => {
  if (!isObject(obj)) {
    return obj;
  }
  if (isArray(obj)) {
    return obj.map((v: any) => snakecaseKeys(v));
  }
  if (isDate(obj)) {
    return obj;
  }
  return reduce(
    obj,
    (r: any, v: any, k: any): any => {
      return {
        ...r,
        [snakeCase(k)]: snakecaseKeys(v)
      };
    },
    {}
  );
};
