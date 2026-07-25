<script lang="ts" setup>
import { ref } from 'vue';

import { Button, Divider, Select, Space } from 'ant-design-vue';

import { $t } from '#/locales';

import {
  CONFIG_TYPE_OPTIONS,
  DEVICE_COMMAND_LABEL_KEY,
  DEVICE_COMMAND_SECTIONS,
  DEVICE_COMMANDS,
} from './device-commands';

/**
 * 共享设备命令面板（查询 / 配置 / 录像 / 报警 / 广播 / 重启）。
 *
 * 范本同 PtzControl：纯展示——只渲染按钮 + emit('command')，不调 API、不做权限/在线判断。
 * 由父页接 command 后注入实现：
 *  - 协议验证台 ServerPanel → 在线态门禁 + #/api/protocol-lab
 *  - 设备管理页 device-operations → 权限码门禁 + #/api/device
 *
 * 两页 import 同一组件 → 协议能力逐项对等；区别只在父页注入的实现与门禁语义。
 *
 * - 按 section 分组渲染（Divider + Space wrap），文案走 ${labelPrefix}.section.* / .action.*
 * - configDownload 前置 configType 下拉（面板内部 state），emit 时随 payload 带出
 * - disabled 时整组禁用且点击不 emit（与 PtzControl 一致的自身门控）
 */
const props = withDefaults(
  defineProps<{
    /** 禁用整组（父页据在线态 / loading / 无设备决定）。 */
    disabled?: boolean;
    /** i18n 前缀，默认 device（两页共用 device.* 词表，与 PtzControl 同理）。 */
    labelPrefix?: string;
  }>(),
  { disabled: false, labelPrefix: 'device' },
);

const emit = defineEmits<{
  command: [payload: { code: string; configType?: string }];
}>();

/** 配置下载类型（面板内部 state，emit configDownload 时带出）。 */
const configType = ref<string>('BASIC');

/** 取某分组下的命令（保持 DEVICE_COMMANDS 声明顺序）。 */
function commandsOf(section: string) {
  return DEVICE_COMMANDS.filter((c) => c.section === section);
}

/** 命令按钮文案 key：${labelPrefix}.action.<labelKey>。 */
function labelOf(code: string) {
  const key = DEVICE_COMMAND_LABEL_KEY[code] ?? code;
  return $t(`${props.labelPrefix}.action.${key}`);
}

/** 分组标题文案 key：${labelPrefix}.section.<section>。 */
function sectionTitle(section: string) {
  return $t(`${props.labelPrefix}.section.${section}`);
}

function onClick(code: string) {
  if (props.disabled) {
    return;
  }
  emit('command', {
    code,
    // 仅配置下载携带 configType，其余命令不带（保持 payload 精简）。
    configType: code === 'configDownload' ? configType.value : undefined,
  });
}
</script>

<template>
  <div class="device-command-panel">
    <template v-for="section in DEVICE_COMMAND_SECTIONS" :key="section">
      <Divider>{{ sectionTitle(section) }}</Divider>
      <Space wrap>
        <!-- 配置下载前置类型下拉 -->
        <Select
          v-if="section === 'config'"
          v-model:value="configType"
          :options="CONFIG_TYPE_OPTIONS"
          :disabled="disabled"
          style="width: 120px"
        />
        <Button
          v-for="cmd in commandsOf(section)"
          :key="cmd.code"
          :danger="cmd.danger"
          :disabled="disabled"
          @click="onClick(cmd.code)"
        >
          {{ labelOf(cmd.code) }}
        </Button>
      </Space>
    </template>
  </div>
</template>

<style scoped>
.device-command-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
