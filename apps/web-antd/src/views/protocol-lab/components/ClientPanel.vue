<script lang="ts" setup>
import type { ProtocolLabApi } from '#/api/protocol-lab';
import type { LabEvent } from '#/composables/useSseEvents';

import { computed, ref } from 'vue';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Divider,
  InputNumber,
  message,
  Space,
  Switch,
} from 'ant-design-vue';

import {
  labKeepalive,
  labKeepaliveAuto,
  labPushAlarm,
  labPushCatalog,
  labPushDeviceInfo,
  labRegister,
  labUnregister,
} from '#/api/protocol-lab';
import { $t } from '#/locales';

import SipTimeline from './SipTimeline.vue';

/**
 * 左侧：设备 UA（Client）控制台。
 * - 身份卡片（clientId / ip:port）
 * - 操作按钮组（注册 / 注销 / 心跳 / 自动心跳 / 上报目录 / 上报设备信息 / 上报告警）
 * - "收到指令"时间线（消费 clientcmd.*）
 */
const props = defineProps<{
  config: null | ProtocolLabApi.LabConfig;
  /** 已按 clientcmd.* 过滤的事件。 */
  received: LabEvent[];
}>();

const channelCount = ref(4);
const autoKeepalive = ref(false);
const keepaliveInterval = ref(30);
const loading = ref(false);

const identity = computed(() => {
  const c = props.config;
  return {
    clientId: c?.clientId ?? '-',
    endpoint: c ? `${c.clientIp}:${c.clientPort}` : '-',
    serverEndpoint: c ? `${c.serverIp}:${c.serverPort}` : '-',
  };
});

async function run(fn: () => Promise<unknown>, okKey: string) {
  loading.value = true;
  try {
    await fn();
    message.success($t(okKey));
  } finally {
    loading.value = false;
  }
}

function onRegister() {
  run(() => labRegister({ expires: 3600 }), 'protocolLab.msg.registerSent');
}
function onUnregister() {
  run(() => labUnregister(), 'protocolLab.msg.unregisterSent');
}
function onKeepalive() {
  run(() => labKeepalive(), 'protocolLab.msg.keepaliveSent');
}
function onPushCatalog() {
  run(
    () => labPushCatalog({ channelCount: channelCount.value }),
    'protocolLab.msg.catalogSent',
  );
}
function onPushDeviceInfo() {
  run(() => labPushDeviceInfo(), 'protocolLab.msg.deviceInfoSent');
}
function onPushAlarm() {
  run(
    () => labPushAlarm({ alarmType: 1, priority: 1 }),
    'protocolLab.msg.alarmSent',
  );
}

async function onToggleAutoKeepalive(checked: boolean) {
  loading.value = true;
  try {
    const state = await labKeepaliveAuto({
      enabled: checked,
      intervalSec: keepaliveInterval.value,
    });
    autoKeepalive.value = state.enabled;
    keepaliveInterval.value = state.intervalSec;
    message.success(
      state.enabled
        ? $t('protocolLab.msg.autoKeepaliveOn')
        : $t('protocolLab.msg.autoKeepaliveOff'),
    );
  } catch {
    autoKeepalive.value = !checked; // 回滚开关
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Card :title="$t('protocolLab.client.title')" class="panel-card" size="small">
    <Descriptions :column="1" size="small" bordered>
      <DescriptionsItem :label="$t('protocolLab.client.clientId')">
        {{ identity.clientId }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('protocolLab.client.endpoint')">
        {{ identity.endpoint }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('protocolLab.client.target')">
        {{ identity.serverEndpoint }}
      </DescriptionsItem>
    </Descriptions>

    <Divider class="my-3" />

    <Space wrap>
      <Button type="primary" :loading="loading" @click="onRegister">
        {{ $t('protocolLab.client.register') }}
      </Button>
      <Button :loading="loading" @click="onUnregister">
        {{ $t('protocolLab.client.unregister') }}
      </Button>
      <Button :loading="loading" @click="onKeepalive">
        {{ $t('protocolLab.client.keepalive') }}
      </Button>
    </Space>

    <div class="auto-keepalive">
      <Switch
        :checked="autoKeepalive"
        :loading="loading"
        @change="(c) => onToggleAutoKeepalive(c as boolean)"
      />
      <span>{{ $t('protocolLab.client.autoKeepalive') }}</span>
      <InputNumber
        v-model:value="keepaliveInterval"
        :min="1"
        :max="3600"
        :addon-after="$t('protocolLab.field.seconds')"
        size="small"
        style="width: 120px"
      />
    </div>

    <Divider class="my-3" />

    <Space wrap>
      <InputNumber
        v-model:value="channelCount"
        :min="1"
        :max="64"
        size="small"
        :addon-before="$t('protocolLab.field.channel')"
        style="width: 130px"
      />
      <Button :loading="loading" @click="onPushCatalog">
        {{ $t('protocolLab.client.pushCatalog') }}
      </Button>
      <Button :loading="loading" @click="onPushDeviceInfo">
        {{ $t('protocolLab.client.pushDeviceInfo') }}
      </Button>
      <Button danger :loading="loading" @click="onPushAlarm">
        {{ $t('protocolLab.client.pushAlarm') }}
      </Button>
    </Space>

    <Divider class="my-3" />

    <div class="timeline-title">{{ $t('protocolLab.client.received') }}</div>
    <div class="timeline-wrap">
      <SipTimeline
        :events="received"
        :empty-text="$t('protocolLab.client.receivedEmpty')"
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
}

.auto-keepalive {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}

.timeline-title {
  margin-bottom: 8px;
  font-weight: 600;
}

.timeline-wrap {
  flex: 1;
  min-height: 200px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
