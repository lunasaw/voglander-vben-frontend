<script lang="ts" setup>
import type { BusinessTaskApi } from '#/api/task';

import { onMounted, ref, watch } from 'vue';

import {
  getBusinessTaskExecution,
  getBusinessTaskExecutionPage,
} from '#/api/task';
import { $t } from '#/locales';

const props = defineProps<{ taskId?: string }>();

const executions = ref<BusinessTaskApi.BusinessTaskExecutionVO[]>([]);
const selectedExecution = ref<BusinessTaskApi.BusinessTaskExecutionDetailVO>();

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : '-';
}

async function loadExecutions() {
  if (!props.taskId) {
    executions.value = [];
    selectedExecution.value = undefined;
    return;
  }
  const response = await getBusinessTaskExecutionPage(
    { page: 1, size: 100 },
    { taskId: props.taskId },
  );
  executions.value = response?.items ?? [];
  const first = executions.value[0];
  if (first?.executionId) {
    await selectExecution(first.executionId);
  } else {
    selectedExecution.value = undefined;
  }
}

async function selectExecution(executionId: string) {
  selectedExecution.value = await getBusinessTaskExecution(executionId);
}

onMounted(loadExecutions);
watch(() => props.taskId, loadExecutions);
</script>

<template>
  <section aria-labelledby="task-executions" class="mt-6">
    <h3 id="task-executions" class="mb-2 text-base font-medium">
      {{ $t('task.center.detail.executions') }}
    </h3>
    <div v-if="executions.length > 0" class="space-y-2">
      <button
        v-for="execution in executions"
        :key="execution.executionId"
        class="execution-row flex w-full flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        type="button"
        @click="execution.executionId && selectExecution(execution.executionId)"
      >
        <span class="font-mono text-xs">{{ execution.executionId }}</span>
        <span>{{
          $t(`task.center.status.${execution.state || 'PENDING'}`)
        }}</span>
        <span>
          {{ execution.attemptCount ?? 0 }} /
          {{ execution.maxAttempts ?? 0 }}
        </span>
        <span v-if="execution.failureCode" class="text-destructive">
          {{ execution.failureCode }}
        </span>
      </button>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      {{ $t('task.center.execution.empty') }}
    </p>

    <div v-if="selectedExecution" class="mt-4 rounded border border-border p-3">
      <h4 class="mb-2 text-sm font-medium">
        {{ $t('task.center.execution.events') }}
      </h4>
      <ol v-if="selectedExecution.events?.length" class="space-y-2">
        <li
          v-for="event in selectedExecution.events"
          :key="event.eventId"
          class="event-row border-l-2 border-primary/50 pl-3 text-sm"
        >
          <div class="flex flex-wrap gap-2">
            <span class="font-medium">{{ event.eventType }}</span>
            <time
              class="text-muted-foreground"
              :datetime="event.occurredAt?.toString()"
            >
              {{ formatTime(event.occurredAt) }}
            </time>
          </div>
          <div v-if="event.failureCode" class="text-destructive">
            {{ event.failureCode }}:
            {{ event.failureMessage || $t('task.center.failure.guidance') }}
          </div>
          <div v-if="event.progressMessage" class="text-muted-foreground">
            {{ event.progressMessage }}
          </div>
          <div
            v-if="event.eventData"
            class="break-words text-xs text-muted-foreground"
          >
            {{ event.eventData }}
          </div>
        </li>
      </ol>
      <p v-else class="text-sm text-muted-foreground">
        {{ $t('task.center.execution.empty') }}
      </p>
    </div>
  </section>
</template>
