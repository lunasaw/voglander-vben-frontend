import { requestClient } from '#/api/request';

/**
 * 级联通道管理 API（Cascade Channel Management）。
 *
 * 后端响应统一 AjaxResult{code,msg,data}，requestClient 已配 `responseReturn:'data'`
 * + `successCode:0`，故下列函数直接拿到 `data` 本体。
 *
 * Base URL: `/api/v1/cascade/channel`
 */
export namespace CascadeChannelApi {
  /** 通道映射 VO（镜像后端 CascadeChannelVO，时间 Unix 毫秒）。 */
  export interface CascadeChannelVO {
    id?: number;
    platformId?: string;
    localDeviceId?: string;
    localChannelId?: string;
    cascadeChannelId?: string;
    cascadeName?: string;
    /** 启用状态 0停用 1启用 */
    enabled?: number;
    createTime?: number;
    updateTime?: number;
  }

  /** 通道分页查询请求。 */
  export interface ChannelPageReq {
    platformId?: string;
    localDeviceId?: string;
    localChannelId?: string;
    cascadeChannelId?: string;
  }

  /** 通道列表响应。 */
  export interface ChannelListResp {
    total: number;
    items: CascadeChannelVO[];
  }

  /** 通道创建请求。 */
  export interface ChannelCreateReq {
    platformId: string;
    localDeviceId: string;
    localChannelId: string;
    cascadeChannelId: string;
    cascadeName?: string;
  }

  /** 通道更新请求。 */
  export interface ChannelUpdateReq {
    id: number;
    platformId?: string;
    localDeviceId?: string;
    localChannelId?: string;
    cascadeChannelId?: string;
    cascadeName?: string;
  }

  /** 批量绑定单条。 */
  export interface BatchBindItem {
    localDeviceId?: string;
    localChannelId: string;
    cascadeChannelId?: string;
    cascadeName?: string;
  }

  /** 批量绑定请求。 */
  export interface BatchBindReq {
    platformId: string;
    channels: BatchBindItem[];
  }
}

/**
 * 新增通道映射
 */
export async function createCascadeChannel(
  data: CascadeChannelApi.ChannelCreateReq,
) {
  return requestClient.post<number>('/api/v1/cascade/channel', data);
}

/**
 * 更新通道映射
 */
export async function updateCascadeChannel(
  id: number,
  data: CascadeChannelApi.ChannelUpdateReq,
) {
  return requestClient.put<number>(`/api/v1/cascade/channel/${id}`, data);
}

/**
 * 删除通道映射
 */
export async function deleteCascadeChannel(id: number) {
  return requestClient.delete<boolean>(`/api/v1/cascade/channel/${id}`);
}

/**
 * 查询通道详情
 */
export async function getCascadeChannelById(id: number) {
  return requestClient.get<CascadeChannelApi.CascadeChannelVO>(
    `/api/v1/cascade/channel/${id}`,
  );
}

/**
 * 分页查询通道列表（POST /getPage，page/size 走 query，条件走 body）。
 */
export async function getCascadeChannelPage(params: {
  cascadeChannelId?: string;
  localChannelId?: string;
  localDeviceId?: string;
  page: number;
  platformId?: string;
  size: number;
}) {
  const { page, size, ...body } = params;
  return requestClient.post<CascadeChannelApi.ChannelListResp>(
    `/api/v1/cascade/channel/getPage`,
    body,
    { params: { page, size } },
  );
}

/**
 * 批量绑定级联通道（已存在的跳过，返回新增条数）。
 */
export async function batchBindCascadeChannels(
  data: CascadeChannelApi.BatchBindReq,
) {
  return requestClient.post<number>('/api/v1/cascade/channel/batchBind', data);
}
