<script lang="ts" setup>
import type { ProtocolLabApi } from '#/api/protocol-lab';
import type { LabEvent } from '#/composables/useSseEvents';

import { computed, ref, watch } from 'vue';

import {
  Badge,
  Button,
  Card,
  Empty,
  List,
  ListItem,
  message,
  Space,
  Tooltip,
} from 'ant-design-vue';

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
}

const devices = ref<Map<string, DeviceRow>>(new Map());
const selectedId = ref<string>('');
const speed = ref(128);
const loading = ref(false);

/** 点播播放器弹窗：onLiveStart 拿到 playUrls 后打开。 */
const playerOpen = ref(false);
const playerUrls = ref<ProtocolLabApi.LivePlayVO['playUrls']>(undefined);
const playerTitle = ref('');

const deviceList = computed(() =>
  [...devices.value.values()].toSorted((a, b) => b.lastTs - a.lastTs),
);

const selectedChannelId = computed(() => {
  const dev = selectedId.value ? devices.value.get(selectedId.value) : null;
  // catalog 通道命名规则：clientId + 两位序号；缺省回退 deviceId+'01'
  return dev ? `${dev.deviceId}01` : '';
});

const canCommand = computed(() => {
  const dev = selectedId.value ? devices.value.get(selectedId.value) : null;
  return !!dev && dev.online;
});

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

function selectDevice(id: string) {
  selectedId.value = id;
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
  run(
    () =>
      ptzControl({
        ...payload,
        channelId: payload.channelId ?? selectedChannelId.value,
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
  loading.value = true;
  liveStart({
    deviceId: selectedId.value,
    channelId: selectedChannelId.value,
  })
    .then((vo) => {
      message.success($t('protocolLab.msg.liveSent'));
      // 点播成功且有可播地址 → 打开播放器弹窗自动起播；失败/无地址不打扰
      if (vo?.playUrls && Object.keys(vo.playUrls).length > 0) {
        playerUrls.value = vo.playUrls;
        playerTitle.value = `${selectedId.value} · ${selectedChannelId.value}`;
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
          <Badge :status="dev.online ? 'success' : 'default'" />
          <span class="device-id">{{ dev.deviceId }}</span>
          <span v-if="dev.channelCount" class="device-meta">
            {{ $t('protocolLab.field.channelCount') }}:{{ dev.channelCount }}
          </span>
          <span v-if="dev.manufacturer" class="device-meta">
            {{ dev.manufacturer }}
          </span>
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
      <PtzControl
        :device-id="selectedId"
        :channel-id="selectedChannelId"
        :speed="speed"
        :disabled="!canCommand || loading"
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
          :disabled="!canCommand || loading"
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
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.device-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
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

.timeline-wrap {
  flex: 1;
  min-height: 180px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
