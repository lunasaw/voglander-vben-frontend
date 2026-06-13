<script lang="ts" setup>
import type { DeviceApi } from '#/api/device';
import type { LabEvent } from '#/composables/useSseEvents';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';

import { Button, message } from 'ant-design-vue';

import {
  broadcast,
  controlAlarm,
  controlRecordStart,
  controlRecordStop,
  downloadConfig,
  liveStart,
  ptzControl,
  queryAlarm,
  queryCatalog,
  queryDeviceInfo,
  queryDeviceStatus,
  queryMobilePosition,
  queryPreset,
  queryRecord,
  rebootDevice,
} from '#/api/device';
import DeviceCommandPanel from '#/components/DeviceCommandPanel.vue';
import MediaPlayer from '#/components/MediaPlayer.vue';
import PtzControl from '#/components/PtzControl.vue';
import { $t } from '#/locales';
import SipTimeline from '#/views/protocol-lab/components/SipTimeline.vue';

/**
 * 设备操作面板（§4.3）。
 *
 * 复用红线（去重核心）：
 *  - PTZ / 点播 直接调既有 /ptz、/live 端点（与协议台 ServerPanel 同源），不重建。
 *  - PtzControl / MediaPlayer / SipTimeline 一律 import 复用。
 *  - 支链命令（query-status/preset/mobile-position、config、record、alarm、broadcast）调 S2 新端点。
 *
 * 本组件 prop 驱动（device），由 device-detail.vue 抽屉包裹，便于单测。
 */
const props = withDefaults(
  defineProps<{
    /** 挂载即自动点播（列表「实时点播」入口）。 */
    autoLive?: boolean;
    /** 选中设备；null 时命令禁用。 */
    device?: DeviceApi.DeviceVO | null;
    /** 设备相关 SSE 事件（已按 deviceId 过滤），用于时间线。 */
    events?: LabEvent[];
  }>(),
  { autoLive: false, device: null, events: () => [] },
);

const { hasAccessByCodes } = useAccess();

const loading = ref(false);

/** 点播播放器弹窗。 */
const playerOpen = ref(false);
const playerUrls = ref<DeviceApi.LivePlayVO['playUrls']>(undefined);
const playerTitle = ref('');

const deviceId = computed(() => props.device?.deviceId ?? '');
/** catalog 通道命名规则：deviceId + 两位序号；缺省回退 deviceId+'01'（与协议台一致）。 */
const channelId = computed(() => (deviceId.value ? `${deviceId.value}01` : ''));
const hasDevice = computed(() => !!deviceId.value);

/** 在线态：status===1（与后端 statusName 派生一致），驱动状态带脉冲色。 */
const isOnline = computed(() => props.device?.status === 1);

/** 设备访问地址 ip:port（缺失回退占位）。 */
const address = computed(() => {
  const ip = props.device?.ip;
  const port = props.device?.port;
  if (!ip) {
    return '—';
  }
  return port ? `${ip}:${port}` : ip;
});

/** 协议/类型展示名（typeName 优先，回退 protocolName）。 */
const typeName = computed(
  () => props.device?.typeName ?? props.device?.protocolName ?? '—',
);

/** Unix 毫秒 → 本地时间字符串（后端 Time 字段均毫秒）。 */
function fmtTime(ms?: number) {
  return ms ? new Date(ms).toLocaleString() : '—';
}

/**
 * 统一命令执行：校验设备在线 + 权限码，再调 fn，最后 toast。
 * 任一前置不满足直接 return（权限双重防护 §4.3）。
 */
async function run(
  code: string,
  fn: () => Promise<unknown>,
  okKey = 'device.msg.cmdSent',
) {
  if (!hasDevice.value) {
    return;
  }
  if (!hasAccessByCodes([code])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  loading.value = true;
  try {
    await fn();
    message.success($t(okKey));
  } catch {
    message.error($t('device.msg.cmdFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 设备命令分发（DeviceCommandPanel emit）。
 *
 * 命令集与协议验证台对等（验证台「验协议」、设备页「管设备」）；此处注入的是
 * 设备页实现：权限码门禁（Device:Cmd:*）+ #/api/device 端点。
 */
function onCommand({
  code,
  configType,
}: {
  code: string;
  configType?: string;
}) {
  const id = deviceId.value;
  // 录像 / 报警查询后端强制时间范围（Unix 毫秒），默认最近 24h。
  // G1：录像结果走 device.recordinfo 通知，列表本体暂无读端点 → 仅触发 + 提示。
  const endTime = Date.now();
  const startTime = endTime - 24 * 60 * 60 * 1000;
  const map: Record<
    string,
    { fn: () => Promise<unknown>; ok?: string; perm: string }
  > = {
    queryCatalog: { perm: 'Device:Cmd:Query', fn: () => queryCatalog(id) },
    queryInfo: { perm: 'Device:Cmd:Query', fn: () => queryDeviceInfo(id) },
    queryStatus: { perm: 'Device:Cmd:Query', fn: () => queryDeviceStatus(id) },
    queryPreset: { perm: 'Device:Cmd:Query', fn: () => queryPreset(id) },
    queryMobilePosition: {
      perm: 'Device:Cmd:Query',
      fn: () => queryMobilePosition(id),
    },
    configDownload: {
      perm: 'Device:Cmd:Config',
      fn: () => downloadConfig(id, configType ?? 'BASIC'),
    },
    recordStart: {
      perm: 'Device:Cmd:Record',
      fn: () => controlRecordStart(id),
    },
    recordStop: { perm: 'Device:Cmd:Record', fn: () => controlRecordStop(id) },
    recordQuery: {
      perm: 'Device:Cmd:Record',
      ok: 'device.msg.recordQuerySent',
      fn: () => queryRecord({ deviceId: id, startTime, endTime }),
    },
    alarmQuery: {
      perm: 'Device:Cmd:Alarm',
      fn: () => queryAlarm({ deviceId: id, startTime, endTime }),
    },
    // 报警复位默认 alarmMethod=1（电话报警）alarmType=0（全部），后端强制非空。
    alarmControl: {
      perm: 'Device:Cmd:Alarm',
      fn: () =>
        controlAlarm({ deviceId: id, alarmMethod: '1', alarmType: '0' }),
    },
    broadcast: { perm: 'Device:Cmd:Broadcast', fn: () => broadcast(id) },
    reboot: { perm: 'Device:Cmd:Config', fn: () => rebootDevice(id) },
  };
  const entry = map[code];
  if (!entry) {
    return;
  }
  run(entry.perm, entry.fn, entry.ok);
}

/* ----------------------------- PTZ（复用 /ptz） ----------------------------- */
function onPtz(payload: {
  channelId?: string;
  command: string;
  deviceId: string;
  speed: number;
}) {
  run('Device:Cmd:Ptz', () => ptzControl(payload), 'device.msg.ptzSent');
}

/* ----------------------------- 点播（复用 /live） ----------------------------- */
function onLiveStart() {
  if (!hasDevice.value) {
    return;
  }
  if (!hasAccessByCodes(['Device:Cmd:Live'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  loading.value = true;
  liveStart({ deviceId: deviceId.value, channelId: channelId.value })
    .then((vo) => {
      message.success($t('device.msg.liveSent'));
      // GB 直播首选 HTTP-FLV（首帧快）；有可播地址才开弹窗，失败不打扰。
      if (vo?.playUrls && Object.keys(vo.playUrls).length > 0) {
        playerUrls.value = vo.playUrls;
        playerTitle.value = `${deviceId.value} · ${channelId.value}`;
        playerOpen.value = true;
      }
    })
    .finally(() => {
      loading.value = false;
    });
}

function onPlayerClose() {
  playerOpen.value = false;
}

onMounted(() => {
  if (props.autoLive && hasDevice.value) {
    onLiveStart();
  }
});
</script>

<template>
  <div
    class="sentinel"
    :class="{ 'is-online': isOnline, 'no-device': !hasDevice }"
  >
    <!-- 状态带：脉冲雷达点 + 设备身份 + 网格纹理（记忆点） -->
    <header class="sentinel-band">
      <div class="band-grid" aria-hidden="true"></div>
      <div class="band-main">
        <span class="radar" :class="{ live: isOnline }" aria-hidden="true">
          <span class="radar-core"></span>
          <span class="radar-wave"></span>
        </span>
        <div class="band-id">
          <div class="band-name">{{ device?.name || $t('device.title') }}</div>
          <div class="band-code">{{ device?.deviceId ?? '—' }}</div>
        </div>
      </div>
      <div class="band-status">
        <span class="status-dot"></span>
        {{
          isOnline ? $t('device.status.online') : $t('device.status.offline')
        }}
      </div>
    </header>

    <!-- 概览瓦片 -->
    <section class="deck">
      <div class="deck-label">
        <span class="deck-no">00</span>{{ $t('device.section.overview') }}
      </div>
      <div class="tiles">
        <div class="tile">
          <div class="tile-val">{{ device?.channelCount ?? 0 }}</div>
          <div class="tile-key">{{ $t('device.field.channelCount') }}</div>
        </div>
        <div class="tile">
          <div class="tile-val mono">{{ typeName }}</div>
          <div class="tile-key">{{ $t('device.field.type') }}</div>
        </div>
        <div class="tile tile-wide">
          <div class="tile-val mono">{{ address }}</div>
          <div class="tile-key">{{ $t('device.field.ip') }}</div>
        </div>
        <div class="tile tile-wide">
          <div class="tile-val mono sm">
            {{ fmtTime(device?.keepaliveTime) }}
          </div>
          <div class="tile-key">{{ $t('device.field.keepaliveTime') }}</div>
        </div>
        <div class="tile tile-wide">
          <div class="tile-val mono sm">
            {{ fmtTime(device?.registerTime) }}
          </div>
          <div class="tile-key">{{ $t('device.field.registerTime') }}</div>
        </div>
      </div>
    </section>

    <!-- 01 云台 -->
    <section class="deck">
      <div class="deck-label">
        <span class="deck-no">01</span>{{ $t('device.section.ptz') }}
      </div>
      <PtzControl
        :device-id="deviceId"
        :channel-id="channelId"
        :disabled="!hasDevice || loading"
        @command="onPtz"
      />
    </section>

    <!-- 02 全协议命令面板（与协议验证台同源组件，能力对等） -->
    <section class="deck">
      <div class="deck-label">
        <span class="deck-no">02</span>{{ $t('device.section.commands') }}
      </div>
      <DeviceCommandPanel
        :disabled="!hasDevice || loading"
        @command="onCommand"
      />
    </section>

    <!-- 03 点播（留在父页：返回 playUrls 后由本页管理 MediaPlayer 弹窗） -->
    <section class="deck">
      <div class="deck-label">
        <span class="deck-no">03</span>{{ $t('device.section.media') }}
      </div>
      <Button
        type="primary"
        :disabled="!hasDevice || loading"
        @click="onLiveStart"
      >
        {{ $t('device.action.live') }}
      </Button>
    </section>

    <!-- 04 实时事件时间线（复用 SipTimeline，过滤当前设备 device.*） -->
    <section class="deck deck-events">
      <div class="deck-label">
        <span class="deck-no">04</span>{{ $t('device.section.events') }}
      </div>
      <div class="timeline-wrap">
        <SipTimeline
          :events="events"
          :empty-text="$t('device.msg.eventsEmpty')"
        />
      </div>
    </section>

    <!-- 点播播放器弹窗：liveStart 返回 playUrls 后自动起播。 -->
    <MediaPlayer
      :open="playerOpen"
      :play-urls="playerUrls"
      :title="playerTitle"
      format="httpFlv"
      @close="onPlayerClose"
    />
  </div>
</template>

<style scoped>
/* ============================ Sentinel Console ============================
   监控指挥台美学：等宽技术读数 + 脉冲雷达状态带 + 序号化分区 + 发丝边框瓦片。
   全部基于主题令牌（hsl(var(--*))），自适应明暗；不引入新 ant 组件、不改业务逻辑。
   ========================================================================= */
.sentinel {
  --mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
  --hair: hsl(var(--border));
  --glow: var(--success);

  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 2px;
}

.sentinel.no-device {
  opacity: 0.78;
}

/* ---- 入场：分区自上而下错峰淡入上移 ---- */
.deck,
.sentinel-band {
  opacity: 0;
  transform: translateY(10px);
  animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.deck:nth-of-type(1) {
  animation-delay: 0.08s;
}

.deck:nth-of-type(2) {
  animation-delay: 0.14s;
}

.deck:nth-of-type(3) {
  animation-delay: 0.2s;
}

.deck:nth-of-type(4) {
  animation-delay: 0.26s;
}

.deck:nth-of-type(5) {
  animation-delay: 0.32s;
}

@keyframes rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================ 状态带（记忆点） ============================ */
.sentinel-band {
  position: relative;
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  overflow: hidden;
  background:
    radial-gradient(
      120% 140% at 0% 0%,
      hsl(var(--success) / 12%),
      transparent 55%
    ),
    linear-gradient(
      135deg,
      hsl(var(--card)) 0%,
      hsl(var(--background-deep, var(--background))) 100%
    );
  border: 1px solid var(--hair);
  border-radius: calc(var(--radius) + 4px);
  box-shadow:
    inset 0 1px 0 hsl(var(--foreground) / 6%),
    0 18px 40px -28px hsl(var(--foreground) / 45%);
  animation-delay: 0.02s;
}

/* 离线时去掉绿调，回落中性 */
.sentinel:not(.is-online) .sentinel-band {
  background:
    radial-gradient(
      120% 140% at 0% 0%,
      hsl(var(--muted-foreground) / 10%),
      transparent 55%
    ),
    linear-gradient(
      135deg,
      hsl(var(--card)) 0%,
      hsl(var(--background-deep, var(--background))) 100%
    );
}

.band-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(hsl(var(--foreground) / 4%) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--foreground) / 4%) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(90deg, transparent, #000 40%, #000);
}

.band-main {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
}

/* 脉冲雷达点 */
.radar {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}

.radar-core {
  position: absolute;
  inset: 3px;
  background: hsl(var(--muted-foreground));
  border-radius: 50%;
}

.radar.live .radar-core {
  background: hsl(var(--glow));
  box-shadow: 0 0 10px hsl(var(--glow) / 80%);
}

.radar-wave {
  position: absolute;
  inset: 0;
  border: 1px solid hsl(var(--glow));
  border-radius: 50%;
  opacity: 0;
}

.radar.live .radar-wave {
  animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {
  0% {
    opacity: 0.7;
    transform: scale(0.6);
  }

  70%,
  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}

.band-id {
  min-width: 0;
}

.band-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.2;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.band-code {
  margin-top: 2px;
  font-family: var(--mono);
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.06em;
}

.band-status {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex-shrink: 0;
  gap: 7px;
  align-items: center;
  padding: 5px 12px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  border: 1px solid var(--hair);
  border-radius: 999px;
}

.is-online .band-status {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
  border-color: hsl(var(--success) / 35%);
}

.sentinel:not(.is-online) .band-status {
  color: hsl(var(--muted-foreground));
}

.status-dot {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
}

/* ============================ 分区（deck） ============================ */
.deck {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deck-label {
  display: flex;
  gap: 10px;
  align-items: center;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.deck-label::after {
  flex: 1;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, var(--hair), transparent);
}

.deck-no {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  height: 18px;
  padding: 0 6px;
  font-size: 10px;
  color: hsl(var(--accent-foreground, var(--foreground)));
  background: hsl(var(--accent, var(--muted)));
  border-radius: 4px;
}

/* ============================ 概览瓦片 ============================ */
.tiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.tile {
  position: relative;
  padding: 14px 16px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--hair);
  border-radius: var(--radius);
  transition:
    border-color 0.2s,
    transform 0.2s;
}

.tile::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  content: '';
  background: hsl(var(--accent, var(--muted-foreground)) / 60%);
  opacity: 0;
  transition: opacity 0.2s;
}

.tile:hover {
  border-color: hsl(var(--foreground) / 22%);
  transform: translateY(-1px);
}

.tile:hover::before {
  opacity: 1;
}

.tile-wide {
  grid-column: span 2;
}

.tile-val {
  font-size: 22px;
  font-weight: 680;
  line-height: 1.1;
  color: hsl(var(--foreground));
}

.tile-val.mono {
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 600;
  word-break: break-all;
}

.tile-val.sm {
  font-size: 13px;
}

.tile-key {
  margin-top: 6px;
  font-family: var(--mono);
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

/* ============================ 事件流 ============================ */
.deck-events {
  flex: 1;
  min-height: 0;
}

.timeline-wrap {
  min-height: 200px;
  max-height: 340px;
  overflow: hidden;
  background:
    radial-gradient(
      100% 60% at 50% 0%,
      hsl(var(--foreground) / 3%),
      transparent
    ),
    hsl(var(--card));
  border: 1px solid var(--hair);
  border-radius: var(--radius);
  box-shadow: inset 0 1px 0 hsl(var(--foreground) / 5%);
}

/* ============================ 复用组件的指挥台化（仅本视图作用域） ============================
   PtzControl / DeviceCommandPanel 内部用 ant Button + Divider，:deep 重塑为终端按键观感，
   不影响协议验证台等其它引用处（scoped + 仅 .sentinel 下生效）。 */
.sentinel :deep(.ant-btn:not(.ant-btn-primary)) {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  background: hsl(var(--card));
  border-color: var(--hair);
  transition:
    border-color 0.18s,
    box-shadow 0.18s,
    transform 0.12s;
}

.sentinel :deep(.ant-btn:not(.ant-btn-primary):not([disabled]):hover) {
  color: hsl(var(--foreground));
  border-color: hsl(var(--foreground) / 35%);
  box-shadow: 0 0 0 3px hsl(var(--foreground) / 6%);
  transform: translateY(-1px);
}

.sentinel :deep(.ant-btn-dangerous:not([disabled]):hover) {
  border-color: hsl(var(--destructive) / 55%);
  box-shadow: 0 0 0 3px hsl(var(--destructive) / 12%);
}

.sentinel :deep(.ant-btn-primary) {
  font-weight: 600;
  letter-spacing: 0.04em;
  box-shadow: 0 8px 22px -12px hsl(var(--primary) / 80%);
}

/* DeviceCommandPanel 内部分组 Divider → 收窄为次级标签 */
.sentinel :deep(.device-command-panel .ant-divider) {
  margin: 14px 0 10px;
  font-family: var(--mono);
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.16em;
  border-color: var(--hair);
}

.sentinel :deep(.device-command-panel .ant-divider:first-child) {
  margin-top: 0;
}

@media (prefers-reduced-motion: reduce) {
  .deck,
  .sentinel-band {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .radar.live .radar-wave {
    animation: none;
  }
}
</style>
