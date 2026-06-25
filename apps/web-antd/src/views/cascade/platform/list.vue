<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { CascadePlatformApi } from '#/api/cascade/platform';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus, RotateCw } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteCascadePlatform,
  disableCascadePlatform,
  enableCascadePlatform,
  getCascadePlatformPage,
  refreshCascadeScheduler,
} from '#/api/cascade/platform';
import { useCascadeStatusRefresh } from '#/composables/useCascadeStatusRefresh';
import { $t } from '#/locales';

import { usePlatformColumns, usePlatformGridFormSchema } from './data';
import Form from './modules/form.vue';
import SubscribeDrawer from './modules/subscribe-drawer.vue';

const { hasAccessByCodes } = useAccess();

// 跟踪正在等待注册结果的平台（启用后等 SSE 回调）
const awaitingRegister = new Set<string>();

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [SubscribeDrawerComp, subscribeDrawerApi] = useVbenDrawer({
  connectedComponent: SubscribeDrawer,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: usePlatformGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: usePlatformColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const queryParams: any = {
            page: page.currentPage,
            size: page.pageSize,
            ...formValues,
          };
          return await getCascadePlatformPage(queryParams);
        },
      },
      autoLoad: true,
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
  } as VxeTableGridOptions<CascadePlatformApi.CascadePlatformVO>,
});

function onActionClick(
  e: OnActionClickParams<CascadePlatformApi.CascadePlatformVO>,
) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'subscribe': {
      onViewSubscribe(e.row);
      break;
    }
  }
}

/** CellSwitch beforeChange 回调：启用→发注册请求+等待SSE；停用→直接调 API */
async function onStatusChange(
  newStatus: number,
  row: CascadePlatformApi.CascadePlatformVO,
): Promise<boolean> {
  if (!hasAccessByCodes(['Cascade:Platform:Status'])) {
    message.error($t('device.msg.noPermission'));
    return false;
  }
  try {
    if (newStatus === 1) {
      await enableCascadePlatform(row.id as number);
      row.registerStatus = 2;
      awaitingRegister.add(row.platformId as string);
      message.loading({
        content: $t('cascade.platform.msg.registering', [row.platformId]),
        duration: 0,
        key: `reg_${row.platformId}`,
      });
    } else {
      await disableCascadePlatform(row.id as number);
      row.registerStatus = 0;
      message.success($t('cascade.platform.msg.disableSuccess'));
    }
    return true;
  } catch {
    return false;
  }
}

function onViewSubscribe(row: CascadePlatformApi.CascadePlatformVO) {
  subscribeDrawerApi.setData({ platformId: row.platformId }).open();
}

function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

function onCreate() {
  if (!hasAccessByCodes(['Cascade:Platform:Create'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  formDrawerApi.setData({}).open();
}

function onEdit(row: CascadePlatformApi.CascadePlatformVO) {
  if (!hasAccessByCodes(['Cascade:Platform:Edit'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  formDrawerApi.setData(row).open();
}

async function onDelete(row: CascadePlatformApi.CascadePlatformVO) {
  if (!hasAccessByCodes(['Cascade:Platform:Delete'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }

  try {
    await confirm(
      $t('cascade.platform.msg.deleteConfirm', [row.platformId]),
      $t('common.delete'),
    );

    message.loading({
      content: $t('ui.actionMessage.deleting', [row.platformId]),
      duration: 0,
      key: 'action_process_msg',
    });

    await deleteCascadePlatform(row.id as number);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.platformId]),
      key: 'action_process_msg',
    });
    onRefresh();
  } catch (error: any) {
    if (error.message !== '已取消') {
      console.error('删除失败:', error);
    }
  }
}

async function onRefreshScheduler() {
  try {
    await confirm(
      $t('cascade.platform.msg.refreshConfirm'),
      $t('cascade.platform.refreshScheduler'),
    );

    message.loading({
      content: $t('cascade.platform.refreshScheduler'),
      duration: 0,
      key: 'refresh_scheduler_msg',
    });

    await refreshCascadeScheduler();
    message.success({
      content: $t('cascade.platform.msg.refreshSuccess'),
      key: 'refresh_scheduler_msg',
    });
    onRefresh();
  } catch (error: any) {
    if (error.message !== '已取消') {
      console.error('刷新调度失败:', error);
    }
  }
}

function onRefresh() {
  gridApi.query();
}

// 注册状态实时刷新：SSE(cascade.register) 更新对应行 + 可见时 15s 轮询兜底
useCascadeStatusRefresh((platformId, registerStatus) => {
  const rows =
    gridApi.grid?.getData?.() as CascadePlatformApi.CascadePlatformVO[];
  const row = rows?.find((r) => r.platformId === platformId);
  if (row) {
    row.registerStatus = registerStatus;
  }

  // 用户主动启用后等待注册结果，SSE 到达时给出提示
  if (awaitingRegister.has(platformId)) {
    if (registerStatus === 1) {
      awaitingRegister.delete(platformId);
      message.success({
        content: $t('cascade.platform.msg.registerSuccess', [platformId]),
        key: `reg_${platformId}`,
      });
    } else if (registerStatus === 3) {
      awaitingRegister.delete(platformId);
      message.error({
        content: $t('cascade.platform.msg.registerFailed', [platformId]),
        key: `reg_${platformId}`,
      });
    }
    // registerStatus === 2 仍在注册中，保持 loading 继续等待
  }
}, onRefresh);
</script>

<template>
  <Page auto-content-height>
    <template #header>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">
          {{ $t('cascade.platform.title') }}
        </h1>
      </div>
    </template>

    <FormDrawer @success="onRefresh" />
    <SubscribeDrawerComp />
    <Grid :table-title="$t('cascade.platform.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('cascade.platform.name')]) }}
        </Button>
        <Button @click="onRefreshScheduler">
          <RotateCw class="size-5" />
          {{ $t('cascade.platform.refreshScheduler') }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
