<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { MediaNodeApi } from '#/api/media/medianode';

import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteMediaNode,
  getMediaNodePageList,
  updateMediaNode,
} from '#/api/media/medianode';
import { $t } from '#/locales';

import { isNodeOnline, useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const { hasAccessByCodes } = useAccess();
const router = useRouter();

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
    columns: useColumns(
      onActionClick,
      undefined,
      onEnabledChange,
      onHookEnabledChange,
      onServerIdClick,
    ),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getMediaNodePageList({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
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
  } as VxeTableGridOptions<MediaNodeApi.MediaNodeVO>,
});

function onActionClick(e: OnActionClickParams<MediaNodeApi.MediaNodeVO>) {
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

function onEdit(row: MediaNodeApi.MediaNodeVO) {
  if (!hasAccessByCodes(['Media:Node:Edit'])) {
    message.error('您没有编辑流媒体节点的权限');
    return;
  }
  formDrawerApi.setData(row).open();
}

function onDelete(row: MediaNodeApi.MediaNodeVO) {
  if (!hasAccessByCodes(['Media:Node:Delete'])) {
    message.error('您没有删除流媒体节点的权限');
    return;
  }

  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name || row.serverId]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteMediaNode(row.id as number)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [
          row.name || row.serverId,
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
  if (!hasAccessByCodes(['Media:Node:Create'])) {
    message.error('您没有创建流媒体节点的权限');
    return;
  }
  formDrawerApi.setData({}).open();
}

/**
 * 点击节点服务ID跳转到详情页面
 * @param row 行数据
 */
function onServerIdClick(row: MediaNodeApi.MediaNodeVO) {
  if (!hasAccessByCodes(['Media:Node:List'])) {
    message.error('您没有查看节点详情的权限');
    return;
  }

  // 检查节点是否离线，如果离线则拦截跳转
  if (!isNodeOnline(row.keepalive)) {
    message.warning($t('media.node.offlineNodeCannotAccess'));
    return;
  }

  router.push({
    name: 'MediaNodeDetail',
    params: {
      nodeKey: row.serverId,
    },
    query: {
      nodeName: row.name || row.serverId,
    },
  });
}

/**
 * 启用状态开关即将改变
 * @param newEnabled 期望改变的启用状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onEnabledChange(
  newEnabled: boolean,
  row: MediaNodeApi.MediaNodeVO,
) {
  if (!hasAccessByCodes(['Media:Node:Edit'])) {
    message.error('您没有编辑流媒体节点的权限');
    return false;
  }

  const statusText = newEnabled ? '启用' : '禁用';
  try {
    await confirm(
      `你要将流媒体节点【${row.name || row.serverId}】的启用状态切换为 【${statusText}】 吗？`,
      `切换启用状态`,
    );
    await updateMediaNode({ id: row.id as number, enabled: newEnabled });
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook状态开关即将改变
 * @param newHookEnabled 期望改变的Hook状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onHookEnabledChange(
  newHookEnabled: boolean,
  row: MediaNodeApi.MediaNodeVO,
) {
  if (!hasAccessByCodes(['Media:Node:Edit'])) {
    message.error('您没有编辑流媒体节点的权限');
    return false;
  }

  const statusText = newHookEnabled ? '启用' : '禁用';
  try {
    await confirm(
      `你要将流媒体节点【${row.name || row.serverId}】的Hook状态切换为 【${statusText}】 吗？`,
      `切换Hook状态`,
    );
    await updateMediaNode({
      id: row.id as number,
      hookEnabled: newHookEnabled,
    });
    return true;
  } catch {
    return false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('media.node.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('media.node.name')]) }}
        </Button>
      </template>
      <template #serverId="{ row }">
        <Button type="link" size="small" @click="onServerIdClick(row)">
          {{ row.serverId }}
        </Button>
      </template>
      <template #onlineStatus="{ row }">
        <Tag :color="isNodeOnline(row.keepalive) ? 'success' : 'error'">
          {{
            isNodeOnline(row.keepalive)
              ? $t('media.node.statusOnline')
              : $t('media.node.statusOffline')
          }}
        </Tag>
      </template>
    </Grid>
  </Page>
</template>
