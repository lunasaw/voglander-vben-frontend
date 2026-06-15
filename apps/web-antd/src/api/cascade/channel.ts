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
  /** 通道映射 DTO（时间均 Unix 毫秒，字段以 Time 结尾）。 */
  export interface CascadeChannelVO {
    id?: number;
    platformId?: string;
    localDeviceId?: string;
    localChannelId?: string;
    cascadeChannelId?: string;
    cascadeName?: string;
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
 * 分页查询通道列表
 */
export async function getCascadeChannelPage(params: {
  cascadeChannelId?: string;
  localChannelId?: string;
  localDeviceId?: string;
  page: number;
  platformId?: string;
  size: number;
}) {
  const { page, size, ...queryParams } = params;
  return requestClient.get<CascadeChannelApi.ChannelListResp>(
    `/api/v1/cascade/channel/page`,
    {
      params: {
        page,
        size,
        ...queryParams,
      },
    },
  );
}
