import { requestClient } from '#/api/request';

/**
 * 级联平台管理 API（Cascade Platform Management）。
 *
 * 后端响应统一 AjaxResult{code,msg,data}，requestClient 已配 `responseReturn:'data'`
 * + `successCode:0`，故下列函数直接拿到 `data` 本体。
 *
 * Base URL: `/api/v1/cascade/platform`
 */
export namespace CascadePlatformApi {
  /** 平台配置 DTO（时间均 Unix 毫秒，字段以 Time 结尾）。 */
  export interface CascadePlatformVO {
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
    enabled?: number; // 0-停用 1-启用
    createTime?: number;
    updateTime?: number;
  }

  /** 平台分页查询请求。 */
  export interface PlatformPageReq {
    platformId?: string;
    platformName?: string;
    serverIp?: string;
    enabled?: number;
  }

  /** 平台列表响应。 */
  export interface PlatformListResp {
    total: number;
    items: CascadePlatformVO[];
  }

  /** 平台创建请求。 */
  export interface PlatformCreateReq {
    platformId: string;
    platformName?: string;
    serverIp: string;
    serverPort: number;
    serverDomain?: string;
    localClientId: string;
    localClientIp?: string;
    localClientPort?: number;
    transport?: string;
    username?: string;
    password?: string;
    registerExpires?: number;
    keepaliveInterval?: number;
  }

  /** 平台更新请求。 */
  export interface PlatformUpdateReq {
    id: number;
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
  }
}

/**
 * 新增上级平台
 */
export async function createCascadePlatform(
  data: CascadePlatformApi.PlatformCreateReq,
) {
  return requestClient.post<number>('/api/v1/cascade/platform', data);
}

/**
 * 更新上级平台
 */
export async function updateCascadePlatform(
  id: number,
  data: CascadePlatformApi.PlatformUpdateReq,
) {
  return requestClient.put<number>(`/api/v1/cascade/platform/${id}`, data);
}

/**
 * 删除上级平台
 */
export async function deleteCascadePlatform(id: number) {
  return requestClient.delete<boolean>(`/api/v1/cascade/platform/${id}`);
}

/**
 * 查询平台详情
 */
export async function getCascadePlatformById(id: number) {
  return requestClient.get<CascadePlatformApi.CascadePlatformVO>(
    `/api/v1/cascade/platform/${id}`,
  );
}

/**
 * 分页查询平台列表
 */
export async function getCascadePlatformPage(params: {
  enabled?: number;
  page: number;
  platformId?: string;
  platformName?: string;
  serverIp?: string;
  size: number;
}) {
  const { page, size, ...queryParams } = params;
  return requestClient.get<CascadePlatformApi.PlatformListResp>(
    `/api/v1/cascade/platform/page`,
    {
      params: {
        page,
        size,
        ...queryParams,
      },
    },
  );
}

/**
 * 启用平台（启动注册调度）
 */
export async function enableCascadePlatform(id: number) {
  return requestClient.post<boolean>(`/api/v1/cascade/platform/${id}/enable`);
}

/**
 * 停用平台（停止注册调度）
 */
export async function disableCascadePlatform(id: number) {
  return requestClient.post<boolean>(`/api/v1/cascade/platform/${id}/disable`);
}

/**
 * 刷新调度（批量刷新注册任务）
 */
export async function refreshCascadeScheduler() {
  return requestClient.post<boolean>('/api/v1/cascade/platform/refresh');
}
