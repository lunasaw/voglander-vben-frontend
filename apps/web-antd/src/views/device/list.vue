<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { DeviceApi } from '#/api/device';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getDevicePage } from '#/api/device';
import { useSseEvents } from '#/composables/useSseEvents';
import { $t } from '#/locales';

import {
  buildDevicePageBody,
  mergeDeviceEvents,
  useColumns,
  useGridFormSchema,
} from './data';
import DeviceDetail from './modules/device-detail.vue';

/**
 * 设备管理列表页（§4.2）——「Fleet Console 机群指挥台」皮肤。
 *
 * - VxeGrid 条件筛选 + 持久化分页（POST /device/getPage）
 * - SSE 订阅 device.* → 增量刷新当前页行的在线态 / 心跳 / 通道数
 * - 顶部态势带：脉冲雷达 + 等宽统计读数（总数/在线/离线/通道），随 query 与 SSE 实时跳数，
 *   与详情面板（device-operations.vue）共享指挥台视觉语言（--mono / HSL 令牌 / 自适应明暗）
 * - 操作列：详情（打开操作面板抽屉）/ 实时点播（复用 /live/start）
 */
const { hasAccessByCodes } = useAccess();

// 态势带统计源：total 取服务端总数，在线/离线/通道按「当前页」统计（与用户所见一致）。
const totalDevices = ref(0);
const pageRows = ref<DeviceApi.DeviceVO[]>([]);

const onlineCount = computed(
  () => pageRows.value.filter((r) => r.status === 1).length,
);
const offlineCount = computed(
  () => pageRows.value.filter((r) => r.status !== 1).length,
);
const channelTotal = computed(() =>
  pageRows.value.reduce((sum, r) => sum + (r.channelCount ?? 0), 0),
);
const hasOnline = computed(() => onlineCount.value > 0);

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: DeviceDetail,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const body = buildDevicePageBody(formValues ?? {});
          const resp = await getDevicePage(
            { page: page.currentPage, size: page.pageSize },
            body,
          );
          // 同步态势带统计（服务端分页：在线/离线/通道为当前页口径）。
          totalDevices.value = resp?.total ?? 0;
          pageRows.value = resp?.items ?? [];
          return resp;
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    scrollX: {
      enabled: true,
    },
    scrollY: {
      enabled: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<DeviceApi.DeviceVO>,
});

// SSE 实时刷新：device.* 生命周期 / 心跳 / 目录 → 当前页行增量更新 + 态势带跳数。
const { events } = useSseEvents(() => [
  'device.register',
  'device.online',
  'device.offline',
  'device.keepalive',
  'device.catalog',
]);

watch(events, (list) => {
  const rows = gridApi.grid?.getData?.() as DeviceApi.DeviceVO[] | undefined;
  if (!rows || rows.length === 0) {
    return;
  }
  const next = mergeDeviceEvents(rows, list);
  gridApi.setGridOptions({ data: next });
  pageRows.value = next; // 态势带随事件实时重算
});

function onActionClick(e: OnActionClickParams<DeviceApi.DeviceVO>) {
  switch (e.code) {
    case 'detail': {
      onDetail(e.row);
      break;
    }
    case 'liveStart': {
      onLiveStart(e.row);
      break;
    }
  }
}

function onDetail(row: DeviceApi.DeviceVO) {
  if (!hasAccessByCodes(['Device:Device:Query'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  detailDrawerApi.setData(row).open();
}

function onLiveStart(row: DeviceApi.DeviceVO) {
  if (!hasAccessByCodes(['Device:Cmd:Live'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  // 列表行点播直接走详情面板（承载播放器），与详情同源，避免两套点播逻辑。
  detailDrawerApi.setData({ ...row, __autoLive: true }).open();
}

function onRefresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <DetailDrawer @success="onRefresh" />

    <div class="fleet" :class="{ 'is-active': hasOnline }">
      <!-- 机群态势带（记忆点）：脉冲雷达 + 网格纹理 + 等宽统计读数 -->
      <header class="fleet-band">
        <div class="band-grid" aria-hidden="true"></div>
        <div class="band-scan" aria-hidden="true"></div>

        <div class="band-id">
          <span class="radar" :class="{ live: hasOnline }" aria-hidden="true">
            <span class="radar-core"></span>
            <span class="radar-wave"></span>
          </span>
          <div class="band-text">
            <div class="band-title">
              {{ $t('device.fleet.heading') }}
              <span class="band-live">
                <span class="live-dot"></span>{{ $t('device.fleet.live') }}
              </span>
            </div>
            <div class="band-sub">{{ $t('device.fleet.subtitle') }}</div>
          </div>
        </div>

        <div class="band-stats">
          <div class="stat">
            <div class="stat-val">{{ totalDevices }}</div>
            <div class="stat-key">{{ $t('device.fleet.total') }}</div>
          </div>
          <div class="stat stat-online">
            <div class="stat-val">{{ onlineCount }}</div>
            <div class="stat-key">{{ $t('device.fleet.online') }}</div>
          </div>
          <div class="stat stat-offline">
            <div class="stat-val">{{ offlineCount }}</div>
            <div class="stat-key">{{ $t('device.fleet.offline') }}</div>
          </div>
          <div class="stat">
            <div class="stat-val">{{ channelTotal }}</div>
            <div class="stat-key">{{ $t('device.fleet.channels') }}</div>
          </div>
        </div>
      </header>

      <!-- 控制台化表格 -->
      <div class="fleet-grid">
        <Grid :table-title="$t('device.fleet.scope')" />
      </div>
    </div>
  </Page>
</template>

<style scoped>
/* ============================ Fleet Console ============================
   机群指挥台：与详情面板（device-operations.vue）共享视觉语言——脉冲雷达、
   网格纹理、等宽读数、发丝边框；全部基于主题令牌 hsl(var(--*))，自适应明暗。
   ===================================================================== */
.fleet {
  --mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
  --hair: hsl(var(--border));

  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  min-height: 0;
}

/* ---- 入场：态势带淡入下沉 ---- */
@keyframes band-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================ 态势带 ============================ */
.fleet-band {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 16px 28px;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  overflow: hidden;
  background:
    radial-gradient(
      120% 180% at 0% 0%,
      hsl(var(--success) / 12%),
      transparent 52%
    ),
    linear-gradient(
      135deg,
      hsl(var(--card)) 0%,
      hsl(var(--background-deep, var(--background))) 100%
    );
  border: 1px solid var(--hair);
  border-radius: calc(var(--radius) + 4px);
  box-shadow:
    inset 0 1px 0 hsl(var(--foreground) / 6%),
    0 20px 44px -30px hsl(var(--foreground) / 50%);
  opacity: 0;
  transform: translateY(-8px);
  animation: band-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.04s forwards;
}

/* 无在线设备：去掉绿调，回落中性 */
.fleet:not(.is-active) .fleet-band {
  background:
    radial-gradient(
      120% 180% at 0% 0%,
      hsl(var(--muted-foreground) / 10%),
      transparent 52%
    ),
    linear-gradient(
      135deg,
      hsl(var(--card)) 0%,
      hsl(var(--background-deep, var(--background))) 100%
    );
}

.band-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(hsl(var(--foreground) / 4%) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--foreground) / 4%) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: linear-gradient(90deg, #000, #000 30%, transparent 92%);
}

/* 扫描线：自左向右扫过的高光，强化「实时监控」语义 */
.band-scan {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--success) / 14%) 50%,
    transparent
  );
  opacity: 0;
}

.fleet.is-active .band-scan {
  animation: scan 6s linear infinite;
}

@keyframes scan {
  0% {
    opacity: 0;
    transform: translateX(-100%);
  }

  10%,
  60% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* ---- 身份区 ---- */
.band-id {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
}

.radar {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.radar-core {
  position: absolute;
  inset: 4px;
  background: hsl(var(--muted-foreground));
  border-radius: 50%;
}

.radar.live .radar-core {
  background: hsl(var(--success));
  box-shadow: 0 0 12px hsl(var(--success) / 80%);
}

.radar-wave {
  position: absolute;
  inset: 0;
  border: 1px solid hsl(var(--success));
  border-radius: 50%;
  opacity: 0;
}

.radar.live .radar-wave {
  animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {
  0% {
    opacity: 0.7;
    transform: scale(0.55);
  }

  70%,
  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}

.band-title {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 17px;
  font-weight: 680;
  line-height: 1.2;
  color: hsl(var(--foreground));
}

.band-live {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 2px 8px;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.14em;
  border: 1px solid var(--hair);
  border-radius: 999px;
}

.fleet.is-active .band-live {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
  border-color: hsl(var(--success) / 35%);
}

.live-dot {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
}

.fleet.is-active .live-dot {
  animation: blink 1.4s steps(2, jump-none) infinite;
}

@keyframes blink {
  50% {
    opacity: 0.25;
  }
}

.band-sub {
  margin-top: 3px;
  font-family: var(--mono);
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.08em;
}

/* ---- 统计读数 ---- */
.band-stats {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stat {
  position: relative;
  min-width: 92px;
  padding: 10px 16px;
  background: hsl(var(--card) / 60%);
  border: 1px solid var(--hair);
  border-radius: var(--radius);
  backdrop-filter: blur(2px);
}

.stat::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 2px;
  content: '';
  background: hsl(var(--muted-foreground) / 45%);
  border-radius: 2px;
}

.stat-online::before {
  background: hsl(var(--success));
}

.stat-offline::before {
  background: hsl(var(--destructive) / 70%);
}

.stat-val {
  font-family: var(--mono);
  font-size: 24px;
  font-weight: 680;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: hsl(var(--foreground));
}

.stat-online .stat-val {
  color: hsl(var(--success));
}

.stat-offline .stat-val {
  color: hsl(var(--destructive));
}

.stat-key {
  margin-top: 6px;
  font-family: var(--mono);
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

/* ============================ 控制台化表格 ============================ */
.fleet-grid {
  flex: 1;
  min-height: 0;
}

/* 表头：等宽 + 字距，呼应态势带读数 */
.fleet-grid :deep(.vxe-header--column .vxe-cell--title) {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* 设备编号 / IP：等宽读数 */
.fleet-grid :deep(.device-cell-mono .vxe-cell) {
  font-family: var(--mono);
  font-size: 12.5px;
  color: hsl(var(--foreground) / 90%);
  letter-spacing: 0.02em;
}

.fleet-grid :deep(.device-cell-name .vxe-cell) {
  font-weight: 560;
}

/* 通道数：等宽 tabular 数字，列对齐稳定 */
.fleet-grid :deep(.device-cell-count .vxe-cell) {
  font-family: var(--mono);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 行悬停：左侧发丝高亮条 + 轻微抬升感 */
.fleet-grid :deep(.vxe-body--row) {
  transition: background-color 0.16s;
}

.fleet-grid :deep(.vxe-body--row:hover) {
  background: hsl(var(--accent, var(--muted)) / 55%);
}

@media (prefers-reduced-motion: reduce) {
  .fleet-band {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .radar.live .radar-wave,
  .fleet.is-active .band-scan,
  .fleet.is-active .live-dot {
    animation: none;
  }
}
</style>
