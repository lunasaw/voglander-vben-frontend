<script lang="ts" setup>
import type { TaskCenterAction } from './utils';

import type { BusinessTaskApi } from '#/api/task';

import { computed, nextTick, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Drawer,
  message,
  Modal,
  Tag,
} from 'ant-design-vue';

import {
  cancelBusinessTask,
  getBusinessTask,
  pauseBusinessTask,
  resumeBusinessTask,
  retryBusinessTask,
} from '#/api/task';
import { $t } from '#/locales';

import { getTaskTypeAdapter } from './registry';
import TaskExecutionHistory from './TaskExecutionHistory.vue';
import TaskProgress from './TaskProgress.vue';
import { getTaskActions } from './utils';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    returnFocus?: HTMLElement | null;
    task?: BusinessTaskApi.BusinessTaskDetailVO;
    taskId?: string;
  }>(),
  { open: false, returnFocus: null, task: undefined, taskId: undefined },
);

const emit = defineEmits<{ 'update:open': [value: boolean] }>();
const loadedTask = ref<BusinessTaskApi.BusinessTaskDetailVO>();
const busyAction = ref<TaskCenterAction>();
const { hasAccessByCodes } = useAccess();

const displayTask = computed(() => loadedTask.value ?? props.task);
const taskAdapter = computed(() =>
  getTaskTypeAdapter(displayTask.value?.taskType),
);
const resultView = computed(() =>
  taskAdapter.value.resultRenderer?.({ task: displayTask.value }),
);
const availableActions = computed(() =>
  getTaskActions({
    capabilities: displayTask.value?.capabilities,
    permissions: hasAccessByCodes(['Task:Control']) ? ['Task:Control'] : [],
    state: displayTask.value?.state,
  }),
);

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : '-';
}

watch(
  () => [props.open, props.taskId] as const,
  async ([open, taskId]) => {
    if (open && taskId && !props.task) {
      loadedTask.value = await getBusinessTask(taskId);
    }
  },
  { immediate: true },
);

watch(
  () => props.task,
  (task) => {
    loadedTask.value = task;
  },
  { immediate: true },
);

function close() {
  emit('update:open', false);
  void nextTick(() => props.returnFocus?.focus());
}

function actionLabel(action: TaskCenterAction): string {
  const key: Record<TaskCenterAction, string> = {
    CANCEL: 'task.center.action.cancel',
    MANUAL_RETRY: 'task.center.action.retry',
    PAUSE: 'task.center.action.pause',
    RESUME: 'task.center.action.resume',
  };
  return $t(key[action]);
}

function confirmAction(action: TaskCenterAction): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const messageKey: Record<TaskCenterAction, string> = {
      CANCEL: 'task.center.message.cancelConfirm',
      MANUAL_RETRY: 'task.center.message.retryConfirm',
      PAUSE: 'task.center.message.pauseConfirm',
      RESUME: 'task.center.message.resumeConfirm',
    };
    Modal.confirm({
      cancelText: $t('common.cancel'),
      content: $t(messageKey[action]),
      onCancel: () => reject(new Error('cancelled')),
      onOk: () => resolve(true),
      title: actionLabel(action),
    });
  });
}

async function refreshTask() {
  if (displayTask.value?.taskId) {
    loadedTask.value = await getBusinessTask(displayTask.value.taskId);
  }
}

async function onControl(action: TaskCenterAction) {
  if (!hasAccessByCodes(['Task:Control'])) {
    message.error($t('task.center.message.permissionDenied'));
    return;
  }
  if (!displayTask.value?.taskId || busyAction.value) {
    return;
  }
  try {
    await confirmAction(action);
  } catch {
    return;
  }
  busyAction.value = action;
  try {
    const taskId = displayTask.value.taskId;
    switch (action) {
      case 'CANCEL': {
        loadedTask.value = await cancelBusinessTask(taskId, {});
        break;
      }
      case 'MANUAL_RETRY': {
        const executionId = displayTask.value.activeExecution?.executionId;
        if (!executionId) {
          throw new Error('execution is unavailable');
        }
        loadedTask.value = await retryBusinessTask(taskId, {
          executionId,
          idempotencyKey: `manual-retry:${taskId}:${executionId}`,
        });
        break;
      }
      case 'PAUSE': {
        loadedTask.value = await pauseBusinessTask(taskId, {});
        break;
      }
      case 'RESUME': {
        loadedTask.value = await resumeBusinessTask(taskId, {});
        break;
      }
    }
    message.success($t('task.center.message.controlSuccess'));
    await refreshTask();
  } catch {
    message.error($t('task.center.message.stateConflict'));
    await refreshTask();
  } finally {
    busyAction.value = undefined;
  }
}
</script>

<template>
  <Drawer
    :open="props.open"
    :title="$t('task.center.detail.title')"
    width="min(100vw, 720px)"
    @close="close"
  >
    <template v-if="displayTask">
      <div class="mb-4 flex items-center gap-2">
        <span class="text-lg font-semibold">{{
          displayTask.taskName || displayTask.taskId
        }}</span>
        <Tag>{{ $t(taskAdapter.labelKey) }}</Tag>
        <Tag>
          {{ $t(`task.center.status.${displayTask.state || 'SCHEDULED'}`) }}
        </Tag>
      </div>

      <div
        v-if="availableActions.length > 0"
        class="mb-5 flex flex-wrap gap-2"
        role="group"
        :aria-label="$t('task.center.detail.capabilities')"
      >
        <Button
          v-for="action in availableActions"
          :key="action"
          :data-action="action"
          :danger="action === 'CANCEL'"
          :loading="busyAction === action"
          :disabled="!!busyAction"
          class="min-h-11 min-w-11"
          type="primary"
          @click="onControl(action)"
        >
          {{ actionLabel(action) }}
        </Button>
      </div>

      <section aria-labelledby="task-summary" class="mb-5">
        <h3 id="task-summary" class="mb-2 text-base font-medium">
          {{ $t('task.center.detail.summary') }}
        </h3>
        <Descriptions :column="1" bordered size="small">
          <DescriptionsItem :label="$t('task.center.field.taskId')">
            {{ displayTask.taskId || '-' }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('task.center.field.taskType')">
            {{ $t(taskAdapter.labelKey) }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('task.center.field.progress')">
            <TaskProgress
              :current="displayTask.progressCurrent"
              :message="displayTask.progressMessage"
              :total="displayTask.progressTotal"
            />
          </DescriptionsItem>
          <DescriptionsItem :label="$t('task.center.field.owner')">
            {{ displayTask.ownerId || '-' }}
          </DescriptionsItem>
        </Descriptions>
      </section>

      <section aria-labelledby="task-schedule" class="mb-5">
        <h3 id="task-schedule" class="mb-2 text-base font-medium">
          {{ $t('task.center.detail.schedule') }}
        </h3>
        <Descriptions :column="1" bordered size="small">
          <DescriptionsItem :label="$t('task.center.field.schedule')">
            {{ formatTime(displayTask.scheduleStartTime) }}
            <span aria-hidden="true"> → </span>
            {{ formatTime(displayTask.scheduleEndTime) }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('task.center.field.createTime')">
            {{ formatTime(displayTask.createTime) }}
          </DescriptionsItem>
        </Descriptions>
      </section>

      <section aria-labelledby="task-counters" class="mb-5">
        <h3 id="task-counters" class="mb-2 text-base font-medium">
          {{ $t('task.center.detail.counters') }}
        </h3>
        <div class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            {{ $t('task.center.status.COMPLETED') }}:
            {{ displayTask.successCount ?? 0 }}
          </div>
          <div>
            {{ $t('task.center.status.FAILED') }}:
            {{ displayTask.failedCount ?? 0 }}
          </div>
          <div>
            {{ $t('task.center.status.MISSED') }}:
            {{ displayTask.missedCount ?? 0 }}
          </div>
          <div>
            {{ $t('task.center.status.CANCELLED') }}:
            {{ displayTask.cancelledCount ?? 0 }}
          </div>
        </div>
      </section>

      <section
        v-if="displayTask.resultSummary || resultView"
        aria-labelledby="task-result"
        class="mb-5"
      >
        <h3 id="task-result" class="mb-2 text-base font-medium">
          {{ $t('task.center.detail.businessSummary') }}
        </h3>
        <p v-if="displayTask.resultSummary" class="break-words text-sm">
          {{ displayTask.resultSummary }}
        </p>
        <a
          v-if="resultView?.href"
          :href="resultView.href"
          class="mt-2 inline-block"
          target="_self"
        >
          {{ $t(resultView.labelKey) }}
        </a>
      </section>

      <TaskExecutionHistory :task-id="displayTask.taskId" />
    </template>
    <div v-else class="text-sm text-muted-foreground">
      {{ $t('task.center.execution.empty') }}
    </div>
  </Drawer>
</template>
