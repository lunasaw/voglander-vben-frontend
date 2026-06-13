<script lang="ts" setup>
import type { DeviceApi } from '#/api/device';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useSseEvents } from '#/composables/useSseEvents';
import { $t } from '#/locales';
import { DEVICE_TOPICS } from '#/views/protocol-lab/data';

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
const { events } = useSseEvents(() => DEVICE_TOPICS);

/** 仅保留当前设备的 device.* 事件。 */
const deviceEvents = computed(() => {
  const id = current.value?.deviceId;
  if (!id) {
    return [];
  }
  return events.value.filter(
    (e) => e.topic.startsWith('device.') && e.data?.deviceId === id,
  );
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
    />
  </Drawer>
</template>
