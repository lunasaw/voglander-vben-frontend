import { requestClient } from '#/api/request';

/**
 * GB28181 协议验证台 API。
 *
 * 左侧（设备 UA / Client）：触发设备主动发 SIP —— `/api/v1/lab/client/*`
 *   （仅在后端 `voglander.protocol-lab.enabled=true` 时注册）。
 * 右侧（平台 / Server）：复用既有下发端点 —— `/api/v1/ptz|device-cmd|live/*`。
 *
 * 后端响应统一为 AjaxResult{code,msg,data}，requestClient 已配置
 * `responseReturn:'data'` + `successCode:0`，故下列函数直接拿到 `data` 本体。
 */
export namespace ProtocolLabApi {
  /** GET /lab/client/config 返回的身份与端口信息。 */
  export interface LabConfig {
    clientId: string;
    clientIp: string;
    clientPort: number;
    serverId: string;
    serverIp: string;
    serverPort: number;
    /** 后端已就绪的全部 SSE 主题（event: 名 = 完整 topic）。 */
    topics: string[];
  }

  /** POST /lab/client/keepalive/auto 返回的当前调度状态。 */
  export interface KeepaliveAutoState {
    enabled: boolean;
    intervalSec: number;
  }

  export interface RegisterReq {
    /** 注册有效期（秒），注销时后端用 expires=0。 */
    expires?: number;
  }

  export interface KeepaliveAutoReq {
    enabled: boolean;
    /** 心跳间隔（秒），≤0 时后端回落 30s。 */
    intervalSec?: number;
  }

  export interface CatalogPushReq {
    channelCount?: number;
    catalogName?: string;
  }

  export interface DeviceInfoPushReq {
    manufacturer?: string;
    model?: string;
    firmware?: string;
  }

  export interface AlarmPushReq {
    alarmType?: number;
    priority?: number;
    channelId?: string;
  }

  /** 右侧 PTZ 控制请求（既有 /ptz/control 端点）。 */
  export interface PtzControlReq {
    deviceId: string;
    channelId: string;
    /** 词表：UP/DOWN/LEFT/RIGHT/UP_LEFT/.../ZOOM_IN/ZOOM_OUT/STOP（大小写无关，门面层翻译）。 */
    command: string;
    speed?: number;
  }

  /** 右侧实时点播请求（既有 /live/start 端点）。 */
  export interface LiveStartReq {
    deviceId: string;
    channelId: string;
    protocol?: string;
    streamMode?: string;
  }

  export interface LivePlayVO {
    streamId?: string;
    callId?: string;
    status?: number;
    refCount?: number;
    playUrls?: {
      [key: string]: string | undefined;
      hls?: string;
      httpFlv?: string;
      rtmp?: string;
      rtsp?: string;
      wsFlv?: string;
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                       左侧：设备 UA（Client）控制台                          */
/* -------------------------------------------------------------------------- */

const LAB_CLIENT = '/api/v1/lab/client';

/** 读取 Lab 身份与端口配置（页面初始化展示，并校验后端 lab profile 是否开启）。 */
export async function getLabConfig() {
  return requestClient.get<ProtocolLabApi.LabConfig>(`${LAB_CLIENT}/config`);
}

/** 设备主动注册（expires>0）。 */
export async function labRegister(data?: ProtocolLabApi.RegisterReq) {
  return requestClient.post<null>(`${LAB_CLIENT}/register`, data ?? {});
}

/** 设备注销（后端固定 expires=0）。 */
export async function labUnregister() {
  return requestClient.post<null>(`${LAB_CLIENT}/unregister`, {});
}

/** 发送单次心跳。 */
export async function labKeepalive() {
  return requestClient.post<null>(`${LAB_CLIENT}/keepalive`, {});
}

/** 周期心跳开关（返回当前调度状态）。 */
export async function labKeepaliveAuto(data: ProtocolLabApi.KeepaliveAutoReq) {
  return requestClient.post<ProtocolLabApi.KeepaliveAutoState>(
    `${LAB_CLIENT}/keepalive/auto`,
    data,
  );
}

/** 主动上报目录（默认 4 通道）。 */
export async function labPushCatalog(data?: ProtocolLabApi.CatalogPushReq) {
  return requestClient.post<null>(`${LAB_CLIENT}/catalog/push`, data ?? {});
}

/** 主动上报设备信息。 */
export async function labPushDeviceInfo(
  data?: ProtocolLabApi.DeviceInfoPushReq,
) {
  return requestClient.post<null>(`${LAB_CLIENT}/device-info/push`, data ?? {});
}

/** 主动上报告警（右侧 alarm.new 验证）。 */
export async function labPushAlarm(data?: ProtocolLabApi.AlarmPushReq) {
  return requestClient.post<null>(`${LAB_CLIENT}/alarm/push`, data ?? {});
}

/* -------------------------------------------------------------------------- */
/*                    右侧：平台（Server）下发——复用既有端点                     */
/* -------------------------------------------------------------------------- */

/** PTZ 控制（既有端点，门面层 PTZ_VOCAB 翻译词表）。 */
export async function ptzControl(data: ProtocolLabApi.PtzControlReq) {
  return requestClient.post<boolean>('/api/v1/ptz/control', {
    speed: 128,
    ...data,
  });
}

/** 查询目录（既有端点，回包后右侧收 device.catalog）。 */
export async function queryCatalog(deviceId: string) {
  return requestClient.post<null>('/api/v1/device-cmd/query-catalog', {
    deviceId,
  });
}

/** 查询设备信息（既有端点，回包后右侧收 device.info）。 */
export async function queryDeviceInfo(deviceId: string) {
  return requestClient.post<null>('/api/v1/device-cmd/query-info', {
    deviceId,
  });
}

/** 下发重启（既有端点，左侧收 clientcmd.reboot）。 */
export async function rebootDevice(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/reboot', {
    deviceId,
  });
}

/** 实时点播（既有端点，左侧收 clientcmd.invite，返回 playUrls）。 */
export async function liveStart(data: ProtocolLabApi.LiveStartReq) {
  return requestClient.post<ProtocolLabApi.LivePlayVO>('/api/v1/live/start', {
    protocol: 'FLV',
    streamMode: 'UDP',
    ...data,
  });
}
