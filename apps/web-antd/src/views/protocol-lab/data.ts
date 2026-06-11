import { $t } from '#/locales';

/**
 * 协议验证台展示元数据。
 *
 * - 左侧"收到指令"时间线消费 `clientcmd.*`
 * - 右侧"平台事件"时间线消费 `device.*` / `session.*` / `alarm.*`
 * 这里集中维护 topic → 文案 / 颜色 的映射，组件按 topic 取展示属性。
 */

/** 八向 + 变倍方向盘（command 直发词表，门面层 PTZ_VOCAB 翻译为规范枚举）。 */
export interface PtzButton {
  /** 后端词表（大小写无关）。 */
  command: string;
  /** i18n key 后缀（protocolLab.ptz.<key>）。 */
  key: string;
  /** 方向盘网格位置（3×3，row/col 从 1 起）。 */
  row: number;
  col: number;
}

export const PTZ_DIRECTIONS: PtzButton[] = [
  { command: 'UP_LEFT', key: 'upLeft', row: 1, col: 1 },
  { command: 'UP', key: 'up', row: 1, col: 2 },
  { command: 'UP_RIGHT', key: 'upRight', row: 1, col: 3 },
  { command: 'LEFT', key: 'left', row: 2, col: 1 },
  { command: 'STOP', key: 'stop', row: 2, col: 2 },
  { command: 'RIGHT', key: 'right', row: 2, col: 3 },
  { command: 'DOWN_LEFT', key: 'downLeft', row: 3, col: 1 },
  { command: 'DOWN', key: 'down', row: 3, col: 2 },
  { command: 'DOWN_RIGHT', key: 'downRight', row: 3, col: 3 },
];

export const PTZ_ZOOM: PtzButton[] = [
  { command: 'ZOOM_IN', key: 'zoomIn', row: 1, col: 1 },
  { command: 'ZOOM_OUT', key: 'zoomOut', row: 1, col: 2 },
];

/** topic → 时间线展示属性（标题 i18n key + 颜色标签）。 */
interface TopicMeta {
  /** protocolLab.event.<labelKey> */
  labelKey: string;
  /** ant-design-vue Tag color 或语义色 */
  color: string;
}

export const TOPIC_META: Record<string, TopicMeta> = {
  // 右侧 device.* / session.* / alarm.*
  'device.register': { labelKey: 'register', color: 'green' },
  'device.online': { labelKey: 'online', color: 'green' },
  'device.offline': { labelKey: 'offline', color: 'red' },
  'device.keepalive': { labelKey: 'keepalive', color: 'blue' },
  'device.catalog': { labelKey: 'catalog', color: 'cyan' },
  'device.info': { labelKey: 'deviceInfo', color: 'cyan' },
  'session.invite_ok': { labelKey: 'inviteOk', color: 'purple' },
  'session.bye': { labelKey: 'bye', color: 'orange' },
  'alarm.new': { labelKey: 'alarm', color: 'red' },
  // 左侧 clientcmd.*
  'clientcmd.register.ok': { labelKey: 'registerOk', color: 'green' },
  'clientcmd.register.fail': { labelKey: 'registerFail', color: 'red' },
  'clientcmd.register.challenge': {
    labelKey: 'registerChallenge',
    color: 'gold',
  },
  'clientcmd.ptz': { labelKey: 'ptz', color: 'geekblue' },
  'clientcmd.record': { labelKey: 'record', color: 'blue' },
  'clientcmd.reboot': { labelKey: 'reboot', color: 'volcano' },
  'clientcmd.iframe': { labelKey: 'iframe', color: 'blue' },
  'clientcmd.guard': { labelKey: 'guard', color: 'blue' },
  'clientcmd.alarmreset': { labelKey: 'alarmReset', color: 'orange' },
  'clientcmd.query.catalog': { labelKey: 'queryCatalog', color: 'cyan' },
  'clientcmd.query.deviceinfo': { labelKey: 'queryDeviceInfo', color: 'cyan' },
  'clientcmd.query.devicestatus': {
    labelKey: 'queryDeviceStatus',
    color: 'cyan',
  },
  'clientcmd.config.basicparam': {
    labelKey: 'configBasicParam',
    color: 'purple',
  },
  'clientcmd.broadcast': { labelKey: 'broadcast', color: 'magenta' },
  'clientcmd.invite': { labelKey: 'invite', color: 'purple' },
  'clientcmd.push.started': { labelKey: 'pushStarted', color: 'green' },
  'clientcmd.push.stopped': { labelKey: 'pushStopped', color: 'orange' },
  'clientcmd.push.failed': { labelKey: 'pushFailed', color: 'red' },
};

/** 取 topic 的展示标题（找不到映射时回退原始 topic）。 */
export function topicLabel(topic: string): string {
  const meta = TOPIC_META[topic];
  return meta ? $t(`protocolLab.event.${meta.labelKey}`) : topic;
}

/** 取 topic 的标签颜色。 */
export function topicColor(topic: string): string {
  return TOPIC_META[topic]?.color ?? 'default';
}
