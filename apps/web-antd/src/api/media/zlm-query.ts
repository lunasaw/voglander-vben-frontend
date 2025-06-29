import { requestClient } from '#/api/request';

export namespace ZlmQueryApi {
  /** 版本信息 */
  export interface Version {
    buildTime: string;
    branchName: string;
    commitHash: string;
  }

  /** 版本信息响应 */
  export interface ServerResponseVersion {
    code: number;
    data: Version;
    msg: string;
    result: string;
  }

  /** 线程负载信息 */
  export interface ThreadLoad {
    delay: string;
    load: string;
  }

  /** 线程负载响应 */
  export interface ServerResponseListThreadLoad {
    code: number;
    data: ThreadLoad[];
    msg: string;
    result: string;
  }

  /** 重要对象统计 */
  export interface ImportantObjectNum {
    Buffer: number;
    RtpPacket: number;
    Frame: number;
    RtmpPacket: number;
    TcpSession: number;
    UdpServer: number;
    TcpServer: number;
    FrameImp: number;
    BufferList: number;
    BufferRaw: number;
    MediaSource: number;
    MultiMediaSourceMuxer: number;
    TcpClient: number;
    BufferLikeString: number;
    Socket: number;
    UdpSession: number;
  }

  /** 重要对象统计响应 */
  export interface ServerResponseImportantObjectNum {
    code: number;
    data: ImportantObjectNum;
    msg: string;
    result: string;
  }

  /** 服务器配置 */
  export interface ServerNodeConfig {
    [key: string]: string;
  }

  /** 服务器配置响应 */
  export interface ServerResponseListServerNodeConfig {
    code: number;
    data: ServerNodeConfig;
    msg: string;
    result: string;
  }

  /** API列表响应 */
  export interface ServerResponseListString {
    code: number;
    data: string[];
    msg: string;
    result: string;
  }
}

/**
 * 获取版本信息
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmVersion(nodeKey?: string) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.get<ZlmQueryApi.ServerResponseVersion>('/zlm/api/version', {
    headers,
  });
}

/**
 * 获取API列表
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 * @param key 搜索关键字
 */
export async function getZlmApiList(nodeKey?: string, key?: string) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  const params: Record<string, any> = {};
  if (key) {
    params.key = key;
  }

  return requestClient.get<ZlmQueryApi.ServerResponseListString>('/zlm/api/api/list', {
    headers,
    params,
  });
}

/**
 * 获取网络线程负载
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmThreadsLoad(nodeKey?: string) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.get<ZlmQueryApi.ServerResponseListThreadLoad>('/zlm/api/threads/load', {
    headers,
  });
}

/**
 * 获取主要对象个数统计
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmStatistic(nodeKey?: string) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.get<ZlmQueryApi.ServerResponseImportantObjectNum>('/zlm/api/statistic', {
    headers,
  });
}

/**
 * 获取后台线程负载
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmWorkThreadsLoad(nodeKey?: string) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.get<ZlmQueryApi.ServerResponseListThreadLoad>('/zlm/api/work-threads/load', {
    headers,
  });
}

/**
 * 获取服务器配置
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmServerConfig(nodeKey?: string) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.get<ZlmQueryApi.ServerResponseListServerNodeConfig>('/zlm/api/server/config', {
    headers,
  });
}
