<script lang="ts" setup>
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
  liveStart,
  ptzControl,
  queryCatalog,
  queryDeviceInfo,
  rebootDevice,
} from '#/api/protocol-lab';
import { $t } from '#/locales';

import { PTZ_DIRECTIONS, PTZ_ZOOM } from '../data';
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

function onPtz(command: string) {
  run(
    () =>
      ptzControl({
        deviceId: selectedId.value,
        channelId: selectedChannelId.value,
        command,
        speed: speed.value,
      }),
    'protocolLab.msg.ptzSent',
  );
}
function onQueryCatalog() {
  run(() => queryCatalog(selectedId.value), 'protocolLab.msg.queryCatalogSent');
}
function onQueryDeviceInfo() {
  run(
    () => queryDeviceInfo(selectedId.value),
    'protocolLab.msg.queryDeviceInfoSent',
  );
}
function onReboot() {
  run(() => rebootDevice(selectedId.value), 'protocolLab.msg.rebootSent');
}
function onLiveStart() {
  run(
    () =>
      liveStart({
        deviceId: selectedId.value,
        channelId: selectedChannelId.value,
      }),
    'protocolLab.msg.liveSent',
  );
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
      <div class="ptz-block">
        <div class="ptz-pad">
          <Button
            v-for="btn in PTZ_DIRECTIONS"
            :key="btn.command"
            class="ptz-btn"
            :style="{ gridRow: btn.row, gridColumn: btn.col }"
            :disabled="!canCommand || loading"
            size="small"
            @click="onPtz(btn.command)"
          >
            {{ $t(`protocolLab.ptz.${btn.key}`) }}
          </Button>
        </div>
        <div class="ptz-zoom">
          <Button
            v-for="btn in PTZ_ZOOM"
            :key="btn.command"
            :disabled="!canCommand || loading"
            size="small"
            @click="onPtz(btn.command)"
          >
            {{ $t(`protocolLab.ptz.${btn.key}`) }}
          </Button>
        </div>
      </div>

      <Space wrap class="mt-3">
        <Button :disabled="!canCommand || loading" @click="onQueryCatalog">
          {{ $t('protocolLab.server.queryCatalog') }}
        </Button>
        <Button :disabled="!canCommand || loading" @click="onQueryDeviceInfo">
          {{ $t('protocolLab.server.queryDeviceInfo') }}
        </Button>
        <Button :disabled="!canCommand || loading" @click="onReboot">
          {{ $t('protocolLab.server.reboot') }}
        </Button>
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

.ptz-block {
  display: flex;
  gap: 16px;
  align-items: center;
}

.ptz-pad {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.ptz-btn {
  min-width: 56px;
}

.ptz-zoom {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-wrap {
  flex: 1;
  min-height: 180px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
