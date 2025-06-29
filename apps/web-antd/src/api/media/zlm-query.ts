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

  /** 重要对象统计 - 修复字段名为小写 */
  export interface ImportantObjectNum {
    buffer: number;
    rtpPacket: number;
    frame: number;
    rtmpPacket: number;
    tcpSession: number;
    udpServer: number;
    tcpServer: number;
    frameImp: number;
    bufferList: number;
    bufferRaw: number;
    mediaSource: number;
    multiMediaSourceMuxer: number;
    tcpClient: number;
    bufferLikeString: number;
    socket: number;
    udpSession: number;
  }

  /** 重要对象统计响应 */
  export interface ServerResponseImportantObjectNum {
    code: number;
    data: ImportantObjectNum;
    msg: string;
    result: string;
  }

  /** 服务器配置项 */
  export interface ServerConfigItem {
    [key: string]: string | null;
  }

  /** 服务器配置 - 修复为数组结构 */
  export type ServerNodeConfig = ServerConfigItem[];

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

  return requestClient.get<ZlmQueryApi.Version>('/zlm/api/version', {
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

  return requestClient.get<string[]>('/zlm/api/api/list', {
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

  return requestClient.get<ZlmQueryApi.ThreadLoad[]>('/zlm/api/threads/load', {
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

  return requestClient.get<ZlmQueryApi.ImportantObjectNum>('/zlm/api/statistic', {
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

  return requestClient.get<ZlmQueryApi.ThreadLoad[]>('/zlm/api/work-threads/load', {
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

  return requestClient.get<ZlmQueryApi.ServerNodeConfig>('/zlm/api/server/config', {
    headers,
  });
}

/**
 * 设置服务器配置
 * @param config 配置参数对象
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function setZlmServerConfig(config: Record<string, string>, nodeKey?: string) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.post<string>('/zlm/api/server/config', config, {
    headers,
  });
}
