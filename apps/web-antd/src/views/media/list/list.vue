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
import { getEnabledMediaNodeList } from '#/api/media/medianode';
import {
  closeZlmMedia,
  getZlmMediaInfo,
  getZlmMediaList,
  getZlmMediaPlayUrls,
  getZlmNodeMediaList,
} from '#/api/media/zlm-media';
import { $t } from '#/locales';

import { useColumns, useSearchFormSchema } from './data';
import DetailModal from './modules/detail-modal.vue';

const { hasAccessByCodes } = useAccess();

// 详情弹窗相关
const detailModalRef = ref<InstanceType<typeof DetailModal>>();
const currentMediaInfo = ref<null | ZlmMediaApi.MediaInfoDetail>(null);
const currentPlayUrls = ref<null | ZlmMediaApi.PlayUrls>(null);

// 节点选择状态
const nodeListData = ref<MediaNodeApi.MediaNodeVO[]>([]);
const currentNodeKey = ref<string>('');

// 获取启用的节点列表Ï
async function fetchNodeList() {
  try {
    const response = await getEnabledMediaNodeList();

    let nodeList: MediaNodeApi.MediaNodeVO[] = [];
    if (Array.isArray(response)) {
      nodeList = response;
    } else if (response && typeof response === 'object') {
      nodeList =
        'items' in response && Array.isArray((response as any).items)
          ? (response as any).items
          : [response as unknown as MediaNodeApi.MediaNodeVO];
    }

    nodeListData.value = nodeList;
  } catch (error) {
    console.error('获取节点列表失败:', error);
    message.error($t('media.node.query.loadNodeListFailed'));
  }
}

// 初始化时获取节点列表
fetchNodeList();

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
            const requestParams: ZlmMediaApi.MediaReq = {
              schema: formValues.schema || 'rtsp',
              vhost: formValues.vhost || '__defaultVhost__',
              app: formValues.app || undefined,
              stream: formValues.stream || undefined,
            };

            // 过滤掉空值
            Object.keys(requestParams).forEach((key) => {
              if (!requestParams[key as keyof ZlmMediaApi.MediaReq]) {
                delete requestParams[key as keyof ZlmMediaApi.MediaReq];
              }
            });

            let data: ZlmMediaApi.MediaData[];

            if (currentNodeKey.value) {
              // 查询指定节点的流列表
              data = await getZlmNodeMediaList(
                currentNodeKey.value,
                requestParams,
              );
            } else {
              // 查询所有节点的流列表
              data = await getZlmMediaList(requestParams);
            }

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

    await closeZlmMedia(params, currentNodeKey.value);
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

    // 同时获取流信息和播放地址
    const [mediaInfo, playUrls] = await Promise.all([
      getZlmMediaInfo(params, currentNodeKey.value),
      getZlmMediaPlayUrls(params, currentNodeKey.value),
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
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold">
            {{ $t('media.list.title') }}
          </h1>
        </div>
      </div>
    </template>

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
  box-shadow: 6px 0 6px -4px rgba(0, 0, 0, 0.15);
}

:deep(.vxe-table .vxe-fixed--right) {
  box-shadow: -6px 0 6px -4px rgba(0, 0, 0, 0.15);
}
</style>
