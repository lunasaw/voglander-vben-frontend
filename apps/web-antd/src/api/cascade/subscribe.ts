import { requestClient } from '#/api/request';

/**
 * 级联订阅查询 API（Cascade Subscribe，只读）。
 *
 * 展示某上级平台对本平台订阅了哪些信息（目录/告警/位置），用于订阅状态可视化。
 *
 * Base URL: `/api/v1/cascade/subscribe`
 */
export namespace CascadeSubscribeApi {
  /** 订阅 VO（镜像后端 CascadeSubscribeVO，时间 Unix 毫秒）。 */
  export interface CascadeSubscribeVO {
    id?: number;
    platformId?: string;
    /** CATALOG / ALARM / MOBILE_POSITION */
    subType?: string;
    subTypeName?: string;
    callId?: string;
    sn?: string;
    expires?: number;
    intervalSec?: number;
    /** 过期时间（Unix 毫秒） */
    expireTime?: number;
    /** 0已过期 1活跃 */
    status?: number;
    statusName?: string;
    createTime?: number;
    updateTime?: number;
  }
}

/**
 * 按平台查询活跃订阅清单
 */
export async function getCascadeSubscribeList(platformId: string) {
  return requestClient.get<CascadeSubscribeApi.CascadeSubscribeVO[]>(
    '/api/v1/cascade/subscribe/list',
    { params: { platformId } },
  );
}
