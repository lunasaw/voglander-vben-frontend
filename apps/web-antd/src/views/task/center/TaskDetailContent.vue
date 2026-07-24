<script lang="ts" setup>
import type { TaskCenterAction } from './utils';

import type { BusinessTaskApi } from '#/api/task';

import { computed } from 'vue';

import { Button, Descriptions, DescriptionsItem, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

import { getTaskTypeAdapter } from './registry';
import TaskExecutionHistory from './TaskExecutionHistory.vue';
import TaskProgress from './TaskProgress.vue';

const props = withDefaults(
  defineProps<{
    availableActions?: TaskCenterAction[];
    busyAction?: TaskCenterAction;
    refreshKey?: number | string;
    showHeader?: boolean;
    showResult?: boolean;
    task?: BusinessTaskApi.BusinessTaskDetailVO;
  }>(),
  {
    availableActions: () => [],
    busyAction: undefined,
    refreshKey: undefined,
    showHeader: true,
    showResult: true,
    task: undefined,
  },
);

const emit = defineEmits<{ control: [action: TaskCenterAction] }>();
const taskAdapter = computed(() => getTaskTypeAdapter(props.task?.taskType));
const resultView = computed(() =>
  taskAdapter.value.resultRenderer?.({ task: props.task }),
);

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : '-';
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
</script>

<template>
  <template v-if="task">
    <div v-if="showHeader" class="mb-4 flex flex-wrap items-center gap-2">
      <span class="text-lg font-semibold">{{
        task.taskName || task.taskId
      }}</span>
      <Tag>{{ $t(taskAdapter.labelKey) }}</Tag>
      <Tag>{{ $t(`task.center.status.${task.state || 'SCHEDULED'}`) }}</Tag>
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
        @click="emit('control', action)"
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
          {{ task.taskId || '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('task.center.field.taskType')">
          {{ $t(taskAdapter.labelKey) }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('task.center.field.progress')">
          <TaskProgress
            :current="task.progressCurrent"
            :message="task.progressMessage"
            :total="task.progressTotal"
          />
        </DescriptionsItem>
        <DescriptionsItem :label="$t('task.center.field.owner')">
          {{ task.ownerId || '-' }}
        </DescriptionsItem>
      </Descriptions>
    </section>

    <section aria-labelledby="task-schedule" class="mb-5">
      <h3 id="task-schedule" class="mb-2 text-base font-medium">
        {{ $t('task.center.detail.schedule') }}
      </h3>
      <Descriptions :column="1" bordered size="small">
        <DescriptionsItem :label="$t('task.center.field.schedule')">
          {{ formatTime(task.scheduleStartTime) }}
          <span aria-hidden="true"> → </span>
          {{ formatTime(task.scheduleEndTime) }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('task.center.field.createTime')">
          {{ formatTime(task.createTime) }}
        </DescriptionsItem>
      </Descriptions>
    </section>

    <section aria-labelledby="task-counters" class="mb-5">
      <h3 id="task-counters" class="mb-2 text-base font-medium">
        {{ $t('task.center.detail.counters') }}
      </h3>
      <div class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          {{ $t('task.center.status.COMPLETED') }}: {{ task.successCount ?? 0 }}
        </div>
        <div>
          {{ $t('task.center.status.FAILED') }}: {{ task.failedCount ?? 0 }}
        </div>
        <div>
          {{ $t('task.center.status.MISSED') }}: {{ task.missedCount ?? 0 }}
        </div>
        <div>
          {{ $t('task.center.status.CANCELLED') }}:
          {{ task.cancelledCount ?? 0 }}
        </div>
      </div>
    </section>

    <section
      v-if="showResult && (task.resultSummary || resultView)"
      aria-labelledby="task-result"
      class="mb-5"
    >
      <h3 id="task-result" class="mb-2 text-base font-medium">
        {{ $t('task.center.detail.businessSummary') }}
      </h3>
      <p v-if="task.resultSummary" class="break-words text-sm">
        {{ task.resultSummary }}
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

    <TaskExecutionHistory :refresh-key="refreshKey" :task-id="task.taskId" />
  </template>
  <div v-else class="text-sm text-muted-foreground">
    {{ $t('task.center.execution.empty') }}
  </div>
</template>
