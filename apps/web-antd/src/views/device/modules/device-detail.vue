<script lang="ts" setup>
import type { DeviceApi } from '#/api/device';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useSseEvents } from '#/composables/useSseEvents';
import { $t } from '#/locales';
import { DEVICE_DETAIL_TOPICS } from '#/views/protocol-lab/data';

import DeviceOperations from './device-operations.vue';

/**
 * 设备操作面板抽屉（§4.3）。
 *
 * 薄壳：connectedComponent 模式，从 drawerApi.getData() 取选中设备，
 * 订阅 device.* SSE 并按当前 deviceId 过滤后透传给 DeviceOperations。
 * 真正的命令逻辑都在 DeviceOperations（prop 驱动、可单测）。
 */
interface DeviceDrawerData extends DeviceApi.DeviceVO {
  /** 列表「实时点播」入口：打开抽屉即自动点播。 */
  __autoLive?: boolean;
}

const current = ref<DeviceDrawerData | null>(null);
const autoLive = ref(false);

// 订阅设备生命周期 + 应答事件，供详情时间线展示。
const { events } = useSseEvents(() => DEVICE_DETAIL_TOPICS);

/**
 * 仅保留当前设备的设备→平台事件（device.* / session.* / alarm.*）。
 *
 * 按 deviceId 匹配而非 topic 前缀：报警查询应答走 `alarm.new`、点播会话走 `session.*`，
 * 若只留 `device.*` 会把它们全滤掉（与 DEVICE_DETAIL_TOPICS 纳入 alarm/session 的设计相悖）。
 * 部分 session/alarm 帧的设备标识可能落在 deviceId 之外的字段，故一并匹配 data.id/deviceCode。
 */
const deviceEvents = computed(() => {
  const id = current.value?.deviceId;
  if (!id) {
    return [];
  }
  return events.value.filter((e) => {
    const d = e.data ?? {};
    return d.deviceId === id || d.id === id || d.deviceCode === id;
  });
});

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<DeviceDrawerData>();
      current.value = data ?? null;
      autoLive.value = !!data?.__autoLive;
    } else {
      autoLive.value = false;
    }
  },
});

/**
 * 订阅意图变更回写：直接改 current（即 grid 行同一对象引用），
 * 使抽屉 destroyOnClose 重建后从行值 watch 出最新意图，无需整页刷新。
 */
function onSubscriptionChange(payload: {
  enabled: boolean;
  kind: 'alarm' | 'catalog' | 'position';
}) {
  const row = current.value;
  if (!row) {
    return;
  }
  const sub = row.subscription ?? {
    alarm: false,
    catalog: false,
    position: false,
  };
  row.subscription = { ...sub, [payload.kind]: payload.enabled };
}

const drawerTitle = computed(() =>
  current.value?.deviceId
    ? `${$t('device.action.detail')} · ${current.value.deviceId}`
    : $t('device.action.detail'),
);
</script>

<template>
  <Drawer :title="drawerTitle" class="w-[920px]">
    <DeviceOperations
      :device="current"
      :events="deviceEvents"
      :auto-live="autoLive"
      @subscription-change="onSubscriptionChange"
    />
  </Drawer>
</template>
