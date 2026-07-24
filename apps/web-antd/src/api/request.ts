/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientConfig, RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';
import { getCurrentNodeKey } from '#/utils/node-state';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi();
    const newToken = resp.data;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;

      if (config.url?.includes('/zlm/api')) {
        const currentNodeKey = getCurrentNodeKey();

        if (currentNodeKey) {
          config.headers['X-Node-Key'] = currentNodeKey;
        } else {
          console.error('❌ No node key available for ZLM API request');
        }
      }

      return config;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.error ?? responseData?.message ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });

export interface ApiRequestErrorMeta {
  businessCode?: string;
  httpStatus?: number;
  message: string;
  transport: 'abort' | 'network' | 'response' | 'timeout' | 'unknown';
}

export class ApiRequestError extends Error {
  readonly meta: ApiRequestErrorMeta;

  constructor(meta: ApiRequestErrorMeta) {
    super(meta.message);
    this.name = 'ApiRequestError';
    this.meta = meta;
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function toApiRequestErrorMeta(error: unknown): ApiRequestErrorMeta {
  const candidate = error as {
    code?: string;
    config?: { signal?: AbortSignal };
    message?: string;
    name?: string;
    response?: {
      data?: Record<string, unknown>;
      status?: number;
    };
  };
  const data = candidate?.response?.data ?? {};
  const businessCode =
    stringValue(data.businessCode) ??
    stringValue(data.errorCode) ??
    stringValue(data.code);
  const messageText =
    stringValue(data.error) ??
    stringValue(data.message) ??
    stringValue(candidate?.message) ??
    'Request failed';

  let transport: ApiRequestErrorMeta['transport'] = 'unknown';
  if (
    candidate?.name === 'AbortError' ||
    candidate?.code === 'ERR_CANCELED' ||
    candidate?.config?.signal?.aborted
  ) {
    transport = 'abort';
  } else if (
    candidate?.code === 'ECONNABORTED' ||
    candidate?.code === 'ETIMEDOUT' ||
    candidate?.message?.toLowerCase().includes('timeout')
  ) {
    transport = 'timeout';
  } else if (candidate?.response) {
    transport = 'response';
  } else if (
    candidate?.code === 'ERR_NETWORK' ||
    candidate?.message?.includes('Network Error')
  ) {
    transport = 'network';
  }

  return {
    businessCode,
    httpStatus: candidate?.response?.status,
    message: messageText,
    transport,
  };
}

/** Uses the configured client while preserving structured failure metadata. */
export async function requestWithErrorMeta<T>(
  url: string,
  config: RequestClientConfig,
): Promise<T> {
  try {
    const requestConfig: RequestClientConfig & { url: string } = {
      ...config,
      suppressGlobalError: true,
      url,
    };
    return await requestClient.instance.request<T, T>(requestConfig);
  } catch (error) {
    throw new ApiRequestError(toApiRequestErrorMeta(error));
  }
}
