/**
 * GB28181 设备命令描述符（共享）。
 *
 * 与后端 DeviceCmdController 端点一一对应，是前后端命令契约镜像，不得擅增删。
 * 供「协议验证台 ServerPanel」与「设备管理页 device-operations」共用 DeviceCommandPanel，
 * 保证两页协议能力逐项对等（验证台「验协议」、设备页「管设备」，命令集相同）。
 *
 * code   = 命令标识，父页 onCommand switch 据此调对应 API（注入实现）。
 * section = 分组，决定渲染时归属哪个 Divider。
 * danger  = 危险动作（复位 / 重启等），渲染 danger 样式。
 */
export interface DeviceCommand {
  /** 命令标识（父页据此映射 API / 权限码）。 */
  code: string;
  /** 分组：query | config | record | alarm | other。 */
  section: DeviceCommandSection;
  /** 危险动作（复位 / 重启），渲染告警色。 */
  danger?: boolean;
}

export type DeviceCommandSection =
  | 'alarm'
  | 'config'
  | 'other'
  | 'query'
  | 'record';

/** 分组渲染顺序（Divider 自上而下）。 */
export const DEVICE_COMMAND_SECTIONS: DeviceCommandSection[] = [
  'query',
  'config',
  'record',
  'alarm',
  'other',
];

/**
 * 设备命令全集。配置 configDownload 时面板内置 BASIC/VIDEO/AUDIO 下拉，
 * emit command 时随 payload 带出 configType（后端 @NotBlank）。
 */
export const DEVICE_COMMANDS: DeviceCommand[] = [
  // 查询支链（/device-cmd/query-*）
  { code: 'queryCatalog', section: 'query' },
  { code: 'queryInfo', section: 'query' },
  { code: 'queryStatus', section: 'query' },
  { code: 'queryPreset', section: 'query' },
  { code: 'queryMobilePosition', section: 'query' },
  // 配置（/device-cmd/config/download，前置 configType 下拉）
  { code: 'configDownload', section: 'config' },
  // 录像控制（/device-cmd/record*）
  { code: 'recordStart', section: 'record' },
  { code: 'recordStop', section: 'record' },
  { code: 'recordQuery', section: 'record' },
  // 报警（/device-cmd/alarm/*）
  { code: 'alarmQuery', section: 'alarm' },
  { code: 'alarmControl', section: 'alarm', danger: true },
  // 其它（广播 / 重启）
  { code: 'broadcast', section: 'other' },
  { code: 'reboot', section: 'other', danger: true },
];

/** code → i18n action key 后缀映射（默认同名，特例在此覆盖）。 */
export const DEVICE_COMMAND_LABEL_KEY: Record<string, string> = {
  queryCatalog: 'queryCatalog',
  queryInfo: 'queryInfo',
  queryStatus: 'queryStatus',
  queryPreset: 'queryPreset',
  queryMobilePosition: 'queryMobilePosition',
  configDownload: 'configDownload',
  recordStart: 'recordStart',
  recordStop: 'recordStop',
  recordQuery: 'recordQuery',
  alarmQuery: 'alarmQuery',
  alarmControl: 'alarmControl',
  broadcast: 'broadcast',
  reboot: 'reboot',
};

/** 配置下载类型选项（后端 configType @NotBlank：BASIC/VIDEO/AUDIO）。 */
export const CONFIG_TYPE_OPTIONS = [
  { label: 'BASIC', value: 'BASIC' },
  { label: 'VIDEO', value: 'VIDEO' },
  { label: 'AUDIO', value: 'AUDIO' },
];
