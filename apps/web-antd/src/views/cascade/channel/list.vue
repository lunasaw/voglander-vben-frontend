<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { CascadeChannelApi } from '#/api/cascade/channel';

import { onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Link2, Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteCascadeChannel,
  getCascadeChannelPage,
} from '#/api/cascade/channel';
import { getCascadePlatformPage } from '#/api/cascade/platform';
import { $t } from '#/locales';

import { useChannelColumns, useChannelGridFormSchema } from './data';
import BatchBindForm from './modules/batch-bind-form.vue';
import Form from './modules/form.vue';

const { hasAccessByCodes } = useAccess();

// 平台选项列表（用于筛选和表单）
const platformOptions = ref<Array<{ label: string; value: string }>>([]);

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [BatchBindDrawer, batchBindDrawerApi] = useVbenDrawer({
  connectedComponent: BatchBindForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useChannelGridFormSchema(platformOptions.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useChannelColumns(onActionClick),
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
          return await getCascadeChannelPage(queryParams);
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
  } as VxeTableGridOptions<CascadeChannelApi.CascadeChannelVO>,
});

// 加载平台选项
async function loadPlatformOptions() {
  try {
    const result = await getCascadePlatformPage({
      page: 1,
      size: 1000,
      enabled: 1, // 只加载已启用的平台
    });
    platformOptions.value = result.items.map((item) => ({
      label: item.platformId || '',
      value: item.platformId || '',
    }));
  } catch (error) {
    console.error('加载平台选项失败:', error);
  }
}

onMounted(() => {
  loadPlatformOptions();
});

function onActionClick(
  e: OnActionClickParams<CascadeChannelApi.CascadeChannelVO>,
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
  if (!hasAccessByCodes(['Cascade:Channel:Create'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  formDrawerApi.setData({ platformOptions: platformOptions.value }).open();
}

function onBatchBind() {
  if (!hasAccessByCodes(['Cascade:Channel:Create'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  batchBindDrawerApi.setData({ platformOptions: platformOptions.value }).open();
}

function onEdit(row: CascadeChannelApi.CascadeChannelVO) {
  if (!hasAccessByCodes(['Cascade:Channel:Edit'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  formDrawerApi
    .setData({ ...row, platformOptions: platformOptions.value })
    .open();
}

async function onDelete(row: CascadeChannelApi.CascadeChannelVO) {
  if (!hasAccessByCodes(['Cascade:Channel:Delete'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }

  try {
    await confirm(
      $t('cascade.channel.msg.deleteConfirm', [
        row.cascadeName || row.cascadeChannelId,
      ]),
      $t('common.delete'),
    );

    message.loading({
      content: $t('ui.actionMessage.deleting', [
        row.cascadeName || row.cascadeChannelId,
      ]),
      duration: 0,
      key: 'action_process_msg',
    });

    await deleteCascadeChannel(row.id as number);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [
        row.cascadeName || row.cascadeChannelId,
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

function onRefresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <template #header>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">
          {{ $t('cascade.channel.title') }}
        </h1>
      </div>
    </template>

    <FormDrawer @success="onRefresh" />
    <BatchBindDrawer @success="onRefresh" />
    <Grid :table-title="$t('cascade.channel.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('cascade.channel.name')]) }}
        </Button>
        <Button class="ml-2" @click="onBatchBind">
          <Link2 class="size-5" />
          {{ $t('cascade.channel.batchBind.title') }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
