import { requestClient } from '#/api/request';

/**
 * GB28181 设备管理 API（S4 前端）。
 *
 * 后端响应统一 AjaxResult{code,msg,data}，requestClient 已配 `responseReturn:'data'`
 * + `successCode:0`，故下列函数直接拿到 `data` 本体。
 *
 * 端点分三类（GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md）：
 *  - §1.1 设备分页：`/device/getPage`（S1 新端点）
 *  - §1.3 复用既有：`/ptz/*`、`/live/*`（协议台 ServerPanel 已验证，与之同源，勿重建）
 *  - §1.2 S2 支链：`/device-cmd/*`（query-status/preset/mobile-position、config、record、alarm、broadcast）
 *
 * 路径全部用完整 `/api/v1/...` 前缀（与 protocol-lab.ts 一致）：requestClient baseURL=apiURL，
 * dev 下 `/api` 被 vite 代理剥离首段转 :8081，无 404 风险（§缺口 G5 已确认）。
 */
export namespace DeviceApi {
  /** 设备分页筛选请求（全部可选，时间为 Unix 毫秒）。 */
  export interface DevicePageReq {
    id?: number;
    deviceId?: string; // 精确
    name?: string; // 模糊
    status?: number; // 1在线/0离线
    type?: number; // 协议类型 DeviceAgreementEnum
    ip?: string; // 模糊
    serverIp?: string; // 注册节点，精确
    keepaliveTimeStart?: number; // 心跳时间范围（Unix 毫秒）
    keepaliveTimeEnd?: number;
    registerTimeStart?: number; // 注册时间范围
    registerTimeEnd?: number;
  }

  /** 设备扩展信息（含 S3 设备应答快照，均为 JSON 字符串）。 */
  export interface ExtendInfoVO {
    serialNumber?: string;
    transport?: string;
    expires?: number;
    password?: string;
    streamMode?: string;
    charset?: string;
    deviceInfo?: string;
    // S3 设备应答快照（JSON 字符串）
    deviceStatus?: string;
    ptzPosition?: string;
    presets?: string;
    config?: string;
    configDownload?: string;
    sdCardStatus?: string;
  }

  /** 设备出参（时间均 Unix 毫秒，字段以 Time 结尾）。 */
  export interface DeviceVO {
    id: number;
    deviceId: string;
    name?: string;
    ip?: string;
    port?: number;
    serverIp?: string;
    status: number; // 1/0
    statusName: string; // "在线"/"离线"（后端已派生）
    type?: number;
    typeName?: string;
    subType?: number; // 派生展示
    subTypeName?: string;
    protocol?: number; // 派生展示
    protocolName?: string;
    createTime?: number;
    updateTime?: number;
    registerTime?: number;
    keepaliveTime?: number;
    channelCount?: number; // S1 新增：该设备下通道数
    extend?: string;
    extendInfo?: ExtendInfoVO;
    // GB28181-2022 §9.11 订阅意图开关状态（后端批量回填）
    subscription?: SubscriptionVO;
  }

  /** 订阅意图开关状态（目录/位置/告警）。 */
  export interface SubscriptionVO {
    catalog: boolean;
    position: boolean;
    alarm: boolean;
  }

  /** 订阅类型（与后端 SubscriptionConstant.Type 一致）。 */
  export type SubscriptionType = 'ALARM' | 'CATALOG' | 'MOBILE_POSITION';

  export interface DeviceListResp {
    total: number;
    items: DeviceVO[];
  }

  /* ----------------------- S5 通道层级（DeviceChannelController） ----------------------- */

  /** 通道查询请求（全部可选；deviceId 由钻取路由注入）。 */
  export interface DeviceChannelQueryReq {
    id?: number;
    channelId?: string; // 通道 Id
    deviceId?: string; // 设备 ID（钻取按此过滤）
    name?: string; // 通道名称
    status?: number; // 1在线 / 0离线
  }

  /** 通道出参（时间 Unix 毫秒，字段以 Time 结尾）。 */
  export interface DeviceChannelVO {
    id: number;
    channelId: string;
    deviceId: string;
    name?: string;
    status: number; // 1/0
    statusName: string; // "在线"/"离线"（后端已派生，前端直接用）
    createTime?: number;
    updateTime?: number;
    extend?: string;
    extendInfo?: { channelInfo?: string };
  }

  export interface DeviceChannelListResp {
    total: number;
    items: DeviceChannelVO[];
  }

  /** 通道更新请求（id 必填；channelId/deviceId 为身份字段，仅展示不可改，后端按 id 更新 name/status）。 */
  export interface DeviceChannelUpdateReq {
    id: number;
    channelId?: string;
    deviceId?: string;
    name?: string;
    status?: number; // 1在线 / 0离线
    extendInfo?: { channelInfo?: string };
  }

  /** 设备更新请求（id 必填；deviceId 唯一索引不可改，仅展示）。 */
  export interface DeviceUpdateReq {
    id: number;
    deviceId?: string;
    name?: string;
    ip?: string;
    port?: number;
    type?: number; // 协议类型 DeviceAgreementEnum：1=GB28181 IPC / 2=GB28181 NVR / 3=ONVIF
    serverIp?: string;
    status?: number; // 1在线 / 0离线
  }

  /** PTZ 控制请求（既有 /ptz/control 端点）。 */
  export interface PtzControlReq {
    deviceId: string;
    channelId?: string;
    /** 词表 UP/DOWN/.../ZOOM_IN/ZOOM_OUT/STOP（大小写无关）。 */
    command: string;
    speed?: number;
  }

  /** 实时点播请求（既有 /live/start 端点）。 */
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

  /** 下发配置请求（/device-cmd/config/set）。 */
  export interface SetConfigReq {
    deviceId: string;
    name?: string;
    expiration?: string;
    heartBeatInterval?: string;
    heartBeatCount?: string;
  }

  /** 录像查询请求（/device-cmd/record）。 */
  export interface RecordQueryReq {
    deviceId: string;
    startTime?: number; // Unix 毫秒
    endTime?: number;
  }

  /** 报警查询请求（/device-cmd/alarm/query）。 */
  export interface AlarmQueryReq {
    deviceId: string;
    startTime?: number; // Unix 毫秒
    endTime?: number;
    startPriority?: string;
    endPriority?: string;
    alarmMethod?: string;
    alarmType?: string;
  }

  /** 报警复位请求（/device-cmd/alarm/control）。 */
  export interface AlarmControlReq {
    deviceId: string;
    alarmMethod?: string;
    alarmType?: string;
  }
}

/* -------------------------------------------------------------------------- */
/*                       §1.1 设备分页（DeviceController）                       */
/* -------------------------------------------------------------------------- */

/** S1 分页条件查询：page/size 走 query，条件走 body（空条件发 {}）。 */
export async function getDevicePage(
  params: { page: number; size: number },
  body?: DeviceApi.DevicePageReq,
) {
  return requestClient.post<DeviceApi.DeviceListResp>(
    `/api/v1/device/getPage?page=${params.page}&size=${params.size}`,
    body ?? {},
  );
}

/** 更新设备（id 必填）。 */
export async function updateDevice(data: DeviceApi.DeviceUpdateReq) {
  return requestClient.put<number>('/api/v1/device/update', data);
}

/** 删除单个设备（按主键 id）。 */
export async function deleteDevice(id: number) {
  return requestClient.delete<boolean>(`/api/v1/device/delete/${id}`);
}

/** 批量删除设备（按主键 id 列表）。 */
export async function deleteDeviceBatch(ids: number[]) {
  return requestClient.delete<boolean>('/api/v1/device/deleteIds', {
    data: ids,
  });
}

/* -------------------------------------------------------------------------- */
/*           S5 通道分页（DeviceChannelController，按 deviceId 钻取）           */
/* -------------------------------------------------------------------------- */

/** 通道分页：page/size 走 query，body 为查询条件（按 deviceId 过滤该设备下通道，空条件发 {}）。 */
export async function getDeviceChannelPage(
  params: { page: number; size: number },
  body?: DeviceApi.DeviceChannelQueryReq,
) {
  return requestClient.post<DeviceApi.DeviceChannelListResp>(
    `/api/v1/deviceChannel/getPage?page=${params.page}&size=${params.size}`,
    body ?? {},
  );
}

/** 更新通道（id 必填；后端 PUT /deviceChannel/update 按主键改 name/status）。 */
export async function updateDeviceChannel(
  data: DeviceApi.DeviceChannelUpdateReq,
) {
  return requestClient.put<number>('/api/v1/deviceChannel/update', data);
}

/** 单删通道（DELETE /deviceChannel/deleteOne，body 携带主键 id）。 */
export async function deleteDeviceChannelOne(id: number) {
  return requestClient.delete<boolean>('/api/v1/deviceChannel/deleteOne', {
    data: { id },
  });
}

/**
 * 按条件批量删除通道（DELETE /deviceChannel/deleteBatch，body=查询条件）。
 * 清理离线通道即传 { deviceId, status: 0 }——后端按条件匹配删除，非 id 数组。
 */
export async function deleteDeviceChannelBatch(
  query: DeviceApi.DeviceChannelQueryReq,
) {
  return requestClient.delete<boolean>('/api/v1/deviceChannel/deleteBatch', {
    data: query,
  });
}

/* -------------------------------------------------------------------------- */
/*              §1.3 复用既有端点（协议台同源，勿重建）                          */
/* -------------------------------------------------------------------------- */

/** PTZ 控制（既有端点）。 */
export async function ptzControl(data: DeviceApi.PtzControlReq) {
  return requestClient.post<boolean>('/api/v1/ptz/control', data);
}

/** PTZ 停止。 */
export async function ptzStop(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/ptz/stop', { deviceId });
}

/** 查目录（回包后收 device.catalog）。 */
export async function queryCatalog(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/query-catalog', {
    deviceId,
  });
}

/** 查设备信息（回包后收 device.info）。 */
export async function queryDeviceInfo(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/query-info', {
    deviceId,
  });
}

/** 下发重启。 */
export async function rebootDevice(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/reboot', { deviceId });
}

/** 实时点播（返回 LivePlayVO，含 playUrls）。 */
export async function liveStart(data: DeviceApi.LiveStartReq) {
  return requestClient.post<DeviceApi.LivePlayVO>('/api/v1/live/start', data);
}

/** 停流（G4：统一走 /live/stop，传 streamId，与协议台一致）。 */
export async function liveStop(streamId: string) {
  return requestClient.post<boolean>('/api/v1/live/stop', { streamId });
}

/* -------------------------------------------------------------------------- */
/*              §1.2 S2 新增支链（DeviceCmdController）                          */
/* -------------------------------------------------------------------------- */

/** 查设备状态（回包入 extendInfo.deviceStatus）。 */
export async function queryDeviceStatus(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/query-status', {
    deviceId,
  });
}

/** 查预置位（回包入 extendInfo.presets；G2：仅查询，不支持下发）。 */
export async function queryPreset(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/query-preset', {
    deviceId,
  });
}

/** 查移动位置订阅（interval 选填）。 */
export async function queryMobilePosition(deviceId: string, interval?: string) {
  return requestClient.post<boolean>(
    '/api/v1/device-cmd/query-mobile-position',
    { deviceId, interval },
  );
}

/** 下载配置（configType 后端 @NotBlank，缺失返回 400）。 */
export async function downloadConfig(deviceId: string, configType: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/config/download', {
    deviceId,
    configType,
  });
}

/** 下发配置（记 [AUDIT]）。 */
export async function setDeviceConfig(data: DeviceApi.SetConfigReq) {
  return requestClient.post<boolean>('/api/v1/device-cmd/config/set', data);
}

/** 开始录像（记 [AUDIT]）。 */
export async function controlRecordStart(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/record/start', {
    deviceId,
  });
}

/** 停止录像（记 [AUDIT]）。 */
export async function controlRecordStop(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/record/stop', {
    deviceId,
  });
}

/** 触发录像查询（G1：结果走 device.recordinfo 通知，列表本体暂无读端点）。 */
export async function queryRecord(data: DeviceApi.RecordQueryReq) {
  return requestClient.post<boolean>('/api/v1/device-cmd/record', data);
}

/** 查报警。 */
export async function queryAlarm(data: DeviceApi.AlarmQueryReq) {
  return requestClient.post<boolean>('/api/v1/device-cmd/alarm/query', data);
}

/** 报警复位（记 [AUDIT]）。 */
export async function controlAlarm(data: DeviceApi.AlarmControlReq) {
  return requestClient.post<boolean>('/api/v1/device-cmd/alarm/control', data);
}

/** 语音广播（记 [AUDIT]）。 */
export async function broadcast(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/broadcast', {
    deviceId,
  });
}

/**
 * 开关设备订阅（GB28181-2022 §9.11：目录/位置/告警）。
 * 开关即下发/撤销 SUBSCRIBE。
 */
export async function toggleDeviceSubscription(
  deviceId: string,
  type: DeviceApi.SubscriptionType,
  enabled: boolean,
) {
  return requestClient.put<boolean>('/api/v1/device/subscription/toggle', {
    deviceId,
    type,
    enabled,
  });
}
