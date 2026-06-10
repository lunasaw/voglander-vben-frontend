<script lang="ts" setup>
import type { MediaNodeApi } from '#/api/media/medianode';
import type { ZlmQueryApi } from '#/api/media/zlm-query';

import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import {
  ArrowLeft,
  CarbonPower,
  RotateCw,
  Search,
  SearchX,
  X,
} from '@vben/icons';

import {
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  message,
  Modal,
  Row,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getZlmApiList,
  getZlmServerConfig,
  getZlmStatistic,
  getZlmThreadsLoad,
  getZlmVersion,
  getZlmWorkThreadsLoad,
  restartZlmServer,
  setZlmServerConfig,
} from '#/api/media/zlm-query';
import NodeSelector from '#/components/NodeSelector.vue';
import { $t } from '#/locales';
import { useNodeStore } from '#/store';
import { setCurrentNodeKey } from '#/utils/node-state';

import { isNodeOnline } from './data';

const { hasAccessByCodes } = useAccess();
const route = useRoute();
const router = useRouter();
const nodeStore = useNodeStore();

// 获取节点Key参数
const nodeKey = computed(() => route.params.nodeKey as string);
const nodeName = computed(
  () => (route.query.nodeName as string) || nodeKey.value,
);

// 加载状态
const loading = ref(false);
const versionLoading = ref(false);
const apiListLoading = ref(false);
const threadsLoadLoading = ref(false);
const workThreadsLoadLoading = ref(false);
const statisticLoading = ref(false);
const serverConfigLoading = ref(false);
const restartLoading = ref(false);

// 节点选择器引用
const nodeSelectorRef = ref<InstanceType<typeof NodeSelector>>();

// 数据状态
const versionData = ref<null | ZlmQueryApi.Version>(null);
const apiListData = ref<string[]>([]);
const threadsLoadData = ref<ZlmQueryApi.ThreadLoad[]>([]);
const workThreadsLoadData = ref<ZlmQueryApi.ThreadLoad[]>([]);
const statisticData = ref<null | ZlmQueryApi.ImportantObjectNum>(null);
const serverConfigData = ref<ZlmQueryApi.ServerNodeConfig>([]);

// 配置项编辑状态
const editingConfig = ref<null | string>(null);
const editingValue = ref<string>('');
const savingConfig = ref<null | string>(null);

// 配置项搜索状态
const configSearchText = ref<string>('');

// 检查权限
if (!hasAccessByCodes(['Media:Node:List'])) {
  message.error('您没有查看节点详情的权限');
  router.push('/media/node');
}

// 获取版本信息
async function fetchVersion() {
  versionLoading.value = true;
  try {
    const data = await getZlmVersion(nodeKey.value);
    versionData.value = data;
  } catch (error) {
    console.error('获取版本信息失败:', error);
    message.error('获取版本信息失败');
  } finally {
    versionLoading.value = false;
  }
}

// 获取API列表
async function fetchApiList() {
  apiListLoading.value = true;
  try {
    const data = await getZlmApiList(nodeKey.value);
    apiListData.value = data;
  } catch (error) {
    console.error('获取API列表失败:', error);
    message.error('获取API列表失败');
  } finally {
    apiListLoading.value = false;
  }
}

// 获取网络线程负载
async function fetchThreadsLoad() {
  threadsLoadLoading.value = true;
  try {
    const data = await getZlmThreadsLoad(nodeKey.value);
    threadsLoadData.value = data;
  } catch (error) {
    console.error('获取网络线程负载失败:', error);
    message.error('获取网络线程负载失败');
  } finally {
    threadsLoadLoading.value = false;
  }
}

// 获取后台线程负载
async function fetchWorkThreadsLoad() {
  workThreadsLoadLoading.value = true;
  try {
    const data = await getZlmWorkThreadsLoad(nodeKey.value);
    workThreadsLoadData.value = data;
  } catch (error) {
    console.error('获取后台线程负载失败:', error);
    message.error('获取后台线程负载失败');
  } finally {
    workThreadsLoadLoading.value = false;
  }
}

// 获取对象统计
async function fetchStatistic() {
  statisticLoading.value = true;
  try {
    const data = await getZlmStatistic(nodeKey.value);
    statisticData.value = data;
  } catch (error) {
    console.error('获取对象统计失败:', error);
    message.error('获取对象统计失败');
  } finally {
    statisticLoading.value = false;
  }
}

// 获取服务器配置
async function fetchServerConfig() {
  serverConfigLoading.value = true;
  try {
    const data = await getZlmServerConfig(nodeKey.value);
    serverConfigData.value = data;
  } catch (error) {
    console.error('获取服务器配置失败:', error);
    message.error('获取服务器配置失败');
  } finally {
    serverConfigLoading.value = false;
  }
}

// 节点列表加载完成的处理
function onNodeListLoaded(_nodes: MediaNodeApi.MediaNodeVO[]) {
  // 确保当前节点Key也设置到全局状态
  if (nodeKey.value) {
    nodeStore.setCurrentNodeKey(nodeKey.value);
  }
}

// 开始编辑单个配置项
function startEditConfigItem(key: string, value: string) {
  if (!hasAccessByCodes(['Media:Node:Edit'])) {
    message.error('您没有编辑节点配置的权限');
    return;
  }
  editingConfig.value = key;
  editingValue.value =
    value === null || value === undefined ? '' : String(value);
}

// 取消编辑配置项
function cancelEditConfigItem() {
  editingConfig.value = null;
  editingValue.value = '';
}

// 保存单个配置项
async function saveConfigItem(key: string) {
  if (!editingConfig.value) return;

  savingConfig.value = key;
  try {
    // 只提交当前编辑的配置项
    const configData = {
      [key]: editingValue.value,
    };

    await setZlmServerConfig(configData, nodeKey.value);
    message.success($t('media.node.query.configSaved'));

    // 取消编辑状态
    cancelEditConfigItem();

    // 重新获取配置以确保数据同步
    await fetchServerConfig();
  } catch (error) {
    console.error('保存配置项失败:', error);
    message.error($t('media.node.query.saveFailed'));
  } finally {
    savingConfig.value = null;
  }
}

// 处理配置卡片点击事件，用于取消编辑
function handleConfigCardClick(event: Event) {
  // 如果当前没有在编辑，直接返回
  if (!editingConfig.value) return;

  // 检查点击的元素是否是输入框或按钮
  const target = event.target as HTMLElement;
  const isInputArea =
    target.closest('.ant-input') ||
    target.closest('.ant-btn') ||
    target.closest('.flex.items-center.gap-2');

  // 如果点击的不是编辑区域，则取消编辑
  if (!isInputArea) {
    cancelEditConfigItem();
  }
}

// 刷新所有数据
async function refreshAllData() {
  loading.value = true;
  try {
    const results = await Promise.allSettled([
      fetchVersion(),
      fetchApiList(),
      fetchThreadsLoad(),
      fetchWorkThreadsLoad(),
      fetchStatistic(),
      fetchServerConfig(),
    ]);

    // 同时刷新节点列表
    if (nodeSelectorRef.value) {
      await nodeSelectorRef.value.refresh();
    }

    // 统计成功和失败的数量
    const successful = results.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    const failed = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    if (failed === 0) {
      message.success('数据刷新成功');
    } else if (successful > 0) {
      message.warning(
        `数据部分刷新成功（${successful}/${results.length}），部分接口可能无响应`,
      );
    } else {
      message.error('数据刷新失败，请检查节点状态');
    }

    // 记录失败的请求
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const apiNames = [
          '版本信息',
          'API列表',
          '网络线程负载',
          '后台线程负载',
          '对象统计',
          '服务器配置',
        ];
        console.error(`${apiNames[index]}获取失败:`, result.reason);
      }
    });
  } catch (error) {
    console.error('刷新数据时发生意外错误:', error);
    message.error('刷新数据时发生意外错误');
  } finally {
    loading.value = false;
  }
}

// 返回列表
function goBack() {
  router.push('/media/node');
}

// 重启服务器
async function restartServer() {
  if (!hasAccessByCodes(['Media:Node:Edit'])) {
    message.error('您没有重启节点的权限');
    return;
  }

  // 确认对话框
  const confirmed = await new Promise((resolve) => {
    Modal.confirm({
      title: '确认重启服务器',
      content: `确定要重启节点 "${nodeName.value}" 的服务器吗？重启后可能会导致正在进行的流媒体服务中断。`,
      okText: '确认重启',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });

  if (!confirmed) {
    return;
  }

  restartLoading.value = true;
  try {
    await restartZlmServer(nodeKey.value);
    message.success('服务器重启请求已发送，正在等待服务器响应...');

    // 保持加载状态10秒，然后自动刷新数据
    setTimeout(() => {
      refreshAllData();
      restartLoading.value = false;
    }, 10_000);
  } catch (error) {
    console.error('重启服务器失败:', error);
    message.error('重启服务器失败');
    restartLoading.value = false;
  }
}

// 节点切换处理
async function onNodeSwitch(
  selectedNodeKey: null | number | string,
  selectedNode?: MediaNodeApi.MediaNodeVO,
) {
  if (!selectedNodeKey) {
    nodeStore.clearCurrentNodeKey();
    return;
  }

  const nodeKeyStr = String(selectedNodeKey);
  if (nodeKeyStr === nodeKey.value) {
    return; // 如果选择的是当前节点，不执行任何操作
  }

  // 检查权限
  if (!hasAccessByCodes(['Media:Node:List'])) {
    message.error('您没有查看节点详情的权限');
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
    // 显示切换提示，如果节点离线则在提示中包含状态信息
    const statusHint = isNodeOnline(selectedNode.keepalive)
      ? ''
      : ' (离线状态)';
    message.loading({
      content: `正在切换到节点: ${nodeDisplayName}${statusHint}...`,
      duration: 2,
      key: 'node_switch_msg',
    });

    // 更新全局节点状态
    nodeStore.setCurrentNodeKey(nodeKeyStr);

    // 更新路由参数
    await router.push({
      name: 'MediaNodeDetail',
      params: {
        nodeKey: nodeKeyStr,
      },
      query: {
        nodeName: nodeDisplayName,
      },
    });

    // 路由变更后会自动触发数据刷新（通过watch监听nodeKey变化）
  } catch (error) {
    console.error('节点切换失败:', error);
    message.error({
      content: '节点切换失败',
      key: 'node_switch_msg',
    });
  }
}

// 搜索框引用
const searchInputRef = ref();

// 键盘快捷键处理
function handleKeyDown(event: KeyboardEvent) {
  // Ctrl+F 或 Cmd+F 聚焦搜索框
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault();
    searchInputRef.value?.focus();
  }

  // ESC 清除搜索
  if (event.key === 'Escape' && configSearchText.value.trim()) {
    configSearchText.value = '';
  }
}

// 线程负载表格列定义
const threadsLoadColumns = [
  {
    title: $t('media.node.query.threadId'),
    dataIndex: 'index',
    key: 'index',
    width: 120,
    customRender: ({ index }: { index: number }) => `Thread-${index + 1}`,
  },
  {
    title: `${$t('media.node.query.delay')} (ms)`,
    dataIndex: 'delay',
    key: 'delay',
    width: 150,
  },
  {
    title: `${$t('media.node.query.load')} (%)`,
    dataIndex: 'load',
    key: 'load',
    width: 150,
    customRender: ({ text }: { text: string }) => {
      const loadValue = Number.parseFloat(text);
      let color = 'green';
      if (loadValue > 80) color = 'red';
      else if (loadValue > 60) color = 'orange';
      else if (loadValue > 40) color = 'blue';

      return h(Tag, { color }, () => `${text}%`);
    },
  },
];

// API列表表格列定义
const apiListColumns = [
  {
    title: $t('media.node.query.apiList'),
    dataIndex: 'api',
    key: 'api',
  },
];

// 对象统计表格列定义
const statisticColumns = [
  {
    title: $t('media.node.query.objectType'),
    dataIndex: 'type',
    key: 'type',
    width: 200,
  },
  {
    title: $t('media.node.query.objectCount'),
    dataIndex: 'count',
    key: 'count',
    width: 150,
  },
];

// 高亮搜索文本的函数
function highlightSearchText(text: string, searchText: string) {
  if (!searchText.trim() || !text) return text;

  const regex = new RegExp(
    `(${searchText.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)})`,
    'gi',
  );
  return text.replace(
    regex,
    '<mark class="bg-yellow-200 px-1 rounded">$1</mark>',
  );
}

// 服务器配置表格列定义
const serverConfigColumns = [
  {
    title: $t('media.node.query.configKey'),
    dataIndex: 'key',
    key: 'key',
    width: 300,
    customRender: ({ text }: { text: string }) => {
      const searchText = configSearchText.value.trim();
      if (searchText) {
        return h('span', {
          innerHTML: highlightSearchText(text, searchText),
        });
      }
      return text;
    },
  },
  {
    title: $t('media.node.query.configValue'),
    dataIndex: 'value',
    key: 'value',
    customRender: ({ text, record }: { record: any; text: string }) => {
      const isEditing = editingConfig.value === record.key;
      const isSaving = savingConfig.value === record.key;

      if (isEditing) {
        return h('div', { class: 'flex items-center gap-2' }, [
          h(Input, {
            value: editingValue.value,
            'onUpdate:value': (val: string) => {
              editingValue.value = val;
            },
            placeholder: `请输入 ${record.key}`,
            disabled: isSaving,
            onPressEnter: () => saveConfigItem(record.key),
          }),
          h(
            Button,
            {
              type: 'primary',
              size: 'small',
              loading: isSaving,
              onClick: () => saveConfigItem(record.key),
            },
            () => $t('media.node.query.saveConfig'),
          ),
          h(
            Button,
            {
              size: 'small',
              disabled: isSaving,
              onClick: cancelEditConfigItem,
            },
            () => $t('media.node.query.cancel'),
          ),
        ]);
      }

      const displayText = text === null || text === undefined ? '-' : text;
      const searchText = configSearchText.value.trim();

      return h('div', {
        class: 'cursor-pointer hover:bg-gray-100 p-1 rounded',
        onDblclick: () => startEditConfigItem(record.key, text),
        title: $t('media.node.query.doubleClickToEdit'),
        innerHTML: searchText
          ? highlightSearchText(displayText, searchText)
          : displayText,
      });
    },
  },
];

// 转换对象统计数据为表格数据
const statisticTableData = computed(() => {
  if (!statisticData.value) return [];
  return Object.entries(statisticData.value).map(([type, count]) => ({
    type,
    count,
  }));
});

// 转换API列表数据为表格数据
const apiListTableData = computed(() => {
  return apiListData.value.map((api, index) => ({
    key: index,
    api,
  }));
});

// 配置分组顺序（按照原始配置文件的顺序）
const configGroupOrder = [
  'api',
  'cluster',
  'ffmpeg',
  'general',
  'hls',
  'hook',
  'http',
  'multicast',
  'protocol',
  'record',
  'rtc',
  'rtmp',
  'rtp',
  'rtp_proxy',
  'rtsp',
  'shell',
  'srt',
];

// 根据配置分组获取排序权重
function getConfigGroupWeight(configKey: string): number {
  const prefix = configKey.split('.')[0] || '';
  const index = configGroupOrder.indexOf(prefix);
  return index === -1 ? 999 : index; // 未知分组排到最后
}

// 转换服务器配置数据为表格数据
const serverConfigTableData = computed(() => {
  if (!serverConfigData.value || serverConfigData.value.length === 0) return [];

  // 如果是数组格式，需要将数组中的对象合并为一个对象，然后转换为表格数据
  let configObj = {};
  for (const item of serverConfigData.value) {
    configObj = { ...configObj, ...item };
  }

  // 转换为表格数据并按照配置分组顺序排序
  let filteredData = Object.entries(configObj)
    .map(([key, value]) => ({
      key,
      value: value === null ? '-' : String(value),
    }))
    .sort((a, b) => {
      const weightA = getConfigGroupWeight(a.key);
      const weightB = getConfigGroupWeight(b.key);

      // 首先按分组排序
      if (weightA !== weightB) {
        return weightA - weightB;
      }

      // 同一分组内按key字母顺序排序
      return a.key.localeCompare(b.key);
    });

  // 如果有搜索条件，进行过滤
  if (configSearchText.value.trim()) {
    const searchText = configSearchText.value.toLowerCase().trim();
    filteredData = filteredData.filter(
      (item) =>
        item.key.toLowerCase().includes(searchText) ||
        String(item.value).toLowerCase().includes(searchText),
    );
  }

  return filteredData;
});

// 配置项统计信息
const configStats = computed(() => {
  const total = serverConfigTableData.value.length;
  const totalOriginal =
    serverConfigData.value?.reduce((acc, item) => {
      return acc + Object.keys(item).length;
    }, 0) || 0;

  return {
    total,
    totalOriginal,
    isFiltered: configSearchText.value.trim() !== '',
  };
});

// 监听节点Key变化，自动刷新数据
watch(nodeKey, async (newNodeKey, oldNodeKey) => {
  if (newNodeKey && newNodeKey !== oldNodeKey) {
    try {
      // 同步新 nodeKey 到全局模块镜像，保证后续 /zlm/api 请求头携带正确的 X-Node-Key
      setCurrentNodeKey(newNodeKey);
      nodeStore.setCurrentNodeKey(newNodeKey);

      // 清理旧数据
      versionData.value = null;
      apiListData.value = [];
      threadsLoadData.value = [];
      workThreadsLoadData.value = [];
      statisticData.value = null;
      serverConfigData.value = [];

      // 取消任何编辑状态
      cancelEditConfigItem();

      // 刷新所有数据
      await refreshAllData();
    } catch (error) {
      console.error('节点切换时刷新数据失败:', error);
      message.error('节点切换时刷新数据失败，请手动刷新');
    }
  }
});

// 组件挂载时加载数据
onMounted(async () => {
  // 同步路由参数中的 nodeKey 到全局模块镜像（请求拦截器据此注入 X-Node-Key）
  // 必须在首次 refreshAllData() 之前执行，否则 /zlm/api 请求会因缺少 node key 而失败
  if (nodeKey.value) {
    setCurrentNodeKey(nodeKey.value);
    nodeStore.setCurrentNodeKey(nodeKey.value);
  }

  await refreshAllData();

  // 添加键盘快捷键监听
  window.addEventListener('keydown', handleKeyDown);
});

// 组件卸载时移除事件监听
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Page auto-content-height>
    <template #header>
      <div class="flex items-center gap-3">
        <Button @click="goBack">
          <ArrowLeft class="size-4" />
          {{ $t('media.node.query.backToList') }}
        </Button>
        <h1 class="text-2xl font-bold">
          {{ $t('media.node.detail') }} - {{ nodeName }}
        </h1>
      </div>
    </template>

    <div class="space-y-6">
      <!-- 节点管理 -->
      <Card class="sticky-node-management">
        <template #title>
          <div class="flex items-center justify-between gap-4">
            <span class="text-lg font-semibold">{{
              $t('media.node.query.nodeManagement')
            }}</span>
            <div class="flex items-center gap-3">
              <!-- 节点切换选择器 -->
              <div class="flex flex-1 items-center gap-2">
                <span class="shrink-0 text-sm font-medium text-gray-700">
                  {{ $t('media.node.query.selectNode') }}:
                </span>
                <NodeSelector
                  ref="nodeSelectorRef"
                  :model-value="nodeKey"
                  :show-container="false"
                  :placeholder="$t('media.node.query.selectNode')"
                  @node-switch="onNodeSwitch"
                  @node-list-loaded="onNodeListLoaded"
                  style="min-width: 300px"
                />
              </div>
              <!-- 刷新所有数据按钮 -->
              <Button
                type="primary"
                :loading="loading"
                @click="refreshAllData"
                :title="$t('media.node.query.refreshData')"
              >
                <RotateCw class="mr-1 size-4" />
                {{ $t('media.node.query.refreshData') }}
              </Button>
              <!-- 重启服务器按钮 -->
              <Button
                type="primary"
                danger
                :loading="restartLoading"
                @click="restartServer"
                title="重启服务器"
              >
                <CarbonPower class="mr-1 size-4" />
                重启服务器
              </Button>
            </div>
          </div>
        </template>
      </Card>

      <!-- 概览信息 -->
      <Card>
        <template #title>
          <div class="flex items-center justify-between">
            <span class="text-lg font-semibold">{{
              $t('media.node.query.overview')
            }}</span>
            <Button
              size="small"
              type="text"
              :loading="versionLoading"
              @click="fetchVersion"
              class="hover:bg-gray-100"
            >
              <RotateCw class="size-3" />
            </Button>
          </div>
        </template>
        <Spin :spinning="versionLoading">
          <Descriptions v-if="versionData" bordered :column="2">
            <Descriptions.Item :label="$t('media.node.query.buildTime')">
              {{ versionData.buildTime || '-' }}
            </Descriptions.Item>
            <Descriptions.Item :label="$t('media.node.query.branchName')">
              {{ versionData.branchName || '-' }}
            </Descriptions.Item>
            <Descriptions.Item
              :label="$t('media.node.query.commitHash')"
              :span="2"
            >
              <code class="rounded bg-gray-100 px-2 py-1 text-sm">
                {{ versionData.commitHash || '-' }}
              </code>
            </Descriptions.Item>
          </Descriptions>
          <div v-else class="py-8 text-center text-gray-500">
            {{ $t('media.node.query.noData') }}
          </div>
        </Spin>
      </Card>

      <!-- 性能监控 -->
      <Card :title="$t('media.node.query.performance')">
        <Row :gutter="16">
          <Col :span="12">
            <Card size="small" :bordered="false">
              <template #title>
                <div class="flex items-center justify-between">
                  <span>{{ $t('media.node.query.threadsLoad') }}</span>
                  <Button
                    size="small"
                    type="text"
                    :loading="threadsLoadLoading"
                    @click="fetchThreadsLoad"
                    class="hover:bg-gray-100"
                  >
                    <RotateCw class="size-3" />
                  </Button>
                </div>
              </template>
              <Spin :spinning="threadsLoadLoading">
                <Table
                  :columns="threadsLoadColumns"
                  :data-source="threadsLoadData"
                  :pagination="false"
                  size="small"
                  :scroll="{ y: 200 }"
                />
              </Spin>
            </Card>
          </Col>
          <Col :span="12">
            <Card size="small" :bordered="false">
              <template #title>
                <div class="flex items-center justify-between">
                  <span>{{ $t('media.node.query.workThreadsLoad') }}</span>
                  <Button
                    size="small"
                    type="text"
                    :loading="workThreadsLoadLoading"
                    @click="fetchWorkThreadsLoad"
                    class="hover:bg-gray-100"
                  >
                    <RotateCw class="size-3" />
                  </Button>
                </div>
              </template>
              <Spin :spinning="workThreadsLoadLoading">
                <Table
                  :columns="threadsLoadColumns"
                  :data-source="workThreadsLoadData"
                  :pagination="false"
                  size="small"
                  :scroll="{ y: 200 }"
                />
              </Spin>
            </Card>
          </Col>
        </Row>
      </Card>

      <!-- 服务器配置 -->
      <Card @click="handleConfigCardClick">
        <template #title>
          <div class="flex items-center justify-between">
            <span>{{ $t('media.node.query.serverConfig') }}</span>
            <Button
              size="small"
              type="text"
              :loading="serverConfigLoading"
              @click="fetchServerConfig"
              class="hover:bg-gray-100"
            >
              <RotateCw class="size-3" />
            </Button>
          </div>
        </template>
        <Spin :spinning="serverConfigLoading">
          <div class="mb-4 space-y-3">
            <!-- 搜索和统计信息 -->
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-1 items-center gap-3">
                <Input
                  ref="searchInputRef"
                  v-model="configSearchText"
                  placeholder="搜索配置项名称或值..."
                  allow-clear
                  class="w-96"
                >
                  <template #prefix>
                    <Search class="text-gray-400" />
                  </template>
                </Input>
                <Button
                  v-if="configSearchText.trim()"
                  size="small"
                  @click="configSearchText = ''"
                  class="flex items-center gap-1"
                >
                  <X class="size-3" />
                  清除
                </Button>
              </div>

              <!-- 统计信息 -->
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span v-if="configStats.isFiltered" class="text-blue-600">
                  找到 {{ configStats.total }} 项 / 共
                  {{ configStats.totalOriginal }} 项
                </span>
                <span v-else> 共 {{ configStats.total }} 项配置 </span>
              </div>
            </div>

            <!-- 快速分组筛选 -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">快速筛选:</span>
              <div class="flex flex-wrap gap-1">
                <Tag
                  v-for="group in configGroupOrder"
                  :key="group"
                  :color="configSearchText === group ? 'blue' : 'default'"
                  class="cursor-pointer transition-colors hover:bg-blue-50"
                  @click="
                    configSearchText = configSearchText === group ? '' : group
                  "
                >
                  {{ group }}
                </Tag>
              </div>
            </div>

            <!-- 操作提示 -->
            <div class="space-y-1 rounded bg-blue-50 p-3 text-sm text-blue-600">
              <div>💡 {{ $t('media.node.query.doubleClickEditTip') }}</div>
              <div class="text-xs text-blue-500">
                🔍 快捷键:
                <kbd class="rounded bg-white px-1 py-0.5 text-gray-600">
                  Ctrl+F
                </kbd>
                搜索配置项,
                <kbd class="rounded bg-white px-1 py-0.5 text-gray-600">
                  ESC
                </kbd>
                清除搜索
              </div>
            </div>
          </div>

          <!-- 搜索结果为空的提示 -->
          <div
            v-if="configStats.isFiltered && configStats.total === 0"
            class="py-12 text-center text-gray-500"
          >
            <SearchX class="mb-4 text-4xl text-gray-300" />
            <div class="mb-2 text-lg">未找到匹配的配置项</div>
            <div class="text-sm">
              尝试搜索其他关键词，或者
              <Button type="link" size="small" @click="configSearchText = ''">
                清除搜索条件
              </Button>
            </div>
          </div>

          <Table
            v-else
            :columns="serverConfigColumns"
            :data-source="serverConfigTableData"
            :pagination="false"
            size="small"
            :scroll="{ x: 800, y: 500 }"
          />
        </Spin>
      </Card>

      <!-- 对象统计 -->
      <Card>
        <template #title>
          <div class="flex items-center justify-between">
            <span>{{ $t('media.node.query.statistic') }}</span>
            <Button
              size="small"
              type="text"
              :loading="statisticLoading"
              @click="fetchStatistic"
              class="hover:bg-gray-100"
            >
              <RotateCw class="size-3" />
            </Button>
          </div>
        </template>
        <Spin :spinning="statisticLoading">
          <Table
            :columns="statisticColumns"
            :data-source="statisticTableData"
            :pagination="false"
            size="small"
            :scroll="{ y: 260 }"
          />
        </Spin>
      </Card>

      <!-- API列表 -->
      <Card>
        <template #title>
          <div class="flex items-center justify-between">
            <span>{{ $t('media.node.query.apiList') }}</span>
            <Button
              size="small"
              type="text"
              :loading="apiListLoading"
              @click="fetchApiList"
              class="hover:bg-gray-100"
            >
              <RotateCw class="size-3" />
            </Button>
          </div>
        </template>
        <Spin :spinning="apiListLoading">
          <Table
            :columns="apiListColumns"
            :data-source="apiListTableData"
            :pagination="false"
            size="small"
            :scroll="{ y: 260 }"
          />
        </Spin>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
/* 组件样式优化 */
.ant-card {
  margin-bottom: 16px;
}

/* 节点管理固定样式 */
.sticky-node-management {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

/* 表格滚动优化 */
:deep(.ant-table-tbody > tr > td) {
  vertical-align: top;
}

/* 搜索框样式优化 */
:deep(.ant-input-affix-wrapper) {
  border-radius: 6px;
}

/* 选择器下拉框样式优化 */
:deep(.ant-select-dropdown) {
  border-radius: 8px;
  box-shadow: 0 6px 16px 0 rgb(0 0 0 / 8%);
}

:deep(.ant-select-item-option-content) {
  width: 100%;
}

/* 标签样式优化 */
:deep(.ant-tag) {
  font-size: 12px;
  border-radius: 4px;
}
</style>
