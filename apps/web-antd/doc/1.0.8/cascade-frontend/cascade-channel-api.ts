/**
 * 级联通道管理 API
 *
 * 对接后端 CascadeChannelController
 * 路径: /api/v1/cascade/channel
 *
 * @author luna
 */

import { requestClient } from '#/api/request';

export namespace CascadeChannelApi {
  /** 通道映射 DTO */
  export interface Channel {
    id?: number;
    platformId?: string;
    localDeviceId?: string;
    localChannelId?: string;
    cascadeChannelId?: string;
    cascadeName?: string;
    createTime?: string;
    updateTime?: string;
  }

  /** 分页查询参数 */
  export interface PageQuery {
    page?: number;
    size?: number;
    platformId?: string;
  }

  /** 分页响应 */
  export interface PageResult<T> {
    records: T[];
    total: number;
    size: number;
    current: number;
  }
}

const BASE_URL = '/cascade/channel';

/** 新增级联通道映射 */
export async function addChannel(data: CascadeChannelApi.Channel) {
  return requestClient.post<number>(`${BASE_URL}`, data);
}

/** 更新级联通道映射 */
export async function updateChannel(
  id: number,
  data: CascadeChannelApi.Channel,
) {
  return requestClient.put<boolean>(`${BASE_URL}/${id}`, data);
}

/** 删除级联通道映射 */
export async function deleteChannel(id: number) {
  return requestClient.delete<boolean>(`${BASE_URL}/${id}`);
}

/** 查询级联通道详情 */
export async function getChannel(id: number) {
  return requestClient.get<CascadeChannelApi.Channel>(`${BASE_URL}/${id}`);
}

/** 分页查询级联通道 */
export async function getChannelPage(params: CascadeChannelApi.PageQuery) {
  return requestClient.get<
    CascadeChannelApi.PageResult<CascadeChannelApi.Channel>
  >(`${BASE_URL}/page`, { params });
}
