<script lang="ts" setup>
import type { DeviceApi } from '#/api/device';
import type { LabEvent } from '#/composables/useSseEvents';

import { computed, onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Button, message, Select } from 'ant-design-vue';

import {
  broadcast,
  controlAlarm,
  controlRecordStart,
  controlRecordStop,
  downloadConfig,
  getDeviceChannelPage,
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
const defaultChannelId = computed(() =>
  deviceId.value ? `${deviceId.value}01` : '',
);
const hasDevice = computed(() => !!deviceId.value);

/* ----------------------------- 通道选择（点播 / PTZ 共享） -----------------------------
   点播与 PTZ 必须指定通道。拉取该设备通道列表填充下拉；未加载到时回退 deviceId+'01'
   （与协议台一致），保证空目录设备仍可操作。 */
const channelOptions = ref<Array<{ label: string; value: string }>>([]);
const selectedChannelId = ref('');

/** 生效通道：用户选中优先，否则回退默认 deviceId+'01'。 */
const channelId = computed(
  () => selectedChannelId.value || defaultChannelId.value,
);

async function loadChannels() {
  const id = deviceId.value;
  if (!id) {
    channelOptions.value = [];
    selectedChannelId.value = '';
    return;
  }
  // 先用默认通道兜底，异步拉取成功后替换为真实列表。
  selectedChannelId.value = defaultChannelId.value;
  try {
    const resp = await getDeviceChannelPage(
      { page: 1, size: 200 },
      { deviceId: id },
    );
    const items = resp?.items ?? [];
    channelOptions.value = items.map((c) => ({
      label: c.name ? `${c.channelId} · ${c.name}` : c.channelId,
      value: c.channelId,
    }));
    // 列表非空且当前选中不在其中时，选第一个真实通道。
    if (
      channelOptions.value.length > 0 &&
      !channelOptions.value.some((o) => o.value === selectedChannelId.value)
    ) {
      selectedChannelId.value = channelOptions.value[0]?.value ?? '';
    }
  } catch {
    // 拉取失败保持默认通道兜底，不打扰。
    channelOptions.value = [];
  }
}

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

/* ------------------------- 订阅（复用既有 GB query 端点） -------------------------
   GB28181「订阅」在该后端实现为 query 指令 + 设备应答经 SSE 回投，无独立 SUBSCRIBE 端点。
   故镜像既有 device-cmd/query-* 端点（catalog/position/alarm 均设备级，不接 channelId）。 */
function onSubscribe(kind: 'alarm' | 'catalog' | 'position') {
  const id = deviceId.value;
  const end = Date.now();
  const start = end - 24 * 60 * 60 * 1000;
  const map = {
    catalog: { perm: 'Device:Cmd:Query', fn: () => queryCatalog(id) },
    position: { perm: 'Device:Cmd:Query', fn: () => queryMobilePosition(id) },
    alarm: {
      perm: 'Device:Cmd:Alarm',
      fn: () => queryAlarm({ deviceId: id, startTime: start, endTime: end }),
    },
  } as const;
  const e = map[kind];
  run(e.perm, e.fn, 'device.msg.subscribeSent');
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
  loadChannels();
  if (props.autoLive && hasDevice.value) {
    onLiveStart();
  }
});

// 设备切换（抽屉复用同实例时）重新加载通道下拉。
watch(
  () => props.device?.deviceId,
  () => {
    loadChannels();
  },
);
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

    <!-- 概览读数条：单行紧凑（状态/通道/类型/地址/心跳/注册），不挤占操作区 -->
    <section class="meta-rail">
      <div class="meta-cell">
        <span class="meta-key">{{ $t('device.field.channelCount') }}</span>
        <span class="meta-val">{{ device?.channelCount ?? 0 }}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-key">{{ $t('device.field.type') }}</span>
        <span class="meta-val mono">{{ typeName }}</span>
      </div>
      <div class="meta-cell meta-grow">
        <span class="meta-key">{{ $t('device.field.ip') }}</span>
        <span class="meta-val mono">{{ address }}</span>
      </div>
      <div class="meta-cell meta-grow">
        <span class="meta-key">{{ $t('device.field.keepaliveTime') }}</span>
        <span class="meta-val mono sm">{{
          fmtTime(device?.keepaliveTime)
        }}</span>
      </div>
      <div class="meta-cell meta-grow">
        <span class="meta-key">{{ $t('device.field.registerTime') }}</span>
        <span class="meta-val mono sm">{{
          fmtTime(device?.registerTime)
        }}</span>
      </div>
    </section>

    <!-- SUB 订阅（复用既有 GB query 端点：目录 / 位置 / 告警；回包走 SSE） -->
    <section class="deck">
      <div class="deck-label">
        <span class="deck-no">SUB</span>{{ $t('device.section.subscribe') }}
      </div>
      <div class="sub-actions">
        <Button
          :disabled="!hasDevice || loading"
          @click="onSubscribe('catalog')"
        >
          {{ $t('device.action.subscribeCatalog') }}
        </Button>
        <Button
          :disabled="!hasDevice || loading"
          @click="onSubscribe('position')"
        >
          {{ $t('device.action.subscribePosition') }}
        </Button>
        <Button :disabled="!hasDevice || loading" @click="onSubscribe('alarm')">
          {{ $t('device.action.subscribeAlarm') }}
        </Button>
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

    <!-- 03 点播（指定通道）：通道下拉 + 起播按钮，返回 playUrls 后开 MediaPlayer 弹窗 -->
    <section class="deck">
      <div class="deck-label">
        <span class="deck-no">03</span>{{ $t('device.section.media') }}
      </div>
      <div class="media-row">
        <Select
          v-model:value="selectedChannelId"
          class="channel-select"
          :options="channelOptions"
          :disabled="!hasDevice || loading"
          :placeholder="$t('device.channel.select')"
          show-search
          option-filter-prop="label"
        />
        <Button
          type="primary"
          :disabled="!hasDevice || loading || !channelId"
          @click="onLiveStart"
        >
          {{ $t('device.action.live') }}
        </Button>
      </div>
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
.meta-rail,
.sentinel-band {
  opacity: 0;
  transform: translateY(10px);
  animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

/* 错峰：meta-rail(概览) → SUB → PTZ → 命令 → 点播 → 事件，按 section 序递增。
   header 非 section，故 section 序列从 meta-rail 起算（nth-of-type 1..6）。 */
.sentinel section:nth-of-type(1) {
  animation-delay: 0.08s;
}

.sentinel section:nth-of-type(2) {
  animation-delay: 0.13s;
}

.sentinel section:nth-of-type(3) {
  animation-delay: 0.18s;
}

.sentinel section:nth-of-type(4) {
  animation-delay: 0.23s;
}

.sentinel section:nth-of-type(5) {
  animation-delay: 0.28s;
}

.sentinel section:nth-of-type(6) {
  animation-delay: 0.33s;
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

/* ============================ 订阅快捷分区 ============================ */
.sub-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.sub-actions :deep(.ant-btn) {
  flex: 1;
  min-width: 120px;
}

/* ============================ 概览读数条（单行紧凑） ============================
   取代原概览瓦片网格——发丝边框横条，cell 间竖向分隔，等宽读数；
   释放纵向空间给下方操作区。窄屏自动换行。 */
.meta-rail {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 0;
  padding: 10px 4px;
  background: hsl(var(--card));
  border: 1px solid var(--hair);
  border-radius: var(--radius);
  box-shadow: inset 0 1px 0 hsl(var(--foreground) / 5%);
}

.meta-cell {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 2px 16px;
  border-left: 1px solid var(--hair);
}

.meta-cell:first-child {
  border-left: 0;
}

/* IP / 时间等长字段占据剩余空间，均分弹性 */
.meta-grow {
  flex: 1 1 150px;
}

.meta-key {
  font-family: var(--mono);
  font-size: 9.5px;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.meta-val {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.2;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.meta-val.mono {
  font-family: var(--mono);
  font-size: 12.5px;
  font-weight: 600;
}

.meta-val.sm {
  font-size: 11.5px;
}

/* ============================ 点播行（通道下拉 + 起播） ============================ */
.media-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.channel-select {
  flex: 1;
  min-width: 0;
  max-width: 360px;
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
