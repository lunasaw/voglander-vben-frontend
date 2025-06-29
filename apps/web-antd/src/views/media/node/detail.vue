<script lang="ts" setup>
import type {
  ZlmQueryApi
} from '#/api/media/zlm-query';

import { computed, h, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { ArrowLeft, RotateCw } from '@vben/icons';

import { Button, Card, Col, Descriptions, Row, Spin, Table, Tag, message } from 'ant-design-vue';

import {
  getZlmVersion,
  getZlmApiList,
  getZlmThreadsLoad,
  getZlmWorkThreadsLoad,
  getZlmStatistic,
  getZlmServerConfig
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
const serverConfigData = ref<ZlmQueryApi.ServerNodeConfig>({});

// 检查权限
if (!hasAccessByCodes(['Media:Node:List'])) {
  message.error('您没有查看节点详情的权限');
  router.push('/media/node');
}

// 获取版本信息
async function fetchVersion() {
  versionLoading.value = true;
  try {
    const response = await getZlmVersion(nodeKey.value);
    if (response.code === 0) {
      versionData.value = response.data;
    } else {
      message.error(`获取版本信息失败: ${response.msg}`);
    }
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
    const response = await getZlmApiList(nodeKey.value);
    if (response.code === 0) {
      apiListData.value = response.data;
    } else {
      message.error(`获取API列表失败: ${response.msg}`);
    }
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
    const response = await getZlmThreadsLoad(nodeKey.value);
    if (response.code === 0) {
      threadsLoadData.value = response.data;
    } else {
      message.error(`获取网络线程负载失败: ${response.msg}`);
    }
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
    const response = await getZlmWorkThreadsLoad(nodeKey.value);
    if (response.code === 0) {
      workThreadsLoadData.value = response.data;
    } else {
      message.error(`获取后台线程负载失败: ${response.msg}`);
    }
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
    const response = await getZlmStatistic(nodeKey.value);
    if (response.code === 0) {
      statisticData.value = response.data;
    } else {
      message.error(`获取对象统计失败: ${response.msg}`);
    }
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
    const response = await getZlmServerConfig(nodeKey.value);
    if (response.code === 0) {
      serverConfigData.value = response.data;
    } else {
      message.error(`获取服务器配置失败: ${response.msg}`);
    }
  } catch (error) {
    console.error('获取服务器配置失败:', error);
    message.error('获取服务器配置失败');
  } finally {
    serverConfigLoading.value = false;
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

// 服务器配置表格列定义
const serverConfigColumns = [
  {
    title: $t('media.node.query.configKey'),
    dataIndex: 'key',
    key: 'key',
    width: 300,
  },
  {
    title: $t('media.node.query.configValue'),
    dataIndex: 'value',
    key: 'value',
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

// 转换服务器配置数据为表格数据
const serverConfigTableData = computed(() => {
  return Object.entries(serverConfigData.value).map(([key, value]) => ({
    key,
    value,
  }));
});

// 组件挂载时加载数据
onMounted(() => {
  refreshAllData();
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

    <div class="space-y-6">
      <!-- 概览信息 -->
      <Card :title="$t('media.node.query.overview')">
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
      <Card :title="$t('media.node.query.performance')">
        <Row :gutter="16">
          <Col :span="12">
            <Card size="small" :title="$t('media.node.query.threadsLoad')" :bordered="false">
              <Spin :spinning="threadsLoadLoading">
                <Table
                  :columns="threadsLoadColumns"
                  :data-source="threadsLoadData"
                  :pagination="false"
                  size="small"
                  :scroll="{ y: 300 }"
                />
              </Spin>
            </Card>
          </Col>
          <Col :span="12">
            <Card size="small" :title="$t('media.node.query.workThreadsLoad')" :bordered="false">
              <Spin :spinning="workThreadsLoadLoading">
                <Table
                  :columns="threadsLoadColumns"
                  :data-source="workThreadsLoadData"
                  :pagination="false"
                  size="small"
                  :scroll="{ y: 300 }"
                />
              </Spin>
            </Card>
          </Col>
        </Row>
      </Card>

      <!-- 对象统计 -->
      <Card :title="$t('media.node.query.statistic')">
        <Spin :spinning="statisticLoading">
          <Table
            :columns="statisticColumns"
            :data-source="statisticTableData"
            :pagination="{ pageSize: 10 }"
            size="small"
          />
        </Spin>
      </Card>

      <!-- API列表 -->
      <Card :title="$t('media.node.query.apiList')">
        <Spin :spinning="apiListLoading">
          <Table
            :columns="apiListColumns"
            :data-source="apiListTableData"
            :pagination="{ pageSize: 10 }"
            size="small"
          />
        </Spin>
      </Card>

      <!-- 服务器配置 -->
      <Card :title="$t('media.node.query.serverConfig')">
        <Spin :spinning="serverConfigLoading">
          <Table
            :columns="serverConfigColumns"
            :data-source="serverConfigTableData"
            :pagination="{ pageSize: 20 }"
            size="small"
            :scroll="{ x: 800 }"
          />
        </Spin>
      </Card>
    </div>
  </Page>
</template>
