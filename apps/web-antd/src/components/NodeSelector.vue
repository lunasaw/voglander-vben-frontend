<script lang="ts" setup>
import type { MediaNodeApi } from '#/api/media/medianode';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { message, Select, Tag } from 'ant-design-vue';

import { getEnabledMediaNodeList } from '#/api/media/medianode';
import { $t } from '#/locales';
import { clearCurrentNodeKey, setCurrentNodeKey } from '#/utils/node-state';

export interface NodeSelectorProps {
  modelValue?: null | number | string;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  showSearch?: boolean;
  size?: 'large' | 'middle' | 'small';
  style?: Record<string, any>;
  class?: string;
  title?: string;
  showContainer?: boolean;
}

export interface NodeSelectorEmits {
  (e: 'update:modelValue', value: null | number | string): void;
  (
    e: 'change',
    value: null | number | string,
    node?: MediaNodeApi.MediaNodeVO,
  ): void;
  (e: 'nodeListLoaded', nodes: MediaNodeApi.MediaNodeVO[]): void;
  (
    e: 'nodeSwitch',
    nodeKey: null | number | string,
    node?: MediaNodeApi.MediaNodeVO,
  ): void;
}

const props = withDefaults(defineProps<NodeSelectorProps>(), {
  modelValue: null,
  placeholder: undefined, // 将通过$t动态提供
  loading: false,
  disabled: false,
  allowClear: true,
  showSearch: true,
  size: 'middle',
  style: () => ({ minWidth: '200px', width: '250px' }),
  class: '',
  title: undefined, // 将通过$t动态提供
  showContainer: true,
});

const emit = defineEmits<NodeSelectorEmits>();

// 节点选择状态
const nodeListData = ref<MediaNodeApi.MediaNodeVO[]>([]);
const nodeListLoading = ref(false);

// 定时刷新
let refreshTimer: NodeJS.Timeout | null = null;

// 判断节点是否在线
function isNodeOnline(keepalive?: number | string): boolean {
  if (!keepalive) return false;

  const keepaliveTime = new Date(Number(keepalive));
  const now = new Date();
  const diffMinutes = (now.getTime() - keepaliveTime.getTime()) / (1000 * 60);

  return diffMinutes < 5;
}

// 计算属性：排序后的节点列表（在线节点优先）
const sortedNodeList = computed(() => {
  return [...nodeListData.value].sort((a, b) => {
    const aOnline = isNodeOnline(a.keepalive);
    const bOnline = isNodeOnline(b.keepalive);

    // 在线状态优先
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;

    // 启用状态优先
    if (a.enabled !== b.enabled) {
      return (b.enabled ? 1 : 0) - (a.enabled ? 1 : 0);
    }

    // 如果在线状态相同，按名称排序
    const aName = a.name || a.serverId || a.id || '';
    const bName = b.name || b.serverId || b.id || '';
    return aName.localeCompare(bName);
  });
});

// 获取启用的节点列表
async function fetchNodeList() {
  nodeListLoading.value = true;
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
    emit('nodeListLoaded', nodeList);

    // 如果没有选择节点，默认选择第一个在线节点
    if (!props.modelValue && nodeList.length > 0) {
      const firstOnlineNode = nodeList.find((node) =>
        isNodeOnline(node.keepalive),
      );
      const defaultNode = firstOnlineNode || nodeList[0];
      const defaultValue = String(defaultNode.serverId || defaultNode.id);

      // 更新全局状态
      setCurrentNodeKey(defaultValue);

      emit('update:modelValue', defaultValue);
      emit('change', defaultValue, defaultNode);
      emit('nodeSwitch', defaultValue, defaultNode);
    }
  } catch (error) {
    console.error('获取节点列表失败:', error);
    message.error($t('media.node.query.loadNodeListFailed'));
  } finally {
    nodeListLoading.value = false;
  }
}

// 节点切换处理
function onNodeChange(
  selectedNodeKey: (number | string)[] | number | string | undefined,
) {
  if (selectedNodeKey === undefined || selectedNodeKey === null) {
    clearCurrentNodeKey(); // 清除全局状态
    emit('update:modelValue', null);
    emit('change', null);
    emit('nodeSwitch', null);
    return;
  }

  if (Array.isArray(selectedNodeKey)) return;

  const nodeKeyStr = String(selectedNodeKey);
  const selectedNode = nodeListData.value.find(
    (node) => String(node.serverId || node.id) === nodeKeyStr,
  );

  // 更新全局状态
  setCurrentNodeKey(nodeKeyStr);

  emit('update:modelValue', nodeKeyStr);
  emit('change', nodeKeyStr, selectedNode);
  emit('nodeSwitch', nodeKeyStr, selectedNode);
}

// 节点选择器的过滤函数
function filterOption(input: string, option: any) {
  const node = sortedNodeList.value.find(
    (n) => (n.serverId || n.id) === option.value,
  );
  if (!node) return false;
  const searchText = input.toLowerCase();
  return (
    (node.name || '').toLowerCase().includes(searchText) ||
    String(node.serverId || node.id || '')
      .toLowerCase()
      .includes(searchText) ||
    (node.host || '').toLowerCase().includes(searchText)
  );
}

// 选择默认节点（在线节点优先）
function selectDefaultNode() {
  if (props.modelValue || nodeListData.value.length === 0) {
    return; // 已经有选择的节点或没有可用节点
  }

  const firstOnlineNode = nodeListData.value.find((node) =>
    isNodeOnline(node.keepalive),
  );
  const defaultNode = firstOnlineNode || nodeListData.value[0];
  const defaultValue = String(defaultNode.serverId || defaultNode.id);

  // 更新全局状态
  setCurrentNodeKey(defaultValue);

  emit('update:modelValue', defaultValue);
  emit('change', defaultValue, defaultNode);
  emit('nodeSwitch', defaultValue, defaultNode);
}

// 刷新节点列表
async function refresh() {
  await fetchNodeList();
}

// 启动定时刷新
function startRefreshTimer() {
  // 清除现有定时器
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  // 设置定时器，每10秒刷新一次节点状态
  refreshTimer = setInterval(async () => {
    try {
      await fetchNodeList();
    } catch (error) {
      console.error('定时刷新节点列表失败:', error);
    }
  }, 10_000);
}

// 停止定时刷新
function stopRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 导出刷新方法供父组件调用
defineExpose({
  refresh,
  selectDefaultNode,
  nodeList: nodeListData,
  isLoading: nodeListLoading,
});

// 监听外部loading变化，内部loading优先
const combinedLoading = computed(() => props.loading || nodeListLoading.value);

// 组件挂载时获取节点列表并启动定时刷新
onMounted(async () => {
  await fetchNodeList();
  startRefreshTimer();
});

// 组件卸载时清理定时器
onUnmounted(() => {
  stopRefreshTimer();
});
</script>

<template>
  <!-- 带容器的完整组件 -->
  <div v-if="showContainer" class="mb-4 rounded-lg bg-white p-4 shadow-sm">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-lg font-semibold">{{
          title || $t('media.node.selector.title')
        }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="shrink-0 text-sm font-medium text-gray-700">
          {{ $t('media.node.query.selectNode') }}:
        </span>
        <Select
          :value="modelValue"
          :loading="combinedLoading"
          :placeholder="placeholder || $t('media.node.selector.placeholder')"
          :disabled="disabled"
          :allow-clear="allowClear"
          :show-search="showSearch"
          :size="size"
          :style="style"
          :class="props.class"
          :filter-option="showSearch ? filterOption : undefined"
          :dropdown-match-select-width="true"
          @change="onNodeChange"
        >
          <Select.Option
            v-for="node in sortedNodeList"
            :key="node.serverId || node.id"
            :value="node.serverId || node.id"
            :style="{ padding: '8px 16px' }"
          >
            <div class="flex w-full items-center justify-between">
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="truncate font-medium text-gray-900">
                  {{ node.name || node.serverId || node.id || '未知节点' }}
                </span>
                <span class="truncate text-xs text-gray-500">
                  ({{ node.host || '-' }})
                </span>
              </div>
              <div class="ml-3 flex shrink-0 items-center">
                <Tag
                  :color="isNodeOnline(node.keepalive) ? 'green' : 'red'"
                  size="small"
                  class="m-0"
                >
                  {{
                    isNodeOnline(node.keepalive)
                      ? $t('media.node.statusOnline')
                      : $t('media.node.statusOffline')
                  }}
                </Tag>
              </div>
            </div>
          </Select.Option>
        </Select>
      </div>
    </div>
  </div>

  <!-- 仅选择器组件 -->
  <Select
    v-else
    :value="modelValue"
    :loading="combinedLoading"
    :placeholder="placeholder || $t('media.node.selector.placeholder')"
    :disabled="disabled"
    :allow-clear="allowClear"
    :show-search="showSearch"
    :size="size"
    :style="style"
    :class="props.class"
    :filter-option="showSearch ? filterOption : undefined"
    :dropdown-match-select-width="true"
    @change="onNodeChange"
  >
    <Select.Option
      v-for="node in sortedNodeList"
      :key="node.serverId || node.id"
      :value="node.serverId || node.id"
      :style="{ padding: '8px 16px' }"
    >
      <div class="flex w-full items-center justify-between">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <span class="truncate font-medium text-gray-900">
            {{ node.name || node.serverId || node.id || '未知节点' }}
          </span>
          <span class="truncate text-xs text-gray-500">
            ({{ node.host || '-' }})
          </span>
        </div>
        <div class="ml-3 flex shrink-0 items-center">
          <Tag
            :color="isNodeOnline(node.keepalive) ? 'green' : 'red'"
            size="small"
            class="m-0"
          >
            {{
              isNodeOnline(node.keepalive)
                ? $t('media.node.statusOnline')
                : $t('media.node.statusOffline')
            }}
          </Tag>
        </div>
      </div>
    </Select.Option>
  </Select>
</template>
