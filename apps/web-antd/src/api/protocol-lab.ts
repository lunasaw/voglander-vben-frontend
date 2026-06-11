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
  /**
   * GET /lab/client/config 返回的身份与端口信息。
   *
   * 目标字段（serverId/serverIp/serverPort/serverDomain/transport）均为
   * holder 覆盖后的「当前生效值」：未自定义时 = 本进程自环 sip.server.*，
   * 自定义注册后 = holder 快照值。`targetCustomized` 标记当前是否非自环。
   */
  export interface LabConfig {
    clientId: string;
    clientIp: string;
    clientPort: number;
    serverId: string;
    serverIp: string;
    serverPort: number;
    /** 目标平台 SIP 域（realm 初始构造来源）。 */
    serverDomain: string;
    /** 当前生效的传输协议。 */
    transport: 'TCP' | 'UDP';
    /** true = 当前目标为自定义（非自环）。 */
    targetCustomized: boolean;
    /** 后端已就绪的全部 SSE 主题（event: 名 = 完整 topic）。 */
    topics: string[];
    /** push.auto：收到 INVITE 是否自动起 ffmpeg（只读展示）。 */
    pushAuto?: boolean;
    /** push.ffmpeg-path：ffmpeg 路径输入框初值。 */
    ffmpegPath?: string;
    /** push.media-file：视频文件路径输入框初值（可能为空，联调前填）。 */
    mediaFile?: string;
  }

  /** POST /lab/client/keepalive/auto 返回的当前调度状态。 */
  export interface KeepaliveAutoState {
    enabled: boolean;
    intervalSec: number;
  }

  /**
   * 设备注册请求。
   *
   * 目标 + 身份字段全空 = 注册到本进程自环（行为同现状）；任一非空 =
   * 后端 `LabSessionHolder.apply(snapshot)`，把模拟设备注册到外部平台。
   */
  export interface RegisterReq {
    /** 注册有效期（秒），注销时后端用 expires=0。 */
    expires?: number;
    /** 目标平台编码（serverId）。 */
    serverId?: string;
    /** 目标平台 IP。 */
    serverIp?: string;
    /** 目标平台端口。 */
    serverPort?: number;
    /** 目标平台 SIP 域（realm 初始构造来源，选填）。 */
    serverDomain?: string;
    /** 传输协议（与外部平台一致，选填）。 */
    transport?: 'TCP' | 'UDP';
    /** 设备身份编码覆盖（空=用 sip.client）。 */
    clientId?: string;
    /** 设备身份密码覆盖（空=用后端配置）。 */
    clientPassword?: string;
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

  /**
   * POST /lab/client/push/start 入参（均选填，空=用后端配置默认值）。
   *
   * 路径是**后端运行机器**视角的绝对路径（非浏览器本地路径）；前端仅透传字符串，
   * 文件是否存在 / 是否越界由后端 `LabMediaPushService.validateFile` 校验并报错。
   */
  export interface PushStartReq {
    /** ffmpeg 可执行文件绝对路径，覆盖配置。 */
    ffmpegPath?: string;
    /** 待推视频文件绝对路径，覆盖配置。 */
    mediaFile?: string;
  }

  /**
   * push/start|stop|status 返回的推流状态（后端 `LabMediaPushService.PushStatus`）。
   *
   * 单流模型：一次只维护一路推流。IDLE=无推流，RUNNING=ffmpeg 在推，
   * STOPPED=已停，FAILED=启动/运行失败（看 lastLog）。
   */
  export interface PushStatus {
    state: 'FAILED' | 'IDLE' | 'RUNNING' | 'STOPPED';
    /** 关联的 INVITE callId。 */
    callId?: string;
    /** 平台收流 IP（SDP c=）。 */
    mediaIp?: string;
    /** 平台收流端口（SDP m=），IDLE 时为 0。 */
    mediaPort?: number;
    /** SDP y= ssrc。 */
    ssrc?: string;
    /** 完整 ffmpeg 命令行（空格拼接，仅展示）。 */
    cmd?: string;
    /** 启动时刻（毫秒）。 */
    startMs?: number;
    /** ffmpeg 最近 ≤30 行日志（换行拼接）。 */
    lastLog?: string;
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

/**
 * 模拟推流：用 ffmpeg 把视频推到最近一次 INVITE 的收流目标。
 *
 * 不传参=用后端配置默认 ffmpeg/file；传 ffmpegPath/mediaFile 覆盖。
 * 后端无 INVITE 目标 / 非 UDP / 文件非法时返回错误码，requestClient 统一弹错。
 */
export async function labPushStart(data?: ProtocolLabApi.PushStartReq) {
  return requestClient.post<ProtocolLabApi.PushStatus>(
    `${LAB_CLIENT}/push/start`,
    data ?? {},
  );
}

/** 停止模拟推流（幂等，返回 state=IDLE）。 */
export async function labPushStop() {
  return requestClient.post<ProtocolLabApi.PushStatus>(
    `${LAB_CLIENT}/push/stop`,
    {},
  );
}

/** 查询当前模拟推流状态（空闲为 state=IDLE）。 */
export async function labPushStatus() {
  return requestClient.get<ProtocolLabApi.PushStatus>(
    `${LAB_CLIENT}/push/status`,
  );
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
