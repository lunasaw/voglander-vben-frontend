<script lang="ts" setup>
import type {
  ZlmQueryApi
} from '#/api/media/zlm-query';

import { computed, h, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { ArrowLeft, RotateCw, Search, SearchX, X } from '@vben/icons';

import { Button, Card, Col, Descriptions, Input, Row, Spin, Table, Tag, message } from 'ant-design-vue';

import {
  getZlmVersion,
  getZlmApiList,
  getZlmThreadsLoad,
  getZlmWorkThreadsLoad,
  getZlmStatistic,
  getZlmServerConfig,
  setZlmServerConfig
} from '#/api/media/zlm-query';
import { $t } from '#/locales';

const { hasAccessByCodes } = useAccess();
const route = useRoute();
const router = useRouter();

// 获取节点Key参数
const nodeKey = computed(() => route.params.nodeKey as string);
const nodeName = computed(() => route.query.nodeName as string || nodeKey.value);

// 加载状态
const loading = ref(false);
const versionLoading = ref(false);
const apiListLoading = ref(false);
const threadsLoadLoading = ref(false);
const workThreadsLoadLoading = ref(false);
const statisticLoading = ref(false);
const serverConfigLoading = ref(false);

// 数据状态
const versionData = ref<ZlmQueryApi.Version | null>(null);
const apiListData = ref<string[]>([]);
const threadsLoadData = ref<ZlmQueryApi.ThreadLoad[]>([]);
const workThreadsLoadData = ref<ZlmQueryApi.ThreadLoad[]>([]);
const statisticData = ref<ZlmQueryApi.ImportantObjectNum | null>(null);
const serverConfigData = ref<ZlmQueryApi.ServerNodeConfig>([]);

// 配置项编辑状态
const editingConfig = ref<string | null>(null);
const editingValue = ref<string>('');
const savingConfig = ref<string | null>(null);

// 配置项搜索状态
const configSearchText = ref<string>('');

// 吸顶导航相关状态
const activeSection = ref<string>('overview');
const stickyNavVisible = ref(false);

// 定义各个模块的ID和名称
const sections = [
  { id: 'overview', name: $t('media.node.query.overview') },
  { id: 'performance', name: $t('media.node.query.performance') },
  { id: 'statistic', name: $t('media.node.query.statistic') },
  { id: 'serverConfig', name: $t('media.node.query.serverConfig') },
  { id: 'apiList', name: $t('media.node.query.apiList') },
];

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

// 开始编辑单个配置项
function startEditConfigItem(key: string, value: string) {
  if (!hasAccessByCodes(['Media:Node:Edit'])) {
    message.error('您没有编辑节点配置的权限');
    return;
  }
  editingConfig.value = key;
  editingValue.value = value === null || value === undefined ? '' : String(value);
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
      [key]: editingValue.value
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
  const isInputArea = target.closest('.ant-input') ||
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
    await Promise.all([
      fetchVersion(),
      fetchApiList(),
      fetchThreadsLoad(),
      fetchWorkThreadsLoad(),
      fetchStatistic(),
      fetchServerConfig()
    ]);
    message.success('数据刷新成功');
  } catch (error) {
    console.error('刷新数据失败:', error);
    message.error('刷新数据失败');
  } finally {
    loading.value = false;
  }
}

// 返回列表
function goBack() {
  router.push('/media/node');
}

// 滚动到指定模块
function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId);
  if (element) {
    const offsetTop = element.offsetTop - 120; // 减去头部高度和导航高度
    window.scrollTo({
      top: offsetTop,
      behavior: 'smooth'
    });
  }
}

// 滚动监听函数
function handleScroll() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  // 判断是否显示吸顶导航（滚动超过200px时显示）
  stickyNavVisible.value = scrollTop > 200;

  // 查找当前最接近顶部的模块
  let currentSection = 'overview';
  const offset = 150; // 偏移量，用于提前切换激活状态

  for (let i = sections.length - 1; i >= 0; i--) {
    const element = document.getElementById(sections[i].id);
    if (element) {
      const elementTop = element.offsetTop - offset;
      if (scrollTop >= elementTop) {
        currentSection = sections[i].id;
        break;
      }
    }
  }

  activeSection.value = currentSection;
}

// 节流函数
function throttle(func: Function, delay: number) {
  let timer: NodeJS.Timeout | null = null;
  return function(this: any, ...args: any[]) {
    if (!timer) {
      timer = setTimeout(() => {
        func.apply(this, args);
        timer = null;
      }, delay);
    }
  };
}

// 创建节流后的滚动处理函数
const throttledHandleScroll = throttle(handleScroll, 16); // 约60fps

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
      const loadValue = parseFloat(text);
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

  const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
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
          innerHTML: highlightSearchText(text, searchText)
        });
      }
      return text;
    },
  },
  {
    title: $t('media.node.query.configValue'),
    dataIndex: 'value',
    key: 'value',
    customRender: ({ text, record }: { text: string; record: any }) => {
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
          h(Button, {
            type: 'primary',
            size: 'small',
            loading: isSaving,
            onClick: () => saveConfigItem(record.key),
          }, () => $t('media.node.query.saveConfig')),
          h(Button, {
            size: 'small',
            disabled: isSaving,
            onClick: cancelEditConfigItem,
          }, () => $t('media.node.query.cancel')),
        ]);
      }

      const displayText = text === null || text === undefined ? '-' : text;
      const searchText = configSearchText.value.trim();

      return h('div', {
        class: 'cursor-pointer hover:bg-gray-100 p-1 rounded',
        onDblclick: () => startEditConfigItem(record.key, text),
        title: $t('media.node.query.doubleClickToEdit'),
        innerHTML: searchText ? highlightSearchText(displayText, searchText) : displayText
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
  'srt'
];

// 根据配置分组获取排序权重
function getConfigGroupWeight(configKey: string): number {
  const prefix = configKey.split('.')[0];
  const index = configGroupOrder.indexOf(prefix);
  return index === -1 ? 999 : index; // 未知分组排到最后
}

// 转换服务器配置数据为表格数据
const serverConfigTableData = computed(() => {
  if (!serverConfigData.value || serverConfigData.value.length === 0) return [];

  // 如果是数组格式，需要将数组中的对象合并为一个对象，然后转换为表格数据
  const configObj = serverConfigData.value.reduce((acc, item) => {
    return { ...acc, ...item };
  }, {});

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
    filteredData = filteredData.filter(item =>
      item.key.toLowerCase().includes(searchText) ||
      String(item.value).toLowerCase().includes(searchText)
    );
  }

  return filteredData;
});

// 配置项统计信息
const configStats = computed(() => {
  const total = serverConfigTableData.value.length;
  const totalOriginal = serverConfigData.value?.reduce((acc, item) => {
    return acc + Object.keys(item).length;
  }, 0) || 0;

  return {
    total,
    totalOriginal,
    isFiltered: configSearchText.value.trim() !== ''
  };
});

// 组件挂载时加载数据
onMounted(async () => {
  await refreshAllData();

  // 等待DOM更新后添加滚动监听
  await nextTick();
  window.addEventListener('scroll', throttledHandleScroll, { passive: true });
  window.addEventListener('keydown', handleKeyDown);

  // 初始化时检查一次滚动位置
  handleScroll();
});

// 组件卸载时移除事件监听
onUnmounted(() => {
  window.removeEventListener('scroll', throttledHandleScroll);
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Page auto-content-height>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button @click="goBack">
            <ArrowLeft class="size-4" />
            {{ $t('media.node.query.backToList') }}
          </Button>
          <h1 class="text-2xl font-bold">
            {{ $t('media.node.detail') }} - {{ nodeName }}
          </h1>
        </div>
        <Button type="primary" :loading="loading" @click="refreshAllData">
          <RotateCw class="size-4" />
          {{ $t('media.node.query.refreshData') }}
        </Button>
      </div>
    </template>

    <!-- 吸顶导航 -->
    <div
      v-show="stickyNavVisible"
      class="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm transition-all duration-300"
      :class="{ 'opacity-100 translate-y-0': stickyNavVisible, 'opacity-0 -translate-y-full': !stickyNavVisible }"
    >
      <div class="max-w-7xl mx-auto px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-1">
            <span class="text-sm font-medium text-gray-600 mr-4">{{ nodeName }}</span>
            <Button
              v-for="section in sections"
              :key="section.id"
              :type="activeSection === section.id ? 'primary' : 'text'"
              size="small"
              @click="scrollToSection(section.id)"
              class="transition-colors duration-200"
            >
              {{ section.name }}
            </Button>
          </div>
          <Button
            type="primary"
            size="small"
            :loading="loading"
            @click="refreshAllData"
            class="flex items-center gap-1"
          >
            <RotateCw class="size-3" />
            刷新
          </Button>
        </div>
      </div>
    </div>

    <div class="space-y-6">
      <!-- 概览信息 -->
      <Card id="overview">
        <template #title>
          <div class="flex items-center justify-between">
            <span>{{ $t('media.node.query.overview') }}</span>
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
            <Descriptions.Item :label="$t('media.node.query.commitHash')" :span="2">
              <code class="px-2 py-1 bg-gray-100 rounded text-sm">
                {{ versionData.commitHash || '-' }}
              </code>
            </Descriptions.Item>
          </Descriptions>
          <div v-else class="text-center py-8 text-gray-500">
            {{ $t('media.node.query.noData') }}
          </div>
        </Spin>
      </Card>

      <!-- 性能监控 -->
      <Card id="performance" :title="$t('media.node.query.performance')">
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

      <!-- 对象统计 -->
      <Card id="statistic">
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

      <!-- 服务器配置 -->
      <Card id="serverConfig" @click="handleConfigCardClick">
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
              <div class="flex items-center gap-3 flex-1">
                <Input
                  ref="searchInputRef"
                  v-model:value="configSearchText"
                  placeholder="搜索配置项名称或值..."
                  allow-clear
                  class="max-w-sm"
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
                  找到 {{ configStats.total }} 项 / 共 {{ configStats.totalOriginal }} 项
                </span>
                <span v-else>
                  共 {{ configStats.total }} 项配置
                </span>
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
                  class="cursor-pointer hover:bg-blue-50 transition-colors"
                  @click="configSearchText = configSearchText === group ? '' : group"
                >
                  {{ group }}
                </Tag>
              </div>
            </div>

            <!-- 操作提示 -->
            <div class="p-3 bg-blue-50 rounded text-sm text-blue-600 space-y-1">
              <div>💡 {{ $t('media.node.query.doubleClickEditTip') }}</div>
              <div class="text-xs text-blue-500">
                🔍 快捷键: <kbd class="px-1 py-0.5 bg-white rounded text-gray-600">Ctrl+F</kbd> 搜索配置项,
                <kbd class="px-1 py-0.5 bg-white rounded text-gray-600">ESC</kbd> 清除搜索
              </div>
            </div>
          </div>

          <!-- 搜索结果为空的提示 -->
          <div
            v-if="configStats.isFiltered && configStats.total === 0"
            class="text-center py-12 text-gray-500"
          >
            <SearchX class="text-4xl mb-4 text-gray-300" />
            <div class="text-lg mb-2">未找到匹配的配置项</div>
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

      <!-- API列表 -->
      <Card id="apiList">
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
