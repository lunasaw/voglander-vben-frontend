import { $t } from '#/locales';

/**
 * 协议验证台展示元数据。
 *
 * - 左侧"收到指令"时间线消费 `clientcmd.*`
 * - 右侧"平台事件"时间线消费 `device.*` / `session.*` / `alarm.*`
 * 这里集中维护 topic → 文案 / 颜色 的映射，组件按 topic 取展示属性。
 */

// PTZ 方向盘词表已提取到共享组件层（components/ptz-control.ts），供协议台与设备页共用。
// 这里 re-export 保持协议台既有 import 路径（`../data`）不变。
export {
  PTZ_DIRECTIONS,
  PTZ_ZOOM,
  type PtzButton,
} from '#/components/ptz-control';

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
  'device.status': { labelKey: 'deviceStatus', color: 'cyan' },
  'device.ptz_position': { labelKey: 'ptzPosition', color: 'geekblue' },
  'device.preset': { labelKey: 'preset', color: 'cyan' },
  'device.config': { labelKey: 'config', color: 'purple' },
  'device.config_download': { labelKey: 'configDownload', color: 'purple' },
  'device.recordinfo': { labelKey: 'recordInfo', color: 'cyan' },
  'device.mobileposition': { labelKey: 'mobilePosition', color: 'green' },
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
  'clientcmd.query.recordinfo': { labelKey: 'queryRecordInfo', color: 'cyan' },
  'clientcmd.query.configdownload': {
    labelKey: 'queryConfigDownload',
    color: 'cyan',
  },
  'clientcmd.query.preset': { labelKey: 'queryPreset', color: 'cyan' },
  'clientcmd.query.mobileposition': {
    labelKey: 'queryMobilePosition',
    color: 'cyan',
  },
  'clientcmd.query.alarm': { labelKey: 'queryAlarm', color: 'orange' },
  'clientcmd.config.basicparam': {
    labelKey: 'configBasicParam',
    color: 'purple',
  },
  'clientcmd.broadcast': { labelKey: 'broadcast', color: 'magenta' },
  'clientcmd.invite': { labelKey: 'invite', color: 'purple' },
  'clientcmd.bye': { labelKey: 'byeRecv', color: 'orange' },
  'clientcmd.push.started': { labelKey: 'pushStarted', color: 'green' },
  'clientcmd.push.stopped': { labelKey: 'pushStopped', color: 'orange' },
  'clientcmd.push.failed': { labelKey: 'pushFailed', color: 'red' },
};

/**
 * 设备详情时间线订阅的 topic 全集 = **设备→平台方向**（协议台右侧时间线同一集合）：
 * `device.*`（上报/查询应答）+ `session.*`（点播会话）+ `alarm.*`（报警上报/查询应答）。
 *
 * 派生口径 = 全部非 `clientcmd.*`（`clientcmd.*` 是平台→设备下发，不属于设备视角的"收到事件"）。
 * 从 TOPIC_META 派生为单一来源，新增右侧 topic 只改 TOPIC_META 一处即可。
 *
 * ⚠️ 报警应答走 `alarm.new`（非 `device.alarm`）：若此处只订阅 `device.*`，
 * 则 useSseEvents 的「订阅前缀 + addEventListener」两层都收不到 `alarm`/`session` 帧
 * （设备详情「查询报警/点播会话」无 SSE 信号的根因）。
 */
export const DEVICE_DETAIL_TOPICS: string[] = Object.keys(TOPIC_META).filter(
  (t) => !t.startsWith('clientcmd.'),
);

/** 取 topic 的展示标题（找不到映射时回退原始 topic）。 */
export function topicLabel(topic: string): string {
  const meta = TOPIC_META[topic];
  return meta ? $t(`protocolLab.event.${meta.labelKey}`) : topic;
}

/** 取 topic 的标签颜色。 */
export function topicColor(topic: string): string {
  return TOPIC_META[topic]?.color ?? 'default';
}
