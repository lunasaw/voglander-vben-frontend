<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { MediaNodeApi } from '#/api/media/medianode';
import type { StreamProxyApi } from '#/api/media/stream-proxy';

import { ref } from 'vue';

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
import NodeSelector from '#/components/NodeSelector.vue';
import StreamDetailModal from '#/components/StreamDetailModal.vue';
import { $t } from '#/locales';
import { useNodeStore } from '#/store';
import { clearCurrentNodeKey, setCurrentNodeKey } from '#/utils/node-state';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const { hasAccessByCodes } = useAccess();
const nodeStore = useNodeStore();

// 节点选择状态
const currentNodeKey = ref<null | string>(null);
const nodeSelectorRef = ref<InstanceType<typeof NodeSelector>>();

// 节点列表加载完成处理
function onNodeListLoaded(_nodes: MediaNodeApi.MediaNodeVO[]) {
  // 如果当前有选择的节点，确保全局状态也是同步的
  if (currentNodeKey.value) {
    nodeStore.setCurrentNodeKey(currentNodeKey.value);
    setCurrentNodeKey(currentNodeKey.value); // 同时更新全局状态
  }
}

// 节点切换处理
async function onNodeSwitch(
  selectedNodeKey: null | number | string,
  selectedNode?: MediaNodeApi.MediaNodeVO,
) {
  if (!selectedNodeKey) {
    currentNodeKey.value = null;
    nodeStore.clearCurrentNodeKey();
    clearCurrentNodeKey(); // 清除全局状态
    // 清空表格数据
    gridApi.clearData();
    return;
  }

  const nodeKeyStr = String(selectedNodeKey);
  const previousNodeKey = currentNodeKey.value; // 保存之前的节点，用于判断是否是切换

  // 检查权限
  if (!hasAccessByCodes(['Media:StreamProxy:List'])) {
    message.error('您没有查看拉流代理列表的权限');
    return;
  }

  if (!selectedNode) {
    message.error('节点不存在');
    return;
  }

  // 获取节点显示名称
  const nodeDisplayName =
    selectedNode.name || selectedNode.serverId || selectedNode.id || '未知节点';

  try {
    // 如果是切换到新节点（不是初始选择），显示切换提示
    if (previousNodeKey && nodeKeyStr !== previousNodeKey) {
      // 显示切换提示，如果节点离线则在提示中包含状态信息
      const keepaliveTime = new Date(Number(selectedNode.keepalive));
      const now = new Date();
      const diffMinutes =
        (now.getTime() - keepaliveTime.getTime()) / (1000 * 60);
      const isOnline = diffMinutes < 5;

      const statusHint = isOnline ? '' : ' (离线状态)';
      message.loading({
        content: `正在切换到节点: ${nodeDisplayName}${statusHint}...`,
        duration: 2,
        key: 'node_switch_msg',
      });
    }

    // 更新当前节点（同时更新本地状态、Pinia状态和全局状态）
    currentNodeKey.value = nodeKeyStr;
    nodeStore.setCurrentNodeKey(nodeKeyStr);
    setCurrentNodeKey(nodeKeyStr); // 更新全局状态，确保请求拦截器能获取到

    // 触发表格数据加载
    await gridApi.query();

    // 如果是节点切换（不是初始选择），显示成功提示
    if (previousNodeKey && nodeKeyStr !== previousNodeKey) {
      message.success({
        content: `已切换到节点: ${nodeDisplayName}`,
        key: 'node_switch_msg',
      });
    }
  } catch (error) {
    console.error('节点切换失败:', error);
    message.error({
      content: '节点切换失败',
      key: 'node_switch_msg',
    });
  }
}

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 流详情弹窗状态
const showStreamDetailModal = ref(false);
const streamParams = ref<null | {
  app: string;
  stream: string;
  vhost: string;
}>(null);

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
          // 如果没有选择节点，不进行查询
          if (!currentNodeKey.value) {
            return { records: [], total: 0 };
          }

          // 构建查询参数，包含当前选择的节点ID
          const queryParams: any = {
            page: page.currentPage,
            size: page.pageSize,
            ...formValues,
            serverId: currentNodeKey.value,
          };

          return await getStreamProxyPageList(queryParams);
        },
      },
      autoLoad: false, // 禁用自动加载，改由节点选择回调触发
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
    case 'detail': {
      onDetail(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'play': {
      onPlay(e.row);
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

  if (!currentNodeKey.value) {
    message.warning('请先选择一个流媒体节点');
    return;
  }

  formDrawerApi.setData({}).open();
}

function onDetail(row: StreamProxyApi.StreamProxyVO) {
  if (!hasAccessByCodes(['Media:StreamProxy:View'])) {
    message.error('您没有查看拉流代理详情的权限');
    return;
  }

  // 设置流参数
  streamParams.value = {
    app: row.app,
    stream: row.stream,
    vhost: row.extendObj?.vhost || '__defaultVhost__',
  };
  showStreamDetailModal.value = true;
}

async function onPlay(row: StreamProxyApi.StreamProxyVO) {
  if (!hasAccessByCodes(['Media:StreamProxy:Play'])) {
    message.error('您没有播放视频流的权限');
    return;
  }

  // 检查流是否在线
  if (row.onlineStatus !== 1) {
    message.warning('该流当前处于离线状态，无法播放');
    return;
  }

  // 设置流参数，仅显示播放器（不显示详情）
  streamParams.value = {
    app: row.app,
    stream: row.stream,
    vhost: row.extendObj?.vhost || '__defaultVhost__',
  };
  showStreamDetailModal.value = true;
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
    <template #header>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">
          {{ $t('media.streamProxy.list') }}
        </h1>
      </div>
    </template>

    <!-- 节点选择区域 -->
    <NodeSelector
      ref="nodeSelectorRef"
      v-model="currentNodeKey"
      :title="$t('media.node.selector.title')"
      :placeholder="$t('media.node.selector.placeholder')"
      @node-switch="onNodeSwitch"
      @node-list-loaded="onNodeListLoaded"
      style="min-width: 300px"
    />

    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('media.streamProxy.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate" :disabled="!currentNodeKey">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('media.streamProxy.name')]) }}
        </Button>
      </template>
    </Grid>

    <!-- 流详情弹窗 -->
    <StreamDetailModal
      :open="showStreamDetailModal"
      @update:open="showStreamDetailModal = $event"
      :stream-params="streamParams"
      :node-key="currentNodeKey"
      :show-details="true"
    />
  </Page>
</template>
