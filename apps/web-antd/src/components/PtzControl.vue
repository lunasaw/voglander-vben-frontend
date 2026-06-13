<script lang="ts" setup>
import { Button } from 'ant-design-vue';

import { $t } from '#/locales';

import { PTZ_DIRECTIONS, PTZ_ZOOM } from './ptz-control';

/**
 * 共享 PTZ 方向盘（3×3 八向 + STOP + 变倍）。
 *
 * 从协议验证台 ServerPanel 提取（§4.4），供「协议台」与「设备管理页」共用，
 * 避免两份方向盘实现漂移。组件只负责"渲染按钮 + 发出命令"，不直接调 API——
 * 由父组件接 `command` 事件后决定调 `/ptz/control` 或做权限/在线态校验。
 *
 * - 点击发出 `command` 事件，payload 已携带完整下发上下文（deviceId/channelId/command/speed）。
 * - i18n 文案前缀默认 `protocolLab.ptz.*`，可由 `labelPrefix` 覆盖（如设备页换 `device.ptz.*`）。
 */
const props = withDefaults(
  defineProps<{
    /** 通道号（catalog 通道命名规则：clientId+两位序号），缺省由父决定。 */
    channelId?: string;
    /** 目标设备编码。 */
    deviceId: string;
    /** 禁用整组按钮（未选在线设备 / 命令进行中）。 */
    disabled?: boolean;
    /** i18n 文案前缀，默认 protocolLab.ptz（与协议台一致）。 */
    labelPrefix?: string;
    /** PTZ 速度，默认 128。 */
    speed?: number;
  }>(),
  {
    channelId: undefined,
    disabled: false,
    labelPrefix: 'protocolLab.ptz',
    speed: 128,
  },
);

const emit = defineEmits<{
  command: [
    payload: {
      channelId?: string;
      command: string;
      deviceId: string;
      speed: number;
    },
  ];
}>();

function onClick(command: string) {
  if (props.disabled) {
    return;
  }
  emit('command', {
    deviceId: props.deviceId,
    channelId: props.channelId,
    command,
    speed: props.speed,
  });
}
</script>

<template>
  <div class="ptz-block">
    <div class="ptz-pad">
      <Button
        v-for="btn in PTZ_DIRECTIONS"
        :key="btn.command"
        class="ptz-btn"
        :style="{ gridRow: btn.row, gridColumn: btn.col }"
        :disabled="disabled"
        size="small"
        @click="onClick(btn.command)"
      >
        {{ $t(`${labelPrefix}.${btn.key}`) }}
      </Button>
    </div>
    <div class="ptz-zoom">
      <Button
        v-for="btn in PTZ_ZOOM"
        :key="btn.command"
        :disabled="disabled"
        size="small"
        @click="onClick(btn.command)"
      >
        {{ $t(`${labelPrefix}.${btn.key}`) }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
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
</style>
