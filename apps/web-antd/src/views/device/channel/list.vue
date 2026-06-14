<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { DeviceApi } from '#/api/device';

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { ArrowLeft, Eraser } from '@vben/icons';

import { Button, Empty, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDeviceChannelBatch,
  deleteDeviceChannelOne,
  getDeviceChannelPage,
  liveStart,
} from '#/api/device';
import MediaPlayer from '#/components/MediaPlayer.vue';
import { $t } from '#/locales';

import { buildChannelPageBody, useColumns, useGridFormSchema } from './data';
import ChannelForm from './modules/channel-form.vue';

/**
 * 设备通道列表页（S5 §4.2）——延续设备列表「Sentinel / Fleet Console」指挥台美学。
 *
 * - 读 route.params.deviceId 钻取过滤 POST /deviceChannel/getPage
 * - 通道行点播复用既有 /live/start（liveStart({deviceId, channelId})），与设备页同源
 * - 态势带：把钻取上下文（返回 + 设备身份）与通道统计读数（总数/在线/离线）融进
 *   同一条 Fleet 带——脉冲雷达 / 扫描线 / 网格纹理 / 等宽读数 / 入场动画全部复用设备页，
 *   钻取进来视觉语言连续
 * - 无 deviceId（直接访问无参 path）显示空态 + 返回入口
 */
const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();

const deviceId = computed(() => (route.params.deviceId as string) || '');
const deviceName = computed(
  () => (route.query.deviceName as string) || deviceId.value,
);
const hasDevice = computed(() => !!deviceId.value);

// 态势带统计源：独立于列表筛选/分页的「全量统计」。
// 服务端按 deviceId + status SQL 聚合：分别查 status=1 / status=0 的 total，
// 各取 size:1 只拿计数不拉数据；总数 = 在线 + 离线。这样翻页/筛选都不影响读数，
// 也无需把全部通道拉到前端（规避用户反馈的「翻到最后才显示在线」）。
const onlineCount = ref(0);
const offlineCount = ref(0);
const totalChannels = computed(() => onlineCount.value + offlineCount.value);
const hasOnline = computed(() => onlineCount.value > 0);

/** 拉取全量在线/离线计数（与列表查询解耦，仅取 total）。 */
async function loadStats() {
  if (!hasDevice.value) {
    onlineCount.value = 0;
    offlineCount.value = 0;
    return;
  }
  const [online, offline] = await Promise.all([
    getDeviceChannelPage(
      { page: 1, size: 1 },
      { deviceId: deviceId.value, status: 1 },
    ),
    getDeviceChannelPage(
      { page: 1, size: 1 },
      { deviceId: deviceId.value, status: 0 },
    ),
  ]);
  onlineCount.value = online?.total ?? 0;
  offlineCount.value = offline?.total ?? 0;
}

// 点播播放器弹窗（与 device-operations.vue 同套逻辑）。
const playerOpen = ref(false);
const playerUrls = ref<DeviceApi.LivePlayVO['playUrls']>(undefined);
const playerTitle = ref('');

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: false,
    // 3 个筛选项 + 重置/搜索按钮组 = 4 格，4 列网格使其全部收纳在同一行。
    wrapperClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    // 收窄字段标签宽度，把空间让给输入框（与字段名等宽大写风格协调）。
    commonConfig: {
      labelWidth: 70,
    },
  },
  gridOptions: {
    checkboxConfig: {
      highlight: true,
    },
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          // 无 deviceId 时不发请求，返回空集（空态由模板兜底）。
          if (!hasDevice.value) {
            return { total: 0, items: [] };
          }
          const resp = await getDeviceChannelPage(
            { page: page.currentPage, size: page.pageSize },
            buildChannelPageBody(formValues ?? {}, deviceId.value),
          );
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
  } as VxeTableGridOptions<DeviceApi.DeviceChannelVO>,
});

// 编辑抽屉（connectedComponent=channel-form），提交成功后刷新列表。
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: ChannelForm,
});

function onActionClick(e: OnActionClickParams<DeviceApi.DeviceChannelVO>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'liveStart': {
      onLiveStart(e.row);
      break;
    }
  }
}

function onEdit(row: DeviceApi.DeviceChannelVO) {
  if (!hasAccessByCodes(['Device:Channel:Edit'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  formDrawerApi.setData(row).open();
}

function onDelete(row: DeviceApi.DeviceChannelVO) {
  if (!hasAccessByCodes(['Device:Channel:Delete'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  // 二次确认由 CellOperation 内置 Popconfirm 承载，此处直接执行删除。
  const hideLoading = message.loading({
    content: $t('device.msg.channelDeleting', [row.name || row.channelId]),
    duration: 0,
    key: 'channel_delete_msg',
  });
  deleteDeviceChannelOne(row.id)
    .then(() => {
      message.success({
        content: $t('device.msg.deleteSuccess'),
        key: 'channel_delete_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

// 勾选多删：后端无 id 数组接口，循环 deleteOne 逐条删（与设备页勾选删除语义一致）。
function onBatchDelete() {
  if (!hasAccessByCodes(['Device:Channel:Delete'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  const records =
    (gridApi.grid?.getCheckboxRecords?.() as DeviceApi.DeviceChannelVO[]) ?? [];
  if (records.length === 0) {
    message.warning($t('device.msg.batchDeleteEmpty'));
    return;
  }
  Modal.confirm({
    content: $t('device.msg.channelBatchConfirm', [records.length]),
    title: $t('device.action.batchDelete'),
    onOk: async () => {
      await Promise.all(records.map((r) => deleteDeviceChannelOne(r.id)));
      message.success($t('device.msg.deleteSuccess'));
      onRefresh();
    },
  });
}

// 清理离线通道：按条件批删 { deviceId, status: 0 }（一次性清掉目录回包后残留的离线行）。
function onClearOffline() {
  if (!hasAccessByCodes(['Device:Channel:Delete'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  Modal.confirm({
    content: $t('device.msg.clearOfflineConfirm'),
    title: $t('device.action.clearOffline'),
    onOk: async () => {
      await deleteDeviceChannelBatch({ deviceId: deviceId.value, status: 0 });
      message.success($t('device.msg.clearOfflineDone'));
      onRefresh();
    },
  });
}

function onRefresh() {
  gridApi.query();
  // 全量统计与列表同步刷新（删除/清空离线后读数即时更新）。
  loadStats();
}

// 设备切换 / 首次进入即拉全量统计（含 immediate，覆盖初始挂载）。
watch(deviceId, loadStats, { immediate: true });

function onLiveStart(row: DeviceApi.DeviceChannelVO) {
  // 通道点播复用既有 /live/start；有 playUrls 才开弹窗，失败不打扰。
  playerTitle.value = `${row.deviceId} · ${row.channelId}`;
  liveStart({ deviceId: row.deviceId, channelId: row.channelId })
    .then((vo) => {
      message.success($t('device.msg.liveSent'));
      if (vo?.playUrls && Object.keys(vo.playUrls).length > 0) {
        playerUrls.value = vo.playUrls;
        playerOpen.value = true;
      }
    })
    .catch(() => {
      message.error($t('device.msg.cmdFailed'));
    });
}

function onPlayerClose() {
  playerOpen.value = false;
}

function goBack() {
  router.push('/device/list');
}
</script>

<template>
  <Page auto-content-height>
    <div class="fleet" :class="{ 'is-active': hasOnline }">
      <!-- 态势带：钻取上下文（返回 + 设备身份）⊕ 通道统计读数，与设备页同源 -->
      <header class="fleet-band">
        <div class="band-grid" aria-hidden="true"></div>
        <div class="band-scan" aria-hidden="true"></div>

        <div class="band-id">
          <Button class="back-btn" size="small" @click="goBack">
            <ArrowLeft />
            {{ $t('device.channel.back') }}
          </Button>

          <span class="band-sep" aria-hidden="true"></span>

          <span class="radar" :class="{ live: hasOnline }" aria-hidden="true">
            <span class="radar-core"></span>
            <span class="radar-wave"></span>
          </span>

          <div class="band-text">
            <div class="band-title">
              <span class="band-name">{{ deviceName }}</span>
              <span class="band-live">
                <span class="live-dot"></span>{{ $t('device.fleet.live') }}
              </span>
            </div>
            <div class="band-sub">
              <span class="band-tag">{{
                $t('device.channel.deviceLabel')
              }}</span>
              <span class="band-code">{{ deviceId || '—' }}</span>
            </div>
          </div>
        </div>

        <div v-if="hasDevice" class="band-stats">
          <div class="stat">
            <div class="stat-val">{{ totalChannels }}</div>
            <div class="stat-key">{{ $t('device.channel.total') }}</div>
          </div>
          <div class="stat stat-online">
            <div class="stat-val">{{ onlineCount }}</div>
            <div class="stat-key">{{ $t('device.channel.online') }}</div>
          </div>
          <div class="stat stat-offline">
            <div class="stat-val">{{ offlineCount }}</div>
            <div class="stat-key">{{ $t('device.channel.offline') }}</div>
          </div>
        </div>
      </header>

      <!-- 无 deviceId：空态 -->
      <div v-if="!hasDevice" class="chan-empty">
        <Empty :description="$t('device.channel.empty')" />
        <Button type="primary" @click="goBack">
          {{ $t('device.channel.back') }}
        </Button>
      </div>

      <!-- 控制台化表格 -->
      <div v-else class="fleet-grid">
        <Grid :table-title="$t('device.channel.title')">
          <template #toolbar-tools>
            <Button
              v-if="hasAccessByCodes(['Device:Channel:Delete'])"
              danger
              type="primary"
              class="mr-2"
              @click="onBatchDelete"
            >
              {{ $t('device.action.batchDelete') }}
            </Button>
            <Button
              v-if="hasAccessByCodes(['Device:Channel:Delete'])"
              class="mr-2"
              @click="onClearOffline"
            >
              <Eraser class="mr-1 size-4" />
              {{ $t('device.action.clearOffline') }}
            </Button>
          </template>
        </Grid>
      </div>
    </div>

    <!-- 编辑表单抽屉 -->
    <FormDrawer @success="onRefresh" />

    <!-- 点播播放器弹窗 -->
    <MediaPlayer
      :open="playerOpen"
      :play-urls="playerUrls"
      :title="playerTitle"
      format="httpFlv"
      @close="onPlayerClose"
    />
  </Page>
</template>

<style scoped>
/* ============================ Channel Console ============================
   与设备列表（list.vue）/ 详情面板（device-operations.vue）共享视觉语言——
   脉冲雷达、扫描线、网格纹理、等宽读数、发丝边框；全部基于主题令牌
   hsl(var(--*))，自适应明暗。从设备页钻取进来视觉连续，无断层。
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

/* 无在线通道：去掉绿调，回落中性 */
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

/* ---- 身份区：返回键 + 雷达 + 设备身份 ---- */
.band-id {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
}

/* 返回键：终端按键观感——发丝边框 + 等宽 + muted 前景，与态势带 band-live/band-tag 同源。
   覆盖默认 antd Button（实底/默认边框），统一进指挥台视觉语言。 */
.back-btn,
.back-btn.ant-btn {
  display: inline-flex;
  flex-shrink: 0;
  gap: 5px;
  align-items: center;
  height: auto;
  padding: 5px 11px;
  font-family: var(--mono);
  font-size: 11.5px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.04em;
  background: hsl(var(--card) / 60%);
  border: 1px solid var(--hair);
  border-radius: var(--radius);
  box-shadow: inset 0 1px 0 hsl(var(--foreground) / 5%);
  transition:
    color 0.16s,
    border-color 0.16s,
    background-color 0.16s,
    transform 0.16s;
}

.back-btn.ant-btn:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border-color: hsl(var(--foreground) / 35%);
  transform: translateX(-1px);
}

.back-btn.ant-btn:active {
  transform: translateX(0);
}

/* 返回键内的箭头图标随文字色，尺寸收敛 */
.back-btn :deep(svg) {
  width: 13px;
  height: 13px;
}

/* 返回键与身份块之间的发丝竖分隔 */
.band-sep {
  flex-shrink: 0;
  width: 1px;
  height: 26px;
  background: linear-gradient(
    hsl(var(--foreground) / 0%),
    hsl(var(--foreground) / 18%),
    hsl(var(--foreground) / 0%)
  );
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

.band-text {
  min-width: 0;
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

.band-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.band-live {
  display: inline-flex;
  flex-shrink: 0;
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
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
}

.band-tag {
  padding: 1px 6px;
  font-family: var(--mono);
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.12em;
  border: 1px solid var(--hair);
  border-radius: 4px;
}

.band-code {
  font-family: var(--mono);
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.06em;
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

/* ============================ 空态 ============================ */
.chan-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
  min-height: 320px;
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

/* 通道编号：等宽读数 */
.fleet-grid :deep(.device-cell-mono .vxe-cell) {
  font-family: var(--mono);
  font-size: 12.5px;
  color: hsl(var(--foreground) / 90%);
  letter-spacing: 0.02em;
}

.fleet-grid :deep(.device-cell-name .vxe-cell) {
  font-weight: 560;
}

/* 行悬停：轻微高亮 */
.fleet-grid :deep(.vxe-body--row) {
  transition: background-color 0.16s;
}

.fleet-grid :deep(.vxe-body--row:hover) {
  background: hsl(var(--accent, var(--muted)) / 55%);
}

/* ============================ Filter Console（检索台） ============================
   重塑 vxe 内置搜索表单为指挥台检索面板：发丝边框卡片 + 左侧标记条 +
   浮签序号标签 + 等宽大写字段名 + 终端式输入框/按键。与设备页同构。
   仅作用于本视图（scoped + .fleet-grid 下），不影响其它列表页。 */
.fleet-grid :deep(.vxe-grid--form-wrapper) {
  position: relative;
  padding: 16px 18px 14px;
  margin-bottom: 12px;
  background: linear-gradient(
    135deg,
    hsl(var(--card)) 0%,
    hsl(var(--background-deep, var(--background))) 130%
  );
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
  box-shadow: inset 0 1px 0 hsl(var(--foreground) / 5%);
}

/* 收紧检索栅格行/列间距——默认 gap 偏大，留白过多 */
.fleet-grid :deep(.vxe-grid--form-wrapper [class*='grid-cols']) {
  gap: 8px 16px;
}

/* 输入控件撑满各自栅格列，消除「输入框太短」 */
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-select),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-input),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  width: 100%;
}

.fleet-grid :deep(.vxe-grid--form-wrapper)::before {
  position: absolute;
  top: 16px;
  bottom: 14px;
  left: 0;
  width: 2px;
  content: '';
  background: linear-gradient(
    hsl(var(--success) / 70%),
    hsl(var(--success) / 0%)
  );
  border-radius: 2px;
}

.fleet-grid :deep(.vxe-grid--form-wrapper)::after {
  position: absolute;
  top: -9px;
  left: 14px;
  padding: 1px 8px;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.18em;
  content: 'FILTER · 检索';
  background: hsl(var(--background-deep, var(--background)));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.fleet-grid :deep(.vxe-grid--form-wrapper label),
.fleet-grid :deep(.vxe-grid--form-wrapper [class*='form-label']) {
  font-family: var(--mono);
  font-size: 10.5px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.fleet-grid :deep(.vxe-grid--form-wrapper .ant-input),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-select-selector),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-picker) {
  font-family: var(--mono);
  font-size: 12.5px;
  background: hsl(var(--card));
  border-color: hsl(var(--border));
  transition:
    border-color 0.18s,
    box-shadow 0.18s;
}

.fleet-grid :deep(.vxe-grid--form-wrapper .ant-input:hover),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper:hover),
.fleet-grid
  :deep(.vxe-grid--form-wrapper .ant-select:hover .ant-select-selector),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-picker:hover) {
  border-color: hsl(var(--foreground) / 35%);
}

.fleet-grid :deep(.vxe-grid--form-wrapper .ant-input:focus),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper-focused),
.fleet-grid
  :deep(.vxe-grid--form-wrapper .ant-select-focused .ant-select-selector),
.fleet-grid :deep(.vxe-grid--form-wrapper .ant-picker-focused) {
  border-color: hsl(var(--success) / 60%);
  box-shadow: 0 0 0 3px hsl(var(--success) / 12%);
}

.fleet-grid :deep(.vxe-grid--form-wrapper .ant-btn) {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.fleet-grid :deep(.vxe-grid--form-wrapper .ant-btn-primary) {
  font-weight: 600;
  box-shadow: 0 8px 22px -12px hsl(var(--primary) / 80%);
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
