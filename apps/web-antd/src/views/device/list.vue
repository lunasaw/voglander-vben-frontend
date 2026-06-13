<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { DeviceApi } from '#/api/device';

import { watch } from 'vue';

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
 * 设备管理列表页（§4.2）。
 *
 * - VxeGrid 条件筛选 + 持久化分页（POST /device/getPage）
 * - SSE 订阅 device.* → 增量刷新当前页行的在线态 / 心跳 / 通道数
 * - 操作列：详情（打开操作面板抽屉）/ 实时点播（复用 /live/start）
 */
const { hasAccessByCodes } = useAccess();

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
          return await getDevicePage(
            { page: page.currentPage, size: page.pageSize },
            body,
          );
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

// SSE 实时刷新：device.* 生命周期 / 心跳 / 目录 → 当前页行增量更新。
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
    <Grid :table-title="$t('device.title')" />
  </Page>
</template>
