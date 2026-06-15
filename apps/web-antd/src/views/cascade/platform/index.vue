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
import { $t } from '#/locales';

import { usePlatformColumns, usePlatformGridFormSchema } from './data';
import Form from './modules/form.vue';

const { hasAccessByCodes } = useAccess();

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: usePlatformGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: usePlatformColumns(onActionClick),
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
    case 'disable': {
      onDisable(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'enable': {
      onEnable(e.row);
      break;
    }
  }
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
      $t('cascade.platform.msg.deleteConfirm', [
        row.platformName || row.platformId,
      ]),
      $t('common.delete'),
    );

    message.loading({
      content: $t('ui.actionMessage.deleting', [
        row.platformName || row.platformId,
      ]),
      duration: 0,
      key: 'action_process_msg',
    });

    await deleteCascadePlatform(row.id as number);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [
        row.platformName || row.platformId,
      ]),
      key: 'action_process_msg',
    });
    onRefresh();
  } catch (error: any) {
    if (error.message !== '已取消') {
      console.error('删除失败:', error);
    }
  }
}

async function onEnable(row: CascadePlatformApi.CascadePlatformVO) {
  if (!hasAccessByCodes(['Cascade:Platform:Status'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }

  try {
    await confirm(
      $t('cascade.platform.msg.enableConfirm', [
        row.platformName || row.platformId,
      ]),
      $t('cascade.platform.action.enable'),
    );

    await enableCascadePlatform(row.id as number);
    message.success($t('cascade.platform.msg.enableSuccess'));
    onRefresh();
  } catch (error: any) {
    if (error.message !== '已取消') {
      console.error('启用失败:', error);
    }
  }
}

async function onDisable(row: CascadePlatformApi.CascadePlatformVO) {
  if (!hasAccessByCodes(['Cascade:Platform:Status'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }

  try {
    await confirm(
      $t('cascade.platform.msg.disableConfirm', [
        row.platformName || row.platformId,
      ]),
      $t('cascade.platform.action.disable'),
    );

    await disableCascadePlatform(row.id as number);
    message.success($t('cascade.platform.msg.disableSuccess'));
    onRefresh();
  } catch (error: any) {
    if (error.message !== '已取消') {
      console.error('停用失败:', error);
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
