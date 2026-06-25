import { requestClient } from '#/api/request';

/**
 * 级联平台管理 API（Cascade Platform Management）。
 *
 * 后端响应统一 AjaxResult{code,msg,data}，requestClient 已配 `responseReturn:'data'`
 * + `successCode:0`，故下列函数直接拿到 `data` 本体。
 *
 * 字段严格镜像后端 CascadePlatformVO（tb_cascade_platform）：
 * platformIp / platformPort / platformDomain / localIp / localPort（非 serverIp 等）。
 * 时间字段为 Unix 毫秒（number），字段以 Time 结尾。
 *
 * Base URL: `/api/v1/cascade/platform`
 */
export namespace CascadePlatformApi {
  /** 平台配置 VO（镜像后端 CascadePlatformVO，时间 Unix 毫秒）。 */
  export interface CascadePlatformVO {
    id?: number;
    /** 上级平台国标 ID（20 位） */
    platformId?: string;
    /** 上级平台 IP */
    platformIp?: string;
    /** 上级平台端口 */
    platformPort?: number;
    /** 上级平台域（SIP domain） */
    platformDomain?: string;
    /** 认证用户名 */
    username?: string;
    /** 认证密码 */
    password?: string;
    /** 本端客户端国标 ID（20 位） */
    localClientId?: string;
    /** 本端 IP */
    localIp?: string;
    /** 本端端口 */
    localPort?: number;
    /** 启用状态 0停用 1启用 */
    enabled?: number;
    /** 注册状态 0离线 1在线 2注册中 3失败 */
    registerStatus?: number;
    /** 注册状态显示名称 */
    registerStatusName?: string;
    /** 保活心跳间隔(秒) */
    keepaliveInterval?: number;
    /** 注册有效期(秒) */
    registerExpires?: number;
    /** 编码（GB2312/UTF-8） */
    charset?: string;
    /** 传输协议 UDP/TCP */
    transport?: string;
    /** 扩展字段 */
    extend?: string;
    /** 创建时间（Unix 毫秒�� */
    createTime?: number;
    /** 更新时间（Unix 毫秒） */
    updateTime?: number;
  }

  /** 平台分页查询条件（POST body）。 */
  export interface PlatformPageReq {
    platformId?: string;
    platformIp?: string;
    enabled?: number;
    registerStatus?: number;
  }

  /** 平台列表响应。 */
  export interface PlatformListResp {
    total: number;
    items: CascadePlatformVO[];
  }

  /** 平台创建请求。 */
  export interface PlatformCreateReq {
    platformId: string;
    platformIp: string;
    platformPort: number;
    platformDomain?: string;
    username?: string;
    password?: string;
    localClientId: string;
    localIp?: string;
    localPort?: number;
    keepaliveInterval?: number;
    registerExpires?: number;
    charset?: string;
    transport?: string;
  }

  /** 平台更新请求（platformId 展示不可改）。 */
  export interface PlatformUpdateReq {
    id: number;
    platformId?: string;
    platformIp?: string;
    platformPort?: number;
    platformDomain?: string;
    username?: string;
    password?: string;
    localClientId?: string;
    localIp?: string;
    localPort?: number;
    keepaliveInterval?: number;
    registerExpires?: number;
    charset?: string;
    transport?: string;
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
  return requestClient.put<boolean>(`/api/v1/cascade/platform/${id}`, data);
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
 * 分页查询平台列表（POST /getPage，page/size 走 query，条件走 body）。
 */
export async function getCascadePlatformPage(params: {
  enabled?: number;
  page: number;
  platformId?: string;
  platformIp?: string;
  registerStatus?: number;
  size: number;
}) {
  const { page, size, ...body } = params;
  return requestClient.post<CascadePlatformApi.PlatformListResp>(
    `/api/v1/cascade/platform/getPage`,
    body,
    { params: { page, size } },
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
