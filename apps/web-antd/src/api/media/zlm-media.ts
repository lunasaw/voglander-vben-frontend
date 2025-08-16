import { requestClient } from '#/api/request';

export namespace ZlmMediaApi {
  /** 媒体请求参数 */
  export interface MediaReq {
    /** 筛选协议，例如 rtsp或rtmp */
    schema?: string;
    /** 筛选虚拟主机，例如__defaultVhost__ */
    vhost?: string;
    /** 筛选应用名，例如 live */
    app?: string;
    /** 筛选流id，例如 test */
    stream?: string;
  }

  /** 媒体播放器信息 */
  export interface MediaPlayer {
    /** 会话唯一标识符 */
    identifier: string;
    /** 本地IP地址 */
    local_ip: string;
    /** 本地端口号 */
    local_port: number;
    /** 对端IP地址 */
    peer_ip: string;
    /** 对端端口号 */
    peer_port: number;
    /** 类型标识符 */
    typeid: string;
  }

  /** 音视频轨道信息 */
  export interface Track {
    /** 音频通道数 */
    channels: number;
    /** 编码ID. H264 = 0, H265 = 1, AAC = 2, G711A = 3, G711U = 4 */
    codec_id: number;
    /** 编码类型的名称 */
    codec_id_name: string;
    /** 类型. 视频 = 0, 音频 = 1 */
    codec_type: number;
    /** 视频的帧率 */
    fps: number;
    /** 视频的高度 */
    height: number;
    /** 轨道是否准备就绪 */
    ready: boolean;
    /** 视频的宽度 */
    width: number;
    /** 累计接收帧数 */
    frames: number;
    /** 音频采样位数 */
    sample_bit: number;
    /** 音频采样率 */
    sample_rate: number;
    /** gop间隔时间，单位毫秒 */
    gop_interval_ms: number;
    /** gop大小，单位帧数 */
    gop_size: number;
    /** 累计接收关键帧数 */
    key_frames: number;
  }

  /** 媒体数据 */
  export interface MediaData {
    /** 应用名 */
    app: string;
    /** 本协议观看人数 */
    readerCount: number;
    /** 观看总人数，包括hls/rtsp/rtmp/http-flv/ws-flv */
    totalReaderCount: number;
    /** 协议 */
    schema: string;
    /** 流id */
    stream: string;
    /** 客户端和服务器网络信息，可能为null类型 */
    originSock: MediaPlayer | null;
    /** 产生源类型，包括 unknown = 0,rtmp_push=1,rtsp_push=2,rtp_push=3,pull=4,ffmpeg_pull=5,mp4_vod=6,device_chn=7 */
    originType: number;
    /** 产生源类型字符串描述 */
    originTypeStr: string;
    /** 产生源的url */
    originUrl: string;
    /** GMT unix系统时间戳，单位秒 */
    createStamp: number;
    /** 存活时间，单位秒 */
    aliveSecond: number;
    /** 数据产生速度，单位byte/s */
    bytesSpeed: number;
    /** 音视频轨道 */
    tracks: Track[];
    /** 虚拟主机名 */
    vhost: string;
  }

  /** 媒体列表响应 */
  export interface ServerResponseListMediaData {
    code: number;
    data: MediaData[];
    msg: string;
    result: string;
  }

  /** 关闭流请求参数 */
  export interface CloseStreamsReq extends MediaReq {
    /** 强制关闭标志 */
    force?: number;
  }

  /** 媒体在线状态响应 */
  export interface MediaOnlineStatus {
    code: number;
    data: string;
    msg: string;
    result: string;
    online: string;
  }

  /** 媒体信息详情 - 包含更完整的信息 */
  export interface MediaInfoDetail {
    /** 状态码 */
    code: number;
    /** 会话是否在线 */
    online: boolean;
    /** 本协议的观看人数 */
    readerCount: number;
    /** 观看总人数，包括hls/rtsp/rtmp/http-flv/ws-flv */
    totalReaderCount: number;
    /** 轨道列表 */
    tracks: Track[];
    /** 存活时间，单位秒 */
    aliveSecond: number;
    /** 应用名 */
    app: string;
    /** 数据产生速度，单位byte/s */
    bytesSpeed: number;
    /** GMT unix系统时间戳，单位秒 */
    createStamp: number;
    /** 客户端和服务器网络信息，可能为null类型 */
    originSock: MediaPlayer | null;
    /** 产生源类型，包括 unknown = 0,rtmp_push=1,rtsp_push=2,rtp_push=3,pull=4,ffmpeg_pull=5,mp4_vod=6,device_chn=7 */
    originType: number;
    /** 产生源类型字符串描述 */
    originTypeStr: string;
    /** 产生源的url */
    originUrl: string;
    /** 协议 */
    schema: string;
    /** 流id */
    stream: string;
    /** 总字节数 */
    totalBytes?: number;
    /** 虚拟主机名 */
    vhost: string;
    /** HLS录制状态 */
    recordingHLS?: boolean;
    /** MP4录制状态 */
    recordingMP4?: boolean;
  }

  /** 媒体信息响应 */
  export interface ServerResponseMediaInfo {
    code: number;
    data: MediaInfoDetail;
    msg: string;
    result: string;
  }

  /** 播放地址信息 */
  export interface PlayUrls {
    /** RTSP播放地址 */
    rtsp?: string;
    /** RTMP播放地址 */
    rtmp?: string;
    /** HTTP-FLV播放地址 */
    httpFlv?: string;
    /** WebSocket-FLV播放地址 */
    wsFlv?: string;
    /** HLS播放地址 */
    hls?: string;
    /** WebRTC播放地址 */
    webrtc?: string;
    /** HTTP-TS播放地址 */
    httpTs?: string;
    /** WebSocket-TS播放地址 */
    wsTs?: string;
    /** HTTP-fMP4播放地址 */
    httpFmp4?: string;
    /** WebSocket-fMP4播放地址 */
    wsFmp4?: string;
  }

  /** 播放地址响应 */
  export interface ServerResponsePlayUrls {
    code: number;
    data: PlayUrls;
    msg: string;
    result: string;
  }

  /** 基础服务器响应 */
  export interface ServerResponse {
    code: number;
    data: string;
    msg: string;
    result: string;
  }
}

/**
 * 获取流列表
 * @param params 媒体请求参数
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmMediaList(
  params?: ZlmMediaApi.MediaReq,
  nodeKey?: string,
) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  // 设置默认参数
  const requestParams: ZlmMediaApi.MediaReq = {
    schema: 'rtsp',
    vhost: '__defaultVhost__',
    ...params,
  };

  return requestClient.post<ZlmMediaApi.MediaData[]>(
    '/zlm/api/media/list',
    requestParams,
    {
      headers,
    },
  );
}

/**
 * 指定节点获取流列表
 * @param nodeId 节点ID
 * @param params 媒体请求参数
 */
export async function getZlmNodeMediaList(
  nodeId: string,
  params?: ZlmMediaApi.MediaReq,
) {
  // 设置默认参数
  const requestParams: ZlmMediaApi.MediaReq = {
    schema: 'rtsp',
    vhost: '__defaultVhost__',
    ...params,
  };

  return requestClient.post<ZlmMediaApi.MediaData[]>(
    `/zlm/api/node/${nodeId}/media/list`,
    requestParams,
  );
}

/**
 * 关断单个流
 * @param params 媒体请求参数
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function closeZlmMedia(
  params: ZlmMediaApi.MediaReq,
  nodeKey?: string,
) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.post<string>('/zlm/api/media/close', params, {
    headers,
  });
}

/**
 * 批量关断流
 * @param params 关闭流请求参数
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function closeBatchZlmMedia(
  params: ZlmMediaApi.CloseStreamsReq,
  nodeKey?: string,
) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.post<Record<string, any>>(
    '/zlm/api/media/close-batch',
    params,
    {
      headers,
    },
  );
}

/**
 * 检查流是否在线
 * @param params 媒体请求参数
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function checkZlmMediaOnline(
  params: ZlmMediaApi.MediaReq,
  nodeKey?: string,
) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.post<ZlmMediaApi.MediaOnlineStatus>(
    '/zlm/api/media/online',
    params,
    {
      headers,
    },
  );
}

/**
 * 获取流信息
 * @param params 媒体请求参数
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmMediaInfo(
  params: ZlmMediaApi.MediaReq,
  nodeKey?: string,
) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.post<ZlmMediaApi.MediaInfoDetail>(
    '/zlm/api/media/info',
    params,
    {
      headers,
    },
  );
}

/**
 * 获取流播放地址
 * @param params 媒体请求参数
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmMediaPlayUrls(
  params: ZlmMediaApi.MediaReq,
  nodeKey?: string,
) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.post<ZlmMediaApi.ServerResponsePlayUrls>(
    '/zlm/api/media/play-urls',
    params,
    {
      headers,
    },
  );
}

/**
 * 获取媒体流播放器列表
 * @param params 媒体请求参数
 * @param nodeKey 节点Key，通过X-Node-Key header传递
 */
export async function getZlmMediaPlayerList(
  params: ZlmMediaApi.MediaReq,
  nodeKey?: string,
) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.post<ZlmMediaApi.MediaPlayer>(
    '/zlm/api/media/player/list',
    params,
    {
      headers,
    },
  );
}
