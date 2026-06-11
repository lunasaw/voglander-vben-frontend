<script lang="ts" setup>
import type { ProtocolLabApi } from '#/api/protocol-lab';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Badge, Button } from 'ant-design-vue';

import { getLabConfig } from '#/api/protocol-lab';
import { useSseEvents } from '#/composables/useSseEvents';
import { $t } from '#/locales';

import ClientPanel from './components/ClientPanel.vue';
import ServerPanel from './components/ServerPanel.vue';

/**
 * GB28181 协议验证台容器页。
 *
 * 职责：
 * 1. 拉取 /lab/client/config —— 取身份/端口 + 完整 topic 列表（同时校验后端 lab profile 是否开启）。
 * 2. 用完整 topic 列表建立 SSE 订阅（useSseEvents）。
 * 3. 把事件按方向分发给左右两个面板：clientcmd.* → 左；device / session / alarm → 右。
 */
const config = ref<null | ProtocolLabApi.LabConfig>(null);
const labDisabled = ref(false);

// SSE：topic 列表来自 config，config 就绪前为空（connect 直接 return），就绪后 restart。
const { events, status, restart, clear } = useSseEvents(
  () => config.value?.topics ?? [],
);

const clientcmdEvents = computed(() =>
  events.value.filter((e) => e.topic.startsWith('clientcmd.')),
);

const platformEvents = computed(() =>
  events.value.filter((e) => !e.topic.startsWith('clientcmd.')),
);

const statusBadge = computed(() => {
  switch (status.value) {
    case 'connecting': {
      return { status: 'processing' as const, key: 'connecting' };
    }
    case 'error': {
      return { status: 'error' as const, key: 'reconnecting' };
    }
    case 'open': {
      return { status: 'success' as const, key: 'connected' };
    }
    default: {
      return { status: 'default' as const, key: 'closed' };
    }
  }
});

onMounted(async () => {
  try {
    config.value = await getLabConfig();
    restart(); // config 就绪后用完整 topic 列表建连
  } catch {
    // config 端点仅在 voglander.protocol-lab.enabled=true 时注册，404/失败即视为未开启
    labDisabled.value = true;
  }
});
</script>

<template>
  <Page :title="$t('protocolLab.title')">
    <template #description>
      <p class="lab-desc text-muted-foreground">{{ $t('protocolLab.desc') }}</p>
    </template>
    <template #extra>
      <div class="header-extra">
        <Badge
          :status="statusBadge.status"
          :text="$t(`protocolLab.sse.${statusBadge.key}`)"
        />
        <Button size="small" @click="clear">
          {{ $t('protocolLab.action.clearTimeline') }}
        </Button>
      </div>
    </template>

    <Alert
      v-if="labDisabled"
      type="warning"
      show-icon
      :message="$t('protocolLab.disabled.title')"
      :description="$t('protocolLab.disabled.desc')"
      class="mb-4"
    />

    <div v-else class="lab-grid">
      <ClientPanel :config="config" :received="clientcmdEvents" />
      <ServerPanel :events="platformEvents" />
    </div>
  </Page>
</template>

<style scoped>
.header-extra {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
}

.lab-desc {
  max-width: 720px;
  margin: 0;
}

.lab-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  /* 视口高度减去顶栏/页头预留；左栏控件多时内部滚动，时间线最低 260px 不被压扁 */
  height: calc(100vh - 200px);
  min-height: 640px;
}

@media (max-width: 1100px) {
  .lab-grid {
    grid-template-columns: 1fr;
    height: auto;
  }
}
</style>
