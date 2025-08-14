<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { StreamProxyApi } from '#/api/media/stream-proxy';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteStreamProxyBusiness,
  getStreamProxyPageList,
  updateStreamProxyStatus,
} from '#/api/media/stream-proxy';
import { $t } from '#/locales';

import { fetchOnlineNodes, useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const { hasAccessByCodes } = useAccess();

// 初始化时获取节点列表
fetchOnlineNodes().catch((error) => {
  console.error('获取节点列表失败:', error);
});

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getStreamProxyPageList({
            page: page.currentPage,
            size: page.pageSize,
            ...formValues,
          });
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
  } as VxeTableGridOptions<StreamProxyApi.StreamProxyVO>,
});

function onActionClick(e: OnActionClickParams<StreamProxyApi.StreamProxyVO>) {
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

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
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

function onEdit(row: StreamProxyApi.StreamProxyVO) {
  if (!hasAccessByCodes(['Media:StreamProxy:Edit'])) {
    message.error('您没有编辑拉流代理的权限');
    return;
  }
  formDrawerApi.setData(row).open();
}

function onDelete(row: StreamProxyApi.StreamProxyVO) {
  if (!hasAccessByCodes(['Media:StreamProxy:Delete'])) {
    message.error('您没有删除拉流代理的权限');
    return;
  }

  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [`${row.app}/${row.stream}`]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteStreamProxyBusiness({ id: row.id! })
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [
          `${row.app}/${row.stream}`,
        ]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  if (!hasAccessByCodes(['Media:StreamProxy:Create'])) {
    message.error('您没有创建拉流代理的权限');
    return;
  }
  formDrawerApi.setData({}).open();
}

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(
  newStatus: number,
  row: StreamProxyApi.StreamProxyVO,
) {
  if (!hasAccessByCodes(['Media:StreamProxy:Edit'])) {
    message.error('您没有编辑拉流代理的权限');
    return false;
  }

  const statusText = newStatus === 1 ? '启用' : '禁用';
  try {
    await confirm(
      `你要将拉流代理【${row.app}/${row.stream}】的状态切换为 【${statusText}】 吗？`,
      `切换状态`,
    );
    await updateStreamProxyStatus(row.id!, newStatus);
    return true;
  } catch {
    return false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('media.streamProxy.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('media.streamProxy.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
