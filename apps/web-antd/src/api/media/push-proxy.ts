import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace PushProxyApi {
  /** ZLM推流扩展参数对象 */
  export interface PushProxyExtendReq {
    vhost?: string;
    retryCount?: number;
    rtpType?: number;
    timeoutSec?: number;
    autoReconnect?: boolean;
    retryInterval?: number;
    enableMonitor?: boolean;
    qualityThreshold?: number;
    maxBitrate?: number;
    minBitrate?: number;
    enableAuth?: boolean;
    authUser?: string;
    authPassword?: string;
    autoStop?: boolean;
    autoStopDelay?: number;
    priority?: number;
    enableEncrypt?: boolean;
    encryptKey?: string;
  }

  /** 推流代理信息 */
  export interface PushProxyVO {
    id?: number;
    createTime?: string;
    updateTime?: string;
    app: string;
    stream: string;
    dstUrl: string;
    schema?: string;
    description?: string;
    status?: number;
    onlineStatus?: number;
    serverId?: string;
    proxyKey?: string;
    enabled?: number;
    extend?: string;
    extendObj?: PushProxyExtendReq;
  }

  /** 推流代理列表响应 */
  export interface PushProxyListResp {
    items: PushProxyVO[];
    total: number;
    pageNum: number;
    pageSize: number;
  }

  /** 推流代理创建请求 */
  export interface PushProxyCreateReq {
    app: string;
    stream: string;
    dstUrl: string;
    schema?: string;
    description?: string;
    status?: number;
    serverId: string;
    pushProxyExtendReq?: PushProxyExtendReq;
  }

  /** 推流代理更新请求 */
  export interface PushProxyUpdateReq {
    id: number;
    app?: string;
    stream?: string;
    dstUrl?: string;
    schema?: string;
    description?: string;
    status?: number;
    serverId?: string;
    pushProxyExtendReq?: PushProxyExtendReq;
  }

  /** 推流代理查询请求 */
  export interface PushProxyQueryReq {
    id?: number;
    app?: string;
    stream?: string;
    dstUrl?: string;
    schema?: string;
    status?: number;
    onlineStatus?: number;
    proxyKey?: string;
    serverId?: string;
    enabled?: number;
    description?: string;
  }

  /** 推流代理查询参数 */
  export interface PushProxyQueryParams extends PushProxyQueryReq {
    pageNum?: number;
    pageSize?: number;
  }
}

/**
 * 根据ID获取推流代理
 */
async function getPushProxyById(id: number) {
  return requestClient.get<PushProxyApi.PushProxyVO>(
    `/api/v1/push-proxy/get/${id}`,
  );
}

/**
 * 根据条件查询推流代理
 */
async function getPushProxyByCondition(params: PushProxyApi.PushProxyQueryReq) {
  return requestClient.post<PushProxyApi.PushProxyVO>(
    '/api/v1/push-proxy/get',
    params,
  );
}

/**
 * 分页查询推流代理
 */
async function getPushProxyPageList(
  params: PushProxyApi.PushProxyQueryParams & {
    page: number;
    size: number;
  },
) {
  const { page, size, ...queryParams } = params;
  return requestClient.post<PushProxyApi.PushProxyListResp>(
    `/api/v1/push-proxy/getPage?page=${page}&size=${size}`,
    queryParams,
  );
}

/**
 * 新增推流代理
 */
async function createPushProxy(data: PushProxyApi.PushProxyCreateReq) {
  return requestClient.post<number>('/api/v1/push-proxy/add', data);
}

/**
 * 业务创建推流代理
 */
async function createPushProxyBusiness(data: PushProxyApi.PushProxyCreateReq) {
  return requestClient.post<number>('/api/v1/push-proxy/createPushProxy', data);
}

/**
 * 业务创建推流代理（指定节点）
 */
async function createPushProxyWithNode(data: PushProxyApi.PushProxyCreateReq) {
  return requestClient.post<number>(
    '/api/v1/push-proxy/createPushProxyWithNode',
    data,
  );
}

/**
 * 更新推流代理
 */
async function updatePushProxy(data: PushProxyApi.PushProxyUpdateReq) {
  return requestClient.put<number>('/api/v1/push-proxy/update', data);
}

/**
 * 业务更新推流代理
 */
async function updatePushProxyBusiness(
  data: PushProxyApi.PushProxyUpdateReq,
  operationDesc?: string,
) {
  const params: Recordable<any> = {};
  if (operationDesc) {
    params.operationDesc = operationDesc;
  }
  return requestClient.put<boolean>(
    '/api/v1/push-proxy/updatePushProxy',
    data,
    {
      params,
    },
  );
}

/**
 * 更新推流代理状态
 */
async function updatePushProxyStatus(id: number, status: number) {
  return requestClient.put<boolean>(
    `/api/v1/push-proxy/updateStatus/${id}?status=${status}`,
  );
}

/**
 * 删除推流代理
 */
async function deletePushProxy(data: PushProxyApi.PushProxyUpdateReq) {
  return requestClient.delete<null>('/api/v1/push-proxy/deleteOne', {
    data,
  });
}

/**
 * 业务删除推流代理
 */
async function deletePushProxyBusiness(data: PushProxyApi.PushProxyUpdateReq) {
  return requestClient.delete<boolean>('/api/v1/push-proxy/deletePushProxy', {
    data,
  });
}

/**
 * 批量删除推流代理
 */
async function deletePushProxyBatch(data: PushProxyApi.PushProxyUpdateReq) {
  return requestClient.delete<null>('/api/v1/push-proxy/deleteBatch', {
    data,
  });
}

/**
 * 启动推流代理
 */
async function startPushProxy(id: number) {
  return requestClient.post<boolean>(`/api/v1/push-proxy/start/${id}`);
}

/**
 * 停止推流代理
 */
async function stopPushProxy(id: number) {
  return requestClient.post<boolean>(`/api/v1/push-proxy/stop/${id}`);
}

/**
 * 检查源流是否在线
 */
async function checkPushProxySource(params: {
  app: string;
  serverId: string;
  stream: string;
}) {
  return requestClient.get<boolean>('/api/v1/push-proxy/checkSource', {
    params,
  });
}

export {
  checkPushProxySource,
  createPushProxy,
  createPushProxyBusiness,
  createPushProxyWithNode,
  deletePushProxy,
  deletePushProxyBatch,
  deletePushProxyBusiness,
  getPushProxyByCondition,
  getPushProxyById,
  getPushProxyPageList,
  startPushProxy,
  stopPushProxy,
  updatePushProxy,
  updatePushProxyBusiness,
  updatePushProxyStatus,
};
