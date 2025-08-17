<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { MediaNodeApi } from '#/api/media/medianode';
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { RotateCw } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  closeZlmMedia,
  getZlmMediaInfo,
  getZlmMediaList,
  getZlmMediaPlayUrls,
} from '#/api/media/zlm-media';
import NodeSelector from '#/components/NodeSelector.vue';
import { $t } from '#/locales';
import { useNodeStore } from '#/store';
import { clearCurrentNodeKey, setCurrentNodeKey } from '#/utils/node-state';

import { useColumns, useSearchFormSchema } from './data';
import DetailModal from './modules/detail-modal.vue';

const { hasAccessByCodes } = useAccess();
const nodeStore = useNodeStore();

// 详情弹窗相关
const detailModalRef = ref<InstanceType<typeof DetailModal>>();
const currentMediaInfo = ref<null | ZlmMediaApi.MediaInfoDetail>(null);
const currentPlayUrls = ref<null | ZlmMediaApi.PlayUrls>(null);

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

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useSearchFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 600,
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (_params, formValues) => {
          try {
            // 如果没有选择节点，不进行查询
            if (!currentNodeKey.value) {
              return {
                items: [],
                total: 0,
              };
            }

            // 构建请求参数，只包含有值的字段
            const requestParams: ZlmMediaApi.MediaReq = {};
            if (formValues.schema) {
              requestParams.schema = formValues.schema;
            }
            if (formValues.vhost) {
              requestParams.vhost = formValues.vhost;
            }
            if (formValues.app) {
              requestParams.app = formValues.app;
            }
            if (formValues.stream) {
              requestParams.stream = formValues.stream;
            }

            // 查询流列表（通过请求拦截器自动添加节点头部）
            const data = await getZlmMediaList(requestParams);

            return {
              items: data || [],
              total: (data || []).length,
            };
          } catch (error) {
            console.error('获取流媒体列表失败:', error);
            message.error('获取流媒体列表失败');
            return {
              items: [],
              total: 0,
            };
          }
        },
      },
      autoLoad: false, // 禁用自动加载，改由节点选择回调触发
    },
    rowConfig: {
      keyField: 'stream', // 使用 stream 作为唯一键
    },
    checkboxConfig: {
      highlight: true,
      range: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
      slots: {
        buttons: 'toolbar-buttons',
      },
    },
  } as VxeTableGridOptions<ZlmMediaApi.MediaData>,
});

function onActionClick(e: OnActionClickParams<ZlmMediaApi.MediaData>) {
  switch (e.code) {
    case 'close': {
      onCloseStream(e.row);
      break;
    }
    case 'view': {
      onViewDetails(e.row);
      break;
    }
  }
}

// 关闭单个流
async function onCloseStream(row: ZlmMediaApi.MediaData) {
  if (!hasAccessByCodes(['Media:Stream:Close'])) {
    message.error('您没有关闭流的权限');
    return;
  }

  const confirmed = await new Promise((resolve) => {
    Modal.confirm({
      title: $t('media.list.actions.confirmClose'),
      content: `确定要关闭流 "${row.app}/${row.stream}" 吗？`,
      okText: $t('media.list.actions.confirm'),
      okType: 'danger',
      cancelText: $t('media.list.actions.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });

  if (!confirmed) return;

  try {
    const params: ZlmMediaApi.MediaReq = {
      schema: row.schema,
      vhost: row.vhost,
      app: row.app,
      stream: row.stream,
    };

    await closeZlmMedia(params);
    message.success('流关闭成功');

    // 重新获取列表
    gridApi.reload();
  } catch (error) {
    console.error('关闭流失败:', error);
    message.error('关闭流失败');
  }
}

// 查看详情
async function onViewDetails(row: ZlmMediaApi.MediaData) {
  try {
    message.loading('正在获取流信息详情...', 0);

    const params: ZlmMediaApi.MediaReq = {
      schema: row.schema,
      vhost: row.vhost,
      app: row.app,
      stream: row.stream,
    };

    // 同时获取流信息和播放地址（通过请求拦截器自动添加节点头部）
    const [mediaInfo, playUrls] = await Promise.all([
      getZlmMediaInfo(params),
      getZlmMediaPlayUrls(params),
    ]);

    message.destroy();

    // 设置数据并显示弹窗
    currentMediaInfo.value = mediaInfo;
    currentPlayUrls.value = playUrls;
    detailModalRef.value?.show();
  } catch (error) {
    message.destroy();
    console.error('获取流信息详情失败:', error);
    message.error('获取流信息详情失败');
  }
}

// 刷新观看人数
async function refreshViewerCount() {
  if (!currentMediaInfo.value) {
    message.warning('没有可刷新的流信息');
    return;
  }

  try {
    const params: ZlmMediaApi.MediaReq = {
      schema: currentMediaInfo.value.schema,
      vhost: currentMediaInfo.value.vhost,
      app: currentMediaInfo.value.app,
      stream: currentMediaInfo.value.stream,
    };

    // 重新获取流信息（通过请求拦截器自动添加节点头部）
    const updatedMediaInfo = await getZlmMediaInfo(params);

    // 更新当前显示的流信息
    currentMediaInfo.value = updatedMediaInfo;
  } catch (error) {
    console.error('刷新观看人数失败:', error);
    throw error; // 让detail-modal处理错误提示
  }
}

// 批量关闭流
async function handleBatchCloseStreams() {
  if (!hasAccessByCodes(['Media:Stream:Close'])) {
    message.error('您没有关闭流的权限');
    return;
  }

  // TODO: 实现批量关闭功能
  message.info('批量关闭功能开发中...');
}

// 导出数据
function handleExport() {
  // TODO: 实现数据导出功能
  message.info('导出功能开发中...');
}
</script>

<template>
  <Page auto-content-height>
    <template #header>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">
          {{ $t('media.list.title') }}
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

    <Grid>
      <template #toolbar-buttons>
        <Button @click="handleExport">
          <RotateCw class="mr-1 size-4" />
          {{ $t('media.list.actions.export') }}
        </Button>
        <Button type="primary" danger @click="handleBatchCloseStreams">
          {{ $t('media.list.actions.batchClose') }}
        </Button>
      </template>
    </Grid>

    <!-- 详情弹窗 -->
    <DetailModal
      ref="detailModalRef"
      :media-info="currentMediaInfo"
      :play-urls="currentPlayUrls"
      :on-refresh="refreshViewerCount"
    />
  </Page>
</template>

<style scoped>
/* 表格样式优化 */
:deep(.vxe-table .vxe-body--row.row--hover) {
  background-color: #f5f5f5;
}

:deep(.vxe-table .vxe-body--row.row--checked) {
  background-color: #e6f7ff;
}

/* 表格固定列阴影 */
:deep(.vxe-table .vxe-fixed--left) {
  box-shadow: 6px 0 6px -4px rgb(0 0 0 / 15%);
}

:deep(.vxe-table .vxe-fixed--right) {
  box-shadow: -6px 0 6px -4px rgb(0 0 0 / 15%);
}
</style>
