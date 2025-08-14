import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace MediaNodeApi {
  /** 流媒体节点信息 */
  export interface MediaNodeVO {
    id?: number;
    createTime?: string;
    updateTime?: string;
    serverId: string;
    name?: string;
    host: string;
    secret?: string;
    enabled?: boolean;
    hookEnabled?: boolean;
    weight?: number;
    keepalive?: number;
    status?: number;
    description?: string;
    extend?: string;
  }

  /** 流媒体节点列表响应 */
  export interface MediaNodeListResp {
    items: MediaNodeVO[];
    total: number;
    pageNum: number;
    pageSize: number;
  }

  /** 流媒体节点创建请求 */
  export interface MediaNodeCreateReq {
    serverId: string;
    name?: string;
    host: string;
    secret?: string;
    enabled?: boolean;
    hookEnabled?: boolean;
    weight?: number;
    description?: string;
    extend?: string;
  }

  /** 流媒体节点更新请求 */
  export interface MediaNodeUpdateReq {
    id: number;
    serverId?: string;
    name?: string;
    host?: string;
    secret?: string;
    enabled?: boolean;
    hookEnabled?: boolean;
    weight?: number;
    description?: string;
    extend?: string;
  }

  /** 流媒体节点查询参数 */
  export interface MediaNodeQueryParams {
    id?: number;
    createTime?: string;
    updateTime?: string;
    serverId?: string;
    name?: string;
    host?: string;
    secret?: string;
    enabled?: boolean;
    hookEnabled?: boolean;
    weight?: number;
    keepalive?: number;
    status?: number;
    description?: string;
    extend?: string;
    pageNum?: number;
    pageSize?: number;
  }
}

/**
 * 根据ID获取节点
 */
async function getMediaNodeById(id: number) {
  return requestClient.get<MediaNodeApi.MediaNodeVO>(
    `/api/v1/mediaNode/get/${id}`,
  );
}

/**
 * 根据节点ID获取节点
 */
async function getMediaNodeByServerId(serverId: string) {
  return requestClient.get<MediaNodeApi.MediaNodeVO>(
    `/api/v1/mediaNode/getByServerId/${serverId}`,
  );
}

/**
 * 根据条件查询节点
 */
async function getMediaNodeByCondition(
  params: MediaNodeApi.MediaNodeQueryParams,
) {
  return requestClient.get<MediaNodeApi.MediaNodeVO>('/api/v1/mediaNode/get', {
    params,
  });
}

/**
 * 获取节点列表
 */
async function getMediaNodeList(params?: MediaNodeApi.MediaNodeQueryParams) {
  return requestClient.get<MediaNodeApi.MediaNodeListResp>(
    '/api/v1/mediaNode/list',
    { params },
  );
}

/**
 * 获取启用的节点列表
 */
async function getEnabledMediaNodeList() {
  return requestClient.get<MediaNodeApi.MediaNodeListResp>(
    '/api/v1/mediaNode/listEnabled',
  );
}

/**
 * 获取在线的节点列表
 */
async function getOnlineMediaNodeList() {
  return requestClient.get<MediaNodeApi.MediaNodeListResp>(
    '/api/v1/mediaNode/listOnline',
  );
}

/**
 * 分页查询节点
 */
async function getMediaNodePageList(
  params: MediaNodeApi.MediaNodeQueryParams & {
    pageNum: number;
    pageSize: number;
  },
) {
  return requestClient.get<MediaNodeApi.MediaNodeListResp>(
    `/api/v1/mediaNode/pageListByEntity/${params.pageNum}/${params.pageSize}`,
    { params: { ...params, pageNum: undefined, pageSize: undefined } },
  );
}

/**
 * 简单分页查询
 */
async function getSimpleMediaNodePageList(pageNum: number, pageSize: number) {
  return requestClient.get<MediaNodeApi.MediaNodeListResp>(
    `/api/v1/mediaNode/pageList/${pageNum}/${pageSize}`,
  );
}

/**
 * 创建节点
 */
async function createMediaNode(data: MediaNodeApi.MediaNodeCreateReq) {
  return requestClient.post<any>('/api/v1/mediaNode/insert', data);
}

/**
 * 批量创建节点
 */
async function createMediaNodeBatch(data: MediaNodeApi.MediaNodeCreateReq[]) {
  return requestClient.post<any>('/api/v1/mediaNode/insertBatch', data);
}

/**
 * 更新节点
 */
async function updateMediaNode(data: MediaNodeApi.MediaNodeUpdateReq) {
  return requestClient.put<any>('/api/v1/mediaNode/update', data);
}

/**
 * 批量更新节点
 */
async function updateMediaNodeBatch(data: MediaNodeApi.MediaNodeUpdateReq[]) {
  return requestClient.put<any>('/api/v1/mediaNode/updateBatch', data);
}

/**
 * 更新节点状态
 */
async function updateMediaNodeStatus(
  serverId: string,
  status: number,
  keepalive?: number,
) {
  const params: Recordable<any> = { status };
  if (keepalive !== undefined) {
    params.keepalive = keepalive;
  }
  return requestClient.put<any>(
    `/api/v1/mediaNode/updateStatus/${serverId}`,
    null,
    { params },
  );
}

/**
 * 删除节点
 */
async function deleteMediaNode(id: number) {
  return requestClient.delete<any>(`/api/v1/mediaNode/delete/${id}`);
}

/**
 * 根据节点ID删除
 */
async function deleteMediaNodeByServerId(serverId: string) {
  return requestClient.delete<any>(
    `/api/v1/mediaNode/deleteByServerId/${serverId}`,
  );
}

/**
 * 批量删除节点
 */
async function deleteMediaNodeBatch(ids: number[]) {
  return requestClient.delete<any>('/api/v1/mediaNode/deleteIds', {
    data: ids,
  });
}

/**
 * 根据条件删除节点
 */
async function deleteMediaNodeByCondition(condition: MediaNodeApi.MediaNodeVO) {
  return requestClient.delete<any>('/api/v1/mediaNode/deleteByCondition', {
    data: condition,
  });
}

export {
  createMediaNode,
  createMediaNodeBatch,
  deleteMediaNode,
  deleteMediaNodeBatch,
  deleteMediaNodeByCondition,
  deleteMediaNodeByServerId,
  getEnabledMediaNodeList,
  getMediaNodeByCondition,
  getMediaNodeById,
  getMediaNodeByServerId,
  getMediaNodeList,
  getMediaNodePageList,
  getOnlineMediaNodeList,
  getSimpleMediaNodePageList,
  updateMediaNode,
  updateMediaNodeBatch,
  updateMediaNodeStatus,
};
