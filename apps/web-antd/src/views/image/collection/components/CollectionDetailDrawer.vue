<script lang="ts" setup>
import type { ImageApi } from '#/api/image';
import type { BusinessTaskApi } from '#/api/task';
import type { CollectionControlAction } from '#/views/image/shared/image-permissions';
import type { TaskCenterAction } from '#/views/task/center/utils';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  message,
  Modal,
  Space,
  Tag,
} from 'ant-design-vue';

import { getImageCollection } from '#/api/image';
import {
  cancelBusinessTask,
  getBusinessTask,
  pauseBusinessTask,
  resumeBusinessTask,
  retryBusinessTask,
} from '#/api/task';
import { useSseEvents } from '#/composables/useSseEvents';
import { $t } from '#/locales';
import { createAuthoritativeRefresh } from '#/views/image/shared/authoritative-refresh';
import { collectionActionAllowed } from '#/views/image/shared/image-permissions';
import {
  collectionModeKey,
  collectionStateColor,
  collectionStateKey,
  formatDateTime,
} from '#/views/image/shared/image-presentation';
import TaskDetailContent from '#/views/task/center/TaskDetailContent.vue';

const emit = defineEmits<{
  closed: [];
  reschedule: [task: ImageApi.CollectionVO];
  success: [];
}>();

const { hasAccessByCodes } = useAccess();
const collection = ref<ImageApi.CollectionVO>();
const businessTask = ref<BusinessTaskApi.BusinessTaskDetailVO>();
const collectionError = ref(false);
const businessError = ref(false);
const busyAction = ref<CollectionControlAction>();
const refreshKey = ref(0);
const currentTaskId = ref<string>();
let request: AbortController | undefined;

function permissions() {
  return {
    canControlImage: hasAccessByCodes(['Image:Collection:Control']),
    canControlTask: hasAccessByCodes(['Task:Control']),
  };
}

function requiredCapability(action: CollectionControlAction) {
  return action === 'RESUME' ? 'PAUSE' : action;
}

function bothAuthoritiesAllow(action: CollectionControlAction) {
  if (!collection.value || !businessTask.value) return false;
  const capability = requiredCapability(action);
  return (
    collectionActionAllowed(collection.value, action, permissions()) &&
    collection.value.state === businessTask.value.state &&
    businessTask.value.capabilities?.includes(capability)
  );
}

const taskActions = computed<TaskCenterAction[]>(() =>
  (['PAUSE', 'RESUME', 'MANUAL_RETRY', 'CANCEL'] as TaskCenterAction[]).filter(
    (action) => bothAuthoritiesAllow(action),
  ),
);
const canReschedule = computed(() => bothAuthoritiesAllow('RESCHEDULE'));

async function refreshDetails(reset = false) {
  const taskId = currentTaskId.value;
  if (!taskId) return;
  request?.abort();
  const currentRequest = new AbortController();
  request = currentRequest;
  if (reset) {
    collection.value =
      collection.value?.taskId === taskId ? collection.value : undefined;
    businessTask.value = undefined;
  }
  collectionError.value = false;
  businessError.value = false;
  const [collectionResult, businessResult] = await Promise.allSettled([
    getImageCollection(taskId, currentRequest.signal),
    getBusinessTask(taskId, currentRequest.signal),
  ]);
  if (currentRequest.signal.aborted) return;
  if (collectionResult.status === 'fulfilled')
    collection.value = collectionResult.value;
  else collectionError.value = true;
  if (businessResult.status === 'fulfilled')
    businessTask.value = businessResult.value;
  else businessError.value = true;
  refreshKey.value++;
}

const detailRefresher = createAuthoritativeRefresh(
  () => refreshDetails(false),
  { delay: 300, maxWait: 1500 },
);
const sse = useSseEvents(() =>
  currentTaskId.value
    ? [
        'image.asset.created',
        'image.asset.deleted',
        'business.task.state',
        'business.task.progress',
        'business.task.execution-state',
      ]
    : [],
);
watch(sse.events, (events) => {
  const event = events.at(-1);
  if (!event || !currentTaskId.value) return;
  const eventTaskId = event.data.taskId ?? event.data.sourceTaskId;
  if (eventTaskId === currentTaskId.value) detailRefresher.notify();
});

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (!isOpen) {
      request?.abort();
      sse.close();
      currentTaskId.value = undefined;
      emit('closed');
      return;
    }
    const task = drawerApi.getData<ImageApi.CollectionVO>();
    collection.value = task;
    currentTaskId.value = task.taskId;
    sse.restart();
    void refreshDetails(true);
  },
});

async function copy(value?: string) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  message.success($t('image.common.copied'));
}

function confirmCancel(task: ImageApi.CollectionVO) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      content: $t('image.collections.confirm.cancel', [
        task.taskName || task.taskId,
      ]),
      okButtonProps: { danger: true },
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: $t('image.collections.action.cancel'),
    });
  });
}

async function control(action: TaskCenterAction) {
  if (!collection.value || busyAction.value) return;
  await refreshDetails(false);
  if (!bothAuthoritiesAllow(action)) {
    message.error($t('image.collections.error.stateConflict'));
    return;
  }
  const task = collection.value;
  if (action === 'CANCEL' && !(await confirmCancel(task))) return;
  busyAction.value = action;
  try {
    switch (action) {
      case 'CANCEL': {
        await cancelBusinessTask(task.taskId, {
          expectedVersion: task.version,
        });
        break;
      }
      case 'PAUSE': {
        await pauseBusinessTask(task.taskId, {
          expectedVersion: task.version,
        });
        break;
      }
      case 'RESUME': {
        await resumeBusinessTask(task.taskId, {
          expectedVersion: task.version,
        });
        break;
      }
      default: {
        const executionId = task.lastExecutionId;
        if (!executionId) throw new Error('execution is unavailable');
        await retryBusinessTask(task.taskId, {
          executionId,
          idempotencyKey: `manual-retry:${task.taskId}:${executionId}`,
        });
      }
    }
    message.success($t('image.collections.control.success'));
    await refreshDetails(false);
    emit('success');
  } catch {
    message.error($t('image.collections.error.stateConflict'));
    await refreshDetails(false);
  } finally {
    busyAction.value = undefined;
  }
}

function reschedule() {
  if (!collection.value || !canReschedule.value) return;
  emit('reschedule', collection.value);
}

const singleAssetHref = computed(() =>
  collection.value?.resultRefType === 'IMAGE_ASSET' &&
  collection.value.resultRefId
    ? `/image/assets?assetId=${encodeURIComponent(collection.value.resultRefId)}`
    : undefined,
);
const allAssetsHref = computed(() =>
  currentTaskId.value
    ? `/image/assets?sourceTaskId=${encodeURIComponent(currentTaskId.value)}`
    : undefined,
);

onBeforeUnmount(() => detailRefresher.dispose());
</script>

<template>
  <Drawer
    class="w-full max-w-[760px]"
    :title="$t('image.collections.detail.title')"
  >
    <div class="collection-detail">
      <template v-if="collection">
        <div class="collection-detail__header">
          <div>
            <h2>{{ collection.taskName || collection.taskId }}</h2>
            <Space wrap>
              <Tag :color="collectionStateColor(collection.state)">
                {{ $t(collectionStateKey(collection.state)) }}
              </Tag>
              <Tag>{{ $t(collectionModeKey(collection)) }}</Tag>
              <Button size="small" type="link" @click="copy(collection.taskId)">
                {{ collection.taskId }}
              </Button>
            </Space>
          </div>
          <Button v-if="canReschedule" @click="reschedule">
            {{ $t('image.collections.action.reschedule') }}
          </Button>
        </div>

        <Alert
          v-if="collectionError"
          type="error"
          show-icon
          :message="$t('image.collections.detail.collectionError')"
        >
          <template #action>
            <a @click="() => refreshDetails()">{{ $t('common.retry') }}</a>
          </template>
        </Alert>

        <Descriptions bordered :column="{ xs: 1, sm: 2 }" size="small">
          <DescriptionsItem :label="$t('image.collections.field.deviceId')">
            {{ collection.deviceName || collection.deviceId || '-' }}
            <small class="text-muted-foreground block">{{
              collection.deviceId
            }}</small>
          </DescriptionsItem>
          <DescriptionsItem :label="$t('image.collections.field.channelId')">
            {{ collection.channelName || collection.channelId || '-' }}
            <small class="text-muted-foreground block">{{
              collection.channelId
            }}</small>
          </DescriptionsItem>
          <DescriptionsItem
            :label="$t('image.collections.field.retentionPolicy')"
          >
            {{ collection.retentionPolicy || '-' }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('image.collections.field.nextPlanTime')">
            {{ formatDateTime(collection.nextPlanTime) }}
          </DescriptionsItem>
        </Descriptions>

        <section class="collection-detail__result">
          <h3>{{ $t('image.collections.detail.results') }}</h3>
          <p v-if="collection.resultSummary">{{ collection.resultSummary }}</p>
          <Space wrap>
            <a v-if="singleAssetHref" :href="singleAssetHref">
              {{ $t('image.collections.action.viewAsset') }}
            </a>
            <a v-if="allAssetsHref" :href="allAssetsHref">
              {{ $t('image.collections.action.viewAllAssets') }}
            </a>
          </Space>
        </section>
      </template>

      <Alert
        v-if="businessError"
        type="error"
        show-icon
        :message="$t('image.collections.detail.businessError')"
      >
        <template #action>
          <a @click="() => refreshDetails()">{{ $t('common.retry') }}</a>
        </template>
      </Alert>

      <TaskDetailContent
        v-if="businessTask"
        :available-actions="taskActions"
        :busy-action="busyAction as TaskCenterAction"
        :refresh-key="refreshKey"
        :show-header="false"
        :show-result="false"
        :task="businessTask"
        @control="control"
      />
    </div>
  </Drawer>
</template>

<style scoped>
.collection-detail {
  display: grid;
  gap: 20px;
}

.collection-detail__header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.collection-detail__header h2 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 650;
  color: var(--foreground);
}

.collection-detail__result {
  display: grid;
  gap: 8px;
}

.collection-detail__result h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
</style>
