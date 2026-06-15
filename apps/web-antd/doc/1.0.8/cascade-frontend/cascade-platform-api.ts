/**
 * 级联平台管理 API
 *
 * 对接后端 CascadePlatformController
 * 路径: /api/v1/cascade/platform
 *
 * @author luna
 */

import { requestClient } from '#/api/request';

export namespace CascadePlatformApi {
  /** 平台配置 DTO */
  export interface Platform {
    id?: number;
    platformId?: string;
    platformName?: string;
    serverIp?: string;
    serverPort?: number;
    serverDomain?: string;
    localClientId?: string;
    localClientIp?: string;
    localClientPort?: number;
    transport?: string;
    username?: string;
    password?: string;
    registerExpires?: number;
    keepaliveInterval?: number;
    enabled?: number;
    createTime?: string;
    updateTime?: string;
  }

  /** 分页查询参数 */
  export interface PageQuery {
    page?: number;
    size?: number;
    enabled?: number;
  }

  /** 分页响应 */
  export interface PageResult<T> {
    records: T[];
    total: number;
    size: number;
    current: number;
  }
}

const BASE_URL = '/cascade/platform';

/** 新增上级平台 */
export async function addPlatform(data: CascadePlatformApi.Platform) {
  return requestClient.post<number>(`${BASE_URL}`, data);
}

/** 更新上级平台 */
export async function updatePlatform(
  id: number,
  data: CascadePlatformApi.Platform,
) {
  return requestClient.put<boolean>(`${BASE_URL}/${id}`, data);
}

/** 删除上级平台 */
export async function deletePlatform(id: number) {
  return requestClient.delete<boolean>(`${BASE_URL}/${id}`);
}

/** 查询上级平台详情 */
export async function getPlatform(id: number) {
  return requestClient.get<CascadePlatformApi.Platform>(`${BASE_URL}/${id}`);
}

/** 分页查询上级平台 */
export async function getPlatformPage(params: CascadePlatformApi.PageQuery) {
  return requestClient.get<
    CascadePlatformApi.PageResult<CascadePlatformApi.Platform>
  >(`${BASE_URL}/page`, { params });
}

/** 启用上级平台 */
export async function enablePlatform(id: number) {
  return requestClient.post<boolean>(`${BASE_URL}/${id}/enable`);
}

/** 停用上级平台 */
export async function disablePlatform(id: number) {
  return requestClient.post<boolean>(`${BASE_URL}/${id}/disable`);
}

/** 批量刷新注册调度 */
export async function refreshRegistrations() {
  return requestClient.post<void>(`${BASE_URL}/refresh`);
}
