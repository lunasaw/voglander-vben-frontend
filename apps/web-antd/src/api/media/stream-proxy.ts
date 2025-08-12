import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace StreamProxyApi {
  /** 拉流代理信息 */
  export interface StreamProxyVO {
    id?: number;
    createTime?: string;
    updateTime?: string;
    app: string;
    stream: string;
    url: string;
    description?: string;
    status?: number;
    serverId?: string;
    vhost?: string;
    proxyKey?: string;
    onlineStatus?: number;
    retryCount?: number;
    rtpType?: number;
    timeoutSec?: number;
    enableHls?: boolean;
    enableHlsFmp4?: boolean;
    enableMp4?: boolean;
    enableRtsp?: boolean;
    enableRtmp?: boolean;
    enableTs?: boolean;
    enableFmp4?: boolean;
    hlsDemand?: boolean;
    rtspDemand?: boolean;
    rtmpDemand?: boolean;
    tsDemand?: boolean;
    fmp4Demand?: boolean;
    enableAudio?: boolean;
    addMuteAudio?: boolean;
    mp4SavePath?: string;
    mp4MaxSecond?: number;
    mp4AsPlayer?: boolean;
    hlsSavePath?: string;
    modifyStamp?: number;
    autoClose?: boolean;
    extend?: string;
  }

  /** 拉流代理列表响应 */
  export interface StreamProxyListResp {
    items: StreamProxyVO[];
    total: number;
    pageNum: number;
    pageSize: number;
  }

  /** 拉流代理创建请求 */
  export interface StreamProxyCreateReq {
    app: string;
    stream: string;
    url: string;
    description?: string;
    status?: number;
    serverId?: string;
    vhost?: string;
    retryCount?: number;
    rtpType?: number;
    timeoutSec?: number;
    enableHls?: boolean;
    enableHlsFmp4?: boolean;
    enableMp4?: boolean;
    enableRtsp?: boolean;
    enableRtmp?: boolean;
    enableTs?: boolean;
    enableFmp4?: boolean;
    hlsDemand?: boolean;
    rtspDemand?: boolean;
    rtmpDemand?: boolean;
    tsDemand?: boolean;
    fmp4Demand?: boolean;
    enableAudio?: boolean;
    addMuteAudio?: boolean;
    mp4SavePath?: string;
    mp4MaxSecond?: number;
    mp4AsPlayer?: boolean;
    hlsSavePath?: string;
    modifyStamp?: number;
    autoClose?: boolean;
  }

  /** 拉流代理更新请求 */
  export interface StreamProxyUpdateReq {
    id: number;
    app?: string;
    stream?: string;
    url?: string;
    description?: string;
    status?: number;
    serverId?: string;
    extend?: string;
  }

  /** 拉流代理查询请求 */
  export interface StreamProxyQueryReq {
    id?: number;
    app?: string;
    stream?: string;
    proxyKey?: string;
    url?: string;
    description?: string;
    status?: number;
    onlineStatus?: number;
    serverId?: string;
  }

  /** 拉流代理查询参数 */
  export interface StreamProxyQueryParams extends StreamProxyQueryReq {
    pageNum?: number;
    pageSize?: number;
  }
}

/**
 * 根据ID获取代理
 */
async function getStreamProxyById(id: number) {
  return requestClient.get<StreamProxyApi.StreamProxyVO>(
    `/api/v1/proxy/get/${id}`,
  );
}

/**
 * 根据条件查询代理
 */
async function getStreamProxyByCondition(
  params: StreamProxyApi.StreamProxyQueryReq,
) {
  return requestClient.post<StreamProxyApi.StreamProxyVO>(
    '/api/v1/proxy/get',
    params,
  );
}

/**
 * 分页查询代理
 */
async function getStreamProxyPageList(
  params: StreamProxyApi.StreamProxyQueryParams & {
    page: number;
    size: number;
  },
) {
  const { page, size, ...queryParams } = params;
  return requestClient.post<StreamProxyApi.StreamProxyListResp>(
    `/api/v1/proxy/getPage?page=${page}&size=${size}`,
    queryParams,
  );
}

/**
 * 新增拉流代理
 */
async function createStreamProxy(data: StreamProxyApi.StreamProxyCreateReq) {
  return requestClient.post<number>('/api/v1/proxy/add', data);
}

/**
 * 业务创建代理
 */
async function createStreamProxyBusiness(
  data: StreamProxyApi.StreamProxyCreateReq,
) {
  return requestClient.post<number>('/api/v1/proxy/createStreamProxy', data);
}

/**
 * 更新拉流代理
 */
async function updateStreamProxy(data: StreamProxyApi.StreamProxyUpdateReq) {
  return requestClient.put<number>('/api/v1/proxy/update', data);
}

/**
 * 业务更新代理
 */
async function updateStreamProxyBusiness(
  data: StreamProxyApi.StreamProxyUpdateReq,
  operationDesc?: string,
) {
  const params: Recordable<any> = {};
  if (operationDesc) {
    params.operationDesc = operationDesc;
  }
  return requestClient.put<boolean>('/api/v1/proxy/updateStreamProxy', data, {
    params,
  });
}

/**
 * 更新代理状态
 */
async function updateStreamProxyStatus(id: number, status: number) {
  return requestClient.put<boolean>(
    `/api/v1/proxy/updateStatus/${id}?status=${status}`,
  );
}

/**
 * 删除拉流代理
 */
async function deleteStreamProxy(data: StreamProxyApi.StreamProxyUpdateReq) {
  return requestClient.delete<null>('/api/v1/proxy/deleteOne', {
    data,
  });
}

/**
 * 业务删除代理
 */
async function deleteStreamProxyBusiness(
  data: StreamProxyApi.StreamProxyUpdateReq,
) {
  return requestClient.delete<boolean>('/api/v1/proxy/deleteStreamProxy', {
    data,
  });
}

/**
 * 批量删除
 */
async function deleteStreamProxyBatch(
  data: StreamProxyApi.StreamProxyUpdateReq,
) {
  return requestClient.delete<null>('/api/v1/proxy/deleteBatch', {
    data,
  });
}

export {
  createStreamProxy,
  createStreamProxyBusiness,
  deleteStreamProxy,
  deleteStreamProxyBatch,
  deleteStreamProxyBusiness,
  getStreamProxyByCondition,
  getStreamProxyById,
  getStreamProxyPageList,
  updateStreamProxy,
  updateStreamProxyBusiness,
  updateStreamProxyStatus,
};
