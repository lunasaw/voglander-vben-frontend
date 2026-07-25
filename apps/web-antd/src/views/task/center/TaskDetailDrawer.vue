<script lang="ts" setup>
import type { TaskCenterAction } from './utils';

import type { BusinessTaskApi } from '#/api/task';

import { computed, nextTick, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Drawer, message, Modal } from 'ant-design-vue';

import {
  cancelBusinessTask,
  getBusinessTask,
  pauseBusinessTask,
  resumeBusinessTask,
  retryBusinessTask,
} from '#/api/task';
import { $t } from '#/locales';

import TaskDetailContent from './TaskDetailContent.vue';
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
const refreshKey = ref(0);
const { hasAccessByCodes } = useAccess();

const displayTask = computed(() => loadedTask.value ?? props.task);
const availableActions = computed(() =>
  getTaskActions({
    capabilities: displayTask.value?.capabilities,
    permissions: hasAccessByCodes(['Task:Control']) ? ['Task:Control'] : [],
    state: displayTask.value?.state,
  }),
);

watch(
  () => [props.open, props.taskId] as const,
  async ([open, taskId]) => {
    if (open && taskId && !props.task)
      loadedTask.value = await getBusinessTask(taskId);
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
  return $t(
    {
      CANCEL: 'task.center.action.cancel',
      MANUAL_RETRY: 'task.center.action.retry',
      PAUSE: 'task.center.action.pause',
      RESUME: 'task.center.action.resume',
    }[action],
  );
}

function confirmAction(action: TaskCenterAction) {
  return new Promise<boolean>((resolve) => {
    const messageKey: Record<TaskCenterAction, string> = {
      CANCEL: 'task.center.message.cancelConfirm',
      MANUAL_RETRY: 'task.center.message.retryConfirm',
      PAUSE: 'task.center.message.pauseConfirm',
      RESUME: 'task.center.message.resumeConfirm',
    };
    Modal.confirm({
      cancelText: $t('common.cancel'),
      content: $t(messageKey[action]),
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: actionLabel(action),
    });
  });
}

async function refreshTask() {
  if (displayTask.value?.taskId) {
    loadedTask.value = await getBusinessTask(displayTask.value.taskId);
    refreshKey.value++;
  }
}

async function onControl(action: TaskCenterAction) {
  if (
    !hasAccessByCodes(['Task:Control']) ||
    !displayTask.value?.taskId ||
    busyAction.value ||
    !availableActions.value.includes(action)
  ) {
    message.error($t('task.center.message.permissionDenied'));
    return;
  }
  if (!(await confirmAction(action))) return;
  busyAction.value = action;
  try {
    const task = displayTask.value;
    const taskId = task.taskId as string;
    switch (action) {
      case 'CANCEL': {
        loadedTask.value = await cancelBusinessTask(taskId, {
          expectedVersion: task.version,
        });
        break;
      }
      case 'MANUAL_RETRY': {
        const executionId =
          task.lastExecutionId ?? task.activeExecution?.executionId;
        if (!executionId) throw new Error('execution is unavailable');
        loadedTask.value = await retryBusinessTask(taskId, {
          executionId,
          idempotencyKey: `manual-retry:${taskId}:${executionId}`,
        });
        break;
      }
      case 'PAUSE': {
        loadedTask.value = await pauseBusinessTask(taskId, {
          expectedVersion: task.version,
        });
        break;
      }
      default: {
        loadedTask.value = await resumeBusinessTask(taskId, {
          expectedVersion: task.version,
        });
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
    <TaskDetailContent
      :available-actions="availableActions"
      :busy-action="busyAction"
      :refresh-key="refreshKey"
      :task="displayTask"
      @control="onControl"
    />
  </Drawer>
</template>
