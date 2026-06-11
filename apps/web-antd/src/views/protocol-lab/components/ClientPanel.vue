<script lang="ts" setup>
import type { ProtocolLabApi } from '#/api/protocol-lab';
import type { LabEvent } from '#/composables/useSseEvents';

import { computed, reactive, ref, watch } from 'vue';

import {
  Bell,
  ChevronDown,
  ChevronRight,
  Info,
  InspectionPanel,
  LogOut,
  Plus,
  RotateCw,
} from '@vben/icons';

import {
  Button,
  Card,
  Checkbox,
  Divider,
  Input,
  InputNumber,
  InputPassword,
  message,
  Select,
  SelectOption,
  Space,
  Switch,
  Tag,
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
 * - 身份卡片（clientId / ip:port / 目标平台，目标自定义时带「自定义」徽标）
 * - 可折叠「注册信息」表单：默认折叠＝注册到本进程自环；展开后可填目标平台 +
 *   设备身份，把模拟设备注册到任意外部 GB28181 平台（对齐后端 LabSessionHolder）
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

/** 是否展开「自定义注册信息」表单（折叠=自环，行为同现状）。 */
const showRegisterForm = ref(false);

/** 注册表单：目标平台 + 设备身份覆盖。 */
const registerForm = reactive({
  serverId: '',
  serverIp: '',
  serverPort: undefined as number | undefined,
  serverDomain: '',
  transport: 'UDP' as 'TCP' | 'UDP',
  clientId: '',
  clientPassword: '',
});

// config 就绪后用当前生效值预填表单默认值（含 holder 覆盖后的真实目标）。
watch(
  () => props.config,
  (c) => {
    if (!c) {
      return;
    }
    registerForm.serverId = c.serverId ?? '';
    registerForm.serverIp = c.serverIp ?? '';
    registerForm.serverPort = c.serverPort;
    registerForm.serverDomain = c.serverDomain ?? '';
    registerForm.transport = c.transport ?? 'UDP';
    registerForm.clientId = c.clientId ?? '';
  },
  { immediate: true },
);

const identity = computed(() => {
  const c = props.config;
  return {
    clientId: c?.clientId ?? '-',
    endpoint: c ? `${c.clientIp}:${c.clientPort}` : '-',
    serverEndpoint: c ? `${c.serverIp}:${c.serverPort}` : '-',
    targetCustomized: c?.targetCustomized ?? false,
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

/** 折叠时回退现状（自环，仅带 expires）；展开时带目标+身份覆盖。 */
function buildRegisterReq(): null | ProtocolLabApi.RegisterReq {
  if (!showRegisterForm.value) {
    return { expires: 3600 };
  }
  const serverId = registerForm.serverId.trim();
  const serverIp = registerForm.serverIp.trim();
  if (!serverId) {
    message.error($t('protocolLab.register.serverIdRequired'));
    return null;
  }
  if (!serverIp) {
    message.error($t('protocolLab.register.serverIpRequired'));
    return null;
  }
  const serverDomain = registerForm.serverDomain.trim();
  const clientId = registerForm.clientId.trim();
  return {
    expires: 3600,
    serverId,
    serverIp,
    serverPort: registerForm.serverPort ?? undefined,
    serverDomain: serverDomain || undefined,
    transport: registerForm.transport,
    clientId: clientId || undefined,
    clientPassword: registerForm.clientPassword || undefined,
  };
}

function onRegister() {
  const req = buildRegisterReq();
  if (!req) {
    return; // 校验未通过
  }
  run(() => labRegister(req), 'protocolLab.msg.registerSent');
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
    <!-- 身份条（紧凑两行，省垂直空间） -->
    <div class="identity-bar">
      <div class="id-row">
        <span class="id-label">{{ $t('protocolLab.client.clientId') }}</span>
        <span class="mono id-val">{{ identity.clientId }}</span>
        <span class="id-at mono">@ {{ identity.endpoint }}</span>
      </div>
      <div class="id-row">
        <span class="id-label">{{ $t('protocolLab.client.target') }}</span>
        <span class="mono id-val">{{ identity.serverEndpoint }}</span>
        <Tag v-if="identity.targetCustomized" color="orange">
          {{ $t('protocolLab.register.customized') }}
        </Tag>
        <Tag v-else color="default">
          {{ $t('protocolLab.register.selfLoop') }}
        </Tag>
      </div>
    </div>

    <!-- 注册控制：标题独占一行，折叠开关条占满宽度 -->
    <div class="section-title">{{ $t('protocolLab.section.register') }}</div>
    <div
      class="register-toggle"
      :class="{ open: showRegisterForm }"
      @click="showRegisterForm = !showRegisterForm"
    >
      <Checkbox :checked="showRegisterForm" />
      <span class="register-toggle-text">
        {{ $t('protocolLab.register.toggle') }}
      </span>
      <ChevronDown v-if="showRegisterForm" class="chev" />
      <ChevronRight v-else class="chev" />
    </div>
    <p class="register-hint">{{ $t('protocolLab.register.toggleHint') }}</p>

    <Transition name="collapse">
      <div v-if="showRegisterForm" class="register-form">
        <div class="register-group-title">
          {{ $t('protocolLab.register.targetGroup') }}
        </div>
        <div class="register-grid">
          <label class="register-item">
            <span class="register-label req">
              {{ $t('protocolLab.register.serverId') }}
            </span>
            <Input
              v-model:value="registerForm.serverId"
              allow-clear
              :placeholder="$t('protocolLab.register.serverIdPh')"
            />
          </label>
          <label class="register-item">
            <span class="register-label req">
              {{ $t('protocolLab.register.serverIp') }}
            </span>
            <Input
              v-model:value="registerForm.serverIp"
              allow-clear
              placeholder="192.168.1.100"
            />
          </label>
          <label class="register-item">
            <span class="register-label">
              {{ $t('protocolLab.register.serverPort') }}
            </span>
            <InputNumber
              v-model:value="registerForm.serverPort"
              :min="1"
              :max="65535"
              placeholder="5060"
              class="register-control"
            />
          </label>
          <label class="register-item">
            <span class="register-label">
              {{ $t('protocolLab.register.serverDomain') }}
            </span>
            <Input
              v-model:value="registerForm.serverDomain"
              allow-clear
              :placeholder="$t('protocolLab.register.optional')"
            />
          </label>
          <label class="register-item">
            <span class="register-label">
              {{ $t('protocolLab.register.transport') }}
            </span>
            <Select
              v-model:value="registerForm.transport"
              class="register-control"
            >
              <SelectOption value="UDP">UDP</SelectOption>
              <SelectOption value="TCP">TCP</SelectOption>
            </Select>
          </label>
        </div>

        <div class="register-group-title">
          {{ $t('protocolLab.register.identityGroup') }}
        </div>
        <div class="register-grid">
          <label class="register-item">
            <span class="register-label">
              {{ $t('protocolLab.register.clientId') }}
            </span>
            <Input
              v-model:value="registerForm.clientId"
              allow-clear
              :placeholder="$t('protocolLab.register.optional')"
            />
          </label>
          <label class="register-item">
            <span class="register-label">
              {{ $t('protocolLab.register.clientPassword') }}
            </span>
            <InputPassword
              v-model:value="registerForm.clientPassword"
              allow-clear
              :placeholder="$t('protocolLab.register.optional')"
            />
          </label>
        </div>
      </div>
    </Transition>

    <Space wrap class="action-row">
      <Button type="primary" :loading="loading" @click="onRegister">
        <template #icon><Plus class="btn-icon" /></template>
        {{ $t('protocolLab.client.register') }}
      </Button>
      <Button :loading="loading" @click="onUnregister">
        <template #icon><LogOut class="btn-icon" /></template>
        {{ $t('protocolLab.client.unregister') }}
      </Button>
      <Button :loading="loading" @click="onKeepalive">
        <template #icon><RotateCw class="btn-icon" /></template>
        {{ $t('protocolLab.client.keepalive') }}
      </Button>
    </Space>

    <Divider class="my-3" />

    <!-- 自动心跳：标题 + 开关 + 间隔同行 -->
    <div class="control-row">
      <span class="row-title">{{ $t('protocolLab.section.heartbeat') }}</span>
      <Switch
        :checked="autoKeepalive"
        :loading="loading"
        @change="(c) => onToggleAutoKeepalive(c as boolean)"
      />
      <span class="auto-keepalive-label">
        {{ $t('protocolLab.client.autoKeepalive') }}
      </span>
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

    <!-- 主动上报：标题 + 通道数 + 三个上报按钮同行 -->
    <div class="control-row report-row">
      <span class="row-title">{{ $t('protocolLab.section.report') }}</span>
      <InputNumber
        v-model:value="channelCount"
        :min="1"
        :max="64"
        size="small"
        :addon-before="$t('protocolLab.field.channel')"
        style="width: 140px"
      />
      <Button :loading="loading" @click="onPushCatalog">
        <template #icon><InspectionPanel class="btn-icon" /></template>
        {{ $t('protocolLab.client.pushCatalog') }}
      </Button>
      <Button :loading="loading" @click="onPushDeviceInfo">
        <template #icon><Info class="btn-icon" /></template>
        {{ $t('protocolLab.client.pushDeviceInfo') }}
      </Button>
      <Button danger :loading="loading" @click="onPushAlarm">
        <template #icon><Bell class="btn-icon" /></template>
        {{ $t('protocolLab.client.pushAlarm') }}
      </Button>
    </div>

    <Divider class="my-3" />

    <!-- 收到指令时间线 -->
    <div class="section-title">{{ $t('protocolLab.client.received') }}</div>
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
  overflow-y: auto;
}

.mono {
  font-family: var(--font-mono, monospace);
  font-size: 13px;
}

/* 紧凑身份条 */
.identity-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: hsl(var(--accent) / 20%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.id-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.id-label {
  min-width: 64px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.id-val {
  font-weight: 500;
}

.id-at {
  color: hsl(var(--muted-foreground));
}

/* 同行控件区：标题在左、控件在右 */
.control-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.row-title {
  flex-shrink: 0;
  min-width: 64px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

/* 注册折叠开关：整行可点，hover 高亮 */
.register-toggle {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  cursor: pointer;
  background: hsl(var(--accent) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.register-toggle:hover {
  background: hsl(var(--accent) / 55%);
}

.register-toggle.open {
  border-color: hsl(var(--primary) / 50%);
}

.register-toggle-text {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
}

.chev {
  width: 16px;
  height: 16px;
  color: hsl(var(--muted-foreground));
}

.register-hint {
  margin: 6px 2px 0;
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

/* 注册表单面板 */
.register-form {
  padding: 12px 14px;
  margin-top: 10px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.register-group-title {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.register-group-title:not(:first-child) {
  padding-top: 12px;
  margin-top: 14px;
  border-top: 1px dashed hsl(var(--border));
}

.register-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.register-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.register-label {
  font-size: 12px;
  color: hsl(var(--foreground));
}

/* 必填项前置红点 */
.register-label.req::before {
  margin-right: 3px;
  color: hsl(var(--destructive, 0 84% 60%));
  content: '*';
}

.register-control {
  width: 100%;
}

.action-row {
  margin-top: 12px;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.auto-keepalive-label {
  font-size: 13px;
}

/* 时间线标题（独占一行） */
.section-title {
  margin: 14px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.timeline-wrap {
  /* flex-basis:0 + grow → 高度由剩余空间决定（有界），子元素才能内部滚动；
     min-height 兜底防止控件多时被压太小（超出则卡片体滚动）。 */
  flex: 1 1 0;
  min-height: 260px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

/* 折叠展开动画 */
.collapse-enter-active,
.collapse-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
