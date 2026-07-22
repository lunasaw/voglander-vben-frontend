<script lang="ts" setup>
import type { ProtocolLabApi } from '#/api/protocol-lab';
import type { LabEvent } from '#/composables/useSseEvents';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  Badge,
  Button,
  Card,
  Empty,
  List,
  ListItem,
  message,
  Select,
  Space,
  Switch,
  Tooltip,
} from 'ant-design-vue';

import { getDeviceChannelPage } from '#/api/device';
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
  toggleDeviceSubscription,
} from '#/api/protocol-lab';
import DeviceCommandPanel from '#/components/DeviceCommandPanel.vue';
import MediaPlayer from '#/components/MediaPlayer.vue';
import PtzControl from '#/components/PtzControl.vue';
import { $t } from '#/locales';

import SipTimeline from './SipTimeline.vue';

/**
 * 右侧：平台（Server）控制台。
 * - 设备列表（device.register/online/offline 实时增删改 + 状态徽标）
 * - 选中设备后的命令区（PTZ 方向盘 / 点播 / 查目录 / 查设备信息 / 重启）
 * - 平台事件时间线（device / session / alarm 事件）
 *
 * C2 时序约束：所有按 deviceId 下发的命令以"该设备已注册落库"为前提，
 * 故未选中设备时命令区禁用。
 */
const props = defineProps<{
  /** device / session / alarm 事件（已过滤）。 */
  events: LabEvent[];
}>();

interface DeviceRow {
  deviceId: string;
  online: boolean;
  channelCount?: number;
  manufacturer?: string;
  model?: string;
  lastTs: number;
  // GB28181-2022 §9.11 订阅意图开关。验证台设备列表来自 SSE 内存，无后端订阅态回填，
  // 故为乐观意图（默认关，点击即下发/撤销 SUBSCRIBE，成功才提交）。
  subCatalog: boolean;
  subPosition: boolean;
  subAlarm: boolean;
}

const { hasAccessByCodes } = useAccess();

const devices = ref<Map<string, DeviceRow>>(new Map());
const selectedId = ref<string>('');
const speed = ref(128);
const loading = ref(false);
const channelLoading = ref(false);
const channelOptions = ref<Array<{ label: string; value: string }>>([]);
const selectedChannelId = ref('');
let channelLoadSequence = 0;
/** 订阅开关 in-flight 标记，键 `${deviceId}:${kind}`，防重复点击 + loading 态。 */
const subBusy = ref<Set<string>>(new Set());

/** 点播播放器弹窗：onLiveStart 拿到 playUrls 后打开。 */
const playerOpen = ref(false);
const playerUrls = ref<ProtocolLabApi.LivePlayVO['playUrls']>(undefined);
const playerTitle = ref('');

const deviceList = computed(() =>
  [...devices.value.values()].toSorted((a, b) => b.lastTs - a.lastTs),
);

const selectedCatalogRevision = computed(() => {
  const deviceId = selectedId.value;
  if (!deviceId) {
    return '';
  }
  for (let index = props.events.length - 1; index >= 0; index -= 1) {
    const event = props.events[index];
    if (
      event?.topic === 'device.catalog' &&
      event.data?.deviceId === deviceId
    ) {
      return `${event.seq}:${event.ts}:${event.data?.channelCount ?? ''}`;
    }
  }
  return '';
});

const canCommand = computed(() => {
  const dev = selectedId.value ? devices.value.get(selectedId.value) : null;
  return !!dev && dev.online;
});

const canMediaCommand = computed(
  () => canCommand.value && !channelLoading.value && !!selectedChannelId.value,
);

const channelEmpty = computed(
  () =>
    canCommand.value &&
    !channelLoading.value &&
    channelOptions.value.length === 0,
);

async function loadChannels(deviceId: string, resetSelection: boolean) {
  const requestSequence = ++channelLoadSequence;
  if (resetSelection) {
    channelOptions.value = [];
    selectedChannelId.value = '';
  }
  if (!deviceId) {
    channelLoading.value = false;
    return;
  }

  channelLoading.value = true;
  try {
    const response = await getDeviceChannelPage(
      { page: 1, size: 200 },
      { deviceId },
    );
    if (
      requestSequence !== channelLoadSequence ||
      selectedId.value !== deviceId
    ) {
      return;
    }

    const options = (response?.items ?? []).map((channel) => ({
      label: channel.name
        ? `${channel.channelId} · ${channel.name}`
        : channel.channelId,
      value: channel.channelId,
    }));
    channelOptions.value = options;
    if (!options.some((option) => option.value === selectedChannelId.value)) {
      selectedChannelId.value = options[0]?.value ?? '';
    }
    if (options.length === 0) {
      message.warning($t('protocolLab.msg.noAvailableChannel'));
    }
  } catch {
    if (
      requestSequence !== channelLoadSequence ||
      selectedId.value !== deviceId
    ) {
      return;
    }
    channelOptions.value = [];
    selectedChannelId.value = '';
    message.error($t('protocolLab.msg.channelLoadFailed'));
  } finally {
    if (
      requestSequence === channelLoadSequence &&
      selectedId.value === deviceId
    ) {
      channelLoading.value = false;
    }
  }
}

/** 监听事件流，对设备列表做 upsert（R8：用 upsert 语义容忍乱序）。 */
watch(
  () => props.events,
  (list) => {
    const map = new Map(devices.value);
    for (const ev of list) {
      const id = ev.data?.deviceId;
      if (!id) {
        continue;
      }
      const row: DeviceRow = map.get(id) ?? {
        deviceId: id,
        online: false,
        lastTs: 0,
        subCatalog: false,
        subPosition: false,
        subAlarm: false,
      };
      row.lastTs = Math.max(row.lastTs, ev.ts);
      switch (ev.topic) {
        case 'device.catalog': {
          row.online = true;
          row.channelCount = ev.data?.channelCount;
          break;
        }
        case 'device.info': {
          row.online = true;
          row.manufacturer = ev.data?.manufacturer;
          row.model = ev.data?.model;
          break;
        }
        case 'device.keepalive':
        case 'device.online':
        case 'device.register': {
          row.online = true;
          break;
        }
        case 'device.offline': {
          row.online = false;
          break;
        }
        // session / alarm 事件不改在线态
      }
      map.set(id, row);
    }
    devices.value = map;
    // 自动选中首个设备
    if (!selectedId.value && map.size > 0) {
      selectedId.value = [...map.keys()][0] ?? '';
    }
  },
  { deep: true },
);

watch(
  [selectedId, selectedCatalogRevision],
  (
    [deviceId, catalogRevision],
    [previousDeviceId, previousCatalogRevision],
  ) => {
    const deviceChanged = deviceId !== previousDeviceId;
    if (deviceChanged || catalogRevision !== previousCatalogRevision) {
      void loadChannels(deviceId, deviceChanged);
    }
  },
  { flush: 'post' },
);

function selectDevice(id: string) {
  selectedId.value = id;
}

const SUB_TYPE: Record<
  'alarm' | 'catalog' | 'position',
  ProtocolLabApi.SubscriptionType
> = {
  alarm: 'ALARM',
  catalog: 'CATALOG',
  position: 'MOBILE_POSITION',
};

const SUB_FIELD: Record<
  'alarm' | 'catalog' | 'position',
  'subAlarm' | 'subCatalog' | 'subPosition'
> = {
  alarm: 'subAlarm',
  catalog: 'subCatalog',
  position: 'subPosition',
};

/** 订阅开关 busy key。 */
function subKey(deviceId: string, kind: string) {
  return `${deviceId}:${kind}`;
}

/**
 * 行内订阅开关（GB28181-2022 §9.11）：点击即下发/撤销 SUBSCRIBE，成功才提交开关态。
 * 验证台设备来自 SSE 内存列表、无后端订阅态回填，故为乐观意图开关。
 * 权限门禁 Device:Subscription:Edit（与设备管理页一致）。
 */
async function onSubscriptionToggle(
  row: DeviceRow,
  kind: 'alarm' | 'catalog' | 'position',
  enabled: boolean,
) {
  if (!hasAccessByCodes(['Device:Subscription:Edit'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  const key = subKey(row.deviceId, kind);
  const busy = new Set(subBusy.value);
  busy.add(key);
  subBusy.value = busy;
  try {
    await toggleDeviceSubscription(row.deviceId, SUB_TYPE[kind], enabled);
    // 成功才提交：写回 Map 触发列表刷新。
    const map = new Map(devices.value);
    const cur = map.get(row.deviceId);
    if (cur) {
      cur[SUB_FIELD[kind]] = enabled;
      map.set(row.deviceId, cur);
      devices.value = map;
    }
    message.success(
      $t(
        enabled
          ? 'protocolLab.msg.subscribeOn'
          : 'protocolLab.msg.subscribeOff',
        [$t(`protocolLab.server.sub.${kind}`)],
      ),
    );
  } catch {
    // 失败不提交：开关受控于 row.subXxx，未写回即自动回弹。
  } finally {
    const next = new Set(subBusy.value);
    next.delete(key);
    subBusy.value = next;
  }
}

async function run(fn: () => Promise<unknown>, okKey: string) {
  if (!canCommand.value) {
    message.warning($t('protocolLab.msg.selectOnlineDevice'));
    return;
  }
  loading.value = true;
  try {
    await fn();
    message.success($t(okKey));
  } finally {
    loading.value = false;
  }
}

function onPtz(payload: {
  channelId?: string;
  command: string;
  deviceId: string;
  speed: number;
}) {
  if (!canCommand.value) {
    message.warning($t('protocolLab.msg.selectOnlineDevice'));
    return;
  }
  const channelId = selectedChannelId.value;
  if (!channelId) {
    message.warning($t('protocolLab.msg.noAvailableChannel'));
    return;
  }
  run(
    () =>
      ptzControl({
        ...payload,
        channelId,
      }),
    'protocolLab.msg.ptzSent',
  );
}

/**
 * 设备命令分发（DeviceCommandPanel emit）。
 *
 * 命令集与设备管理页对等（验证台「验协议」、设备页「管设备」）；此处注入的是
 * 验证台实现：在线态门禁（run() 内）+ #/api/protocol-lab 同源端点。
 */
function onCommand({
  code,
  configType,
}: {
  code: string;
  configType?: string;
}) {
  const id = selectedId.value;
  // 录像 / 报警查询后端强制时间范围（Unix 毫秒），默认最近 24h（与设备页一致）。
  const endTime = Date.now();
  const startTime = endTime - 24 * 60 * 60 * 1000;
  const map: Record<string, () => Promise<unknown>> = {
    queryCatalog: () => queryCatalog(id),
    queryInfo: () => queryDeviceInfo(id),
    queryStatus: () => queryDeviceStatus(id),
    queryPreset: () => queryPreset(id),
    queryMobilePosition: () => queryMobilePosition(id),
    configDownload: () => downloadConfig(id, configType ?? 'BASIC'),
    recordStart: () => controlRecordStart(id),
    recordStop: () => controlRecordStop(id),
    recordQuery: () => queryRecord({ deviceId: id, startTime, endTime }),
    alarmQuery: () => queryAlarm({ deviceId: id, startTime, endTime }),
    // 报警复位默认 alarmMethod=1（电话报警）alarmType=0（全部），后端强制非空。
    alarmControl: () =>
      controlAlarm({ deviceId: id, alarmMethod: '1', alarmType: '0' }),
    broadcast: () => broadcast(id),
    reboot: () => rebootDevice(id),
  };
  const fn = map[code];
  if (!fn) {
    return;
  }
  run(fn, 'device.msg.cmdSent');
}
function onLiveStart() {
  if (!canCommand.value) {
    message.warning($t('protocolLab.msg.selectOnlineDevice'));
    return;
  }
  const channelId = selectedChannelId.value;
  if (!channelId) {
    message.warning($t('protocolLab.msg.noAvailableChannel'));
    return;
  }
  loading.value = true;
  liveStart({
    deviceId: selectedId.value,
    channelId,
  })
    .then((vo) => {
      message.success($t('protocolLab.msg.liveSent'));
      // 点播成功且有可播地址 → 打开播放器弹窗自动起播；失败/无地址不打扰
      if (vo?.playUrls && Object.keys(vo.playUrls).length > 0) {
        playerUrls.value = vo.playUrls;
        playerTitle.value = `${selectedId.value} · ${channelId}`;
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
</script>

<template>
  <Card :title="$t('protocolLab.server.title')" class="panel-card" size="small">
    <!-- 设备列表 -->
    <div class="section-title">{{ $t('protocolLab.server.devices') }}</div>
    <div class="device-list">
      <Empty
        v-if="deviceList.length === 0"
        :description="$t('protocolLab.server.devicesEmpty')"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
      />
      <List v-else size="small">
        <ListItem
          v-for="dev in deviceList"
          :key="dev.deviceId"
          class="device-item"
          :class="{ active: dev.deviceId === selectedId }"
          @click="selectDevice(dev.deviceId)"
        >
          <div class="device-head">
            <Badge :status="dev.online ? 'success' : 'default'" />
            <span class="device-id">{{ dev.deviceId }}</span>
            <span v-if="dev.channelCount" class="device-meta">
              {{ $t('protocolLab.field.channelCount') }}:{{ dev.channelCount }}
            </span>
            <span v-if="dev.manufacturer" class="device-meta">
              {{ dev.manufacturer }}
            </span>
          </div>
          <!-- 行内订阅开关：@click.stop 防误触发选中；点击即下发/撤销 SUBSCRIBE -->
          <div class="device-subs" @click.stop>
            <label class="sub-switch">
              <Switch
                :checked="dev.subCatalog"
                :loading="subBusy.has(subKey(dev.deviceId, 'catalog'))"
                size="small"
                @change="(v) => onSubscriptionToggle(dev, 'catalog', !!v)"
              />
              <span>{{ $t('protocolLab.server.sub.catalog') }}</span>
            </label>
            <label class="sub-switch">
              <Switch
                :checked="dev.subPosition"
                :loading="subBusy.has(subKey(dev.deviceId, 'position'))"
                size="small"
                @change="(v) => onSubscriptionToggle(dev, 'position', !!v)"
              />
              <span>{{ $t('protocolLab.server.sub.position') }}</span>
            </label>
            <label class="sub-switch">
              <Switch
                :checked="dev.subAlarm"
                :loading="subBusy.has(subKey(dev.deviceId, 'alarm'))"
                size="small"
                @change="(v) => onSubscriptionToggle(dev, 'alarm', !!v)"
              />
              <span>{{ $t('protocolLab.server.sub.alarm') }}</span>
            </label>
          </div>
        </ListItem>
      </List>
    </div>

    <!-- 命令区 -->
    <div class="section-title">
      {{ $t('protocolLab.server.commands') }}
      <Tooltip
        v-if="!canCommand"
        :title="$t('protocolLab.msg.selectOnlineDevice')"
      >
        <span class="hint">ⓘ</span>
      </Tooltip>
    </div>

    <div class="command-area" :class="{ disabled: !canCommand }">
      <div class="channel-target">
        <div class="channel-target-copy">
          <span class="channel-target-label">
            {{ $t('protocolLab.server.commandChannel') }}
          </span>
          <span class="channel-target-help">
            {{ $t('protocolLab.server.commandChannelHint') }}
          </span>
        </div>
        <Select
          v-model:value="selectedChannelId"
          class="channel-select"
          :disabled="!canCommand || channelLoading || channelEmpty"
          :loading="channelLoading"
          :options="channelOptions"
          :placeholder="$t('protocolLab.server.channelSelect')"
          option-filter-prop="label"
          show-search
        />
        <span v-if="channelEmpty" class="channel-empty">
          {{ $t('protocolLab.server.channelEmpty') }}
        </span>
      </div>

      <PtzControl
        :device-id="selectedId"
        :channel-id="selectedChannelId"
        :speed="speed"
        :disabled="!canMediaCommand || loading"
        @command="onPtz"
      />

      <!-- 全协议命令面板（与设备管理页同源组件，能力对等）。 -->
      <DeviceCommandPanel
        :disabled="!canCommand || loading"
        @command="onCommand"
      />

      <!-- 点播留在父页：返回 playUrls 后由本页管理 MediaPlayer 弹窗。 -->
      <Space wrap class="mt-3">
        <Button
          type="primary"
          :disabled="!canMediaCommand || loading"
          @click="onLiveStart"
        >
          {{ $t('protocolLab.server.play') }}
        </Button>
      </Space>
    </div>

    <!-- 平台事件时间线 -->
    <div class="section-title">{{ $t('protocolLab.server.events') }}</div>
    <div class="timeline-wrap">
      <SipTimeline
        :events="events"
        :empty-text="$t('protocolLab.server.eventsEmpty')"
      />
    </div>

    <!-- 点播播放器弹窗：liveStart 返回 playUrls 后自动起播。
         显式指定 HTTP-FLV：flv.js 自带 demuxer、首帧最快，适配 lab 纯视频流。
         无 httpFlv 地址时 MediaPlayerManager 自动回退最佳格式。 -->
    <MediaPlayer
      :open="playerOpen"
      :play-urls="playerUrls"
      :title="playerTitle"
      format="httpFlv"
      @close="onPlayerClose"
    />
  </Card>
</template>

<style scoped>
.panel-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-card :deep(.ant-card-body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.section-title {
  margin: 12px 0 8px;
  font-weight: 600;
}

.section-title:first-child {
  margin-top: 0;
}

.hint {
  margin-left: 6px;
  font-weight: normal;
  color: hsl(var(--muted-foreground));
  cursor: help;
}

.device-list {
  /* flex-shrink:0：本卡片体是 flex column，timeline-wrap 为 flex:1 抢空间。
     设备列表带 overflow-y:auto 后其 min-height:auto 被解析为 0，会被压缩到只剩边框
     （表现为设备已渲染进 DOM、文字可选可复制，但容器塌成 2px、内容被 overflow 裁切不可见）。
     锁定不收缩，让列表保持内容高度（受 max-height 约束）。 */
  flex-shrink: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.device-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  cursor: pointer;
}

.device-head {
  display: flex;
  gap: 8px;
  align-items: center;
}

.device-subs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding-left: 18px;
  cursor: default;
}

.sub-switch {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.device-item.active {
  background-color: hsl(var(--accent) / 40%);
}

.device-id {
  font-family: var(--font-mono, monospace);
  font-size: 13px;
}

.device-meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.command-area.disabled {
  opacity: 0.6;
}

.channel-target {
  display: grid;
  grid-template-columns: minmax(140px, auto) minmax(220px, 1fr);
  gap: 4px 14px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: linear-gradient(
    110deg,
    hsl(var(--accent) / 34%),
    hsl(var(--card) / 12%)
  );
  border: 1px solid hsl(var(--border));
  border-left: 3px solid hsl(var(--primary));
  border-radius: 6px;
}

.channel-target-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.channel-target-label {
  font-size: 13px;
  font-weight: 600;
}

.channel-target-help,
.channel-empty {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.channel-empty {
  grid-column: 2;
  color: hsl(var(--destructive));
}

.channel-select {
  width: 100%;
}

@media (max-width: 640px) {
  .channel-target {
    grid-template-columns: 1fr;
  }

  .channel-empty {
    grid-column: 1;
  }
}

.timeline-wrap {
  flex: 1;
  min-height: 180px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
