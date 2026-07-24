<script lang="ts" setup>
import type { BusinessTaskApi } from '#/api/task';

import { computed, onMounted, ref, watch } from 'vue';

import { Alert, Button, Spin } from 'ant-design-vue';

import {
  getBusinessTaskExecution,
  getBusinessTaskExecutionPage,
} from '#/api/task';
import { $t } from '#/locales';

const props = defineProps<{
  refreshKey?: number | string;
  taskId?: string;
}>();

const executions = ref<BusinessTaskApi.BusinessTaskExecutionVO[]>([]);
const selectedExecution = ref<BusinessTaskApi.BusinessTaskExecutionDetailVO>();
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref(false);
const hasMore = computed(() => executions.value.length < total.value);
let loadRevision = 0;
let selectionRevision = 0;

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : '-';
}

function sortExecutions(items: BusinessTaskApi.BusinessTaskExecutionVO[]) {
  return items.toSorted(
    (left, right) => (right.plannedAt ?? 0) - (left.plannedAt ?? 0),
  );
}

function mergeExecutions(items: BusinessTaskApi.BusinessTaskExecutionVO[]) {
  const merged = new Map<string, BusinessTaskApi.BusinessTaskExecutionVO>();
  for (const item of [...executions.value, ...items]) {
    if (item.executionId) merged.set(item.executionId, item);
  }
  return sortExecutions([...merged.values()]);
}

async function loadExecutions(reset = true) {
  const revision = ++loadRevision;
  selectionRevision++;
  if (!props.taskId) {
    executions.value = [];
    selectedExecution.value = undefined;
    total.value = 0;
    return;
  }
  const currentSelection = selectedExecution.value?.executionId;
  const nextPage = reset ? 1 : page.value + 1;
  loading.value = true;
  error.value = false;
  try {
    const response = await getBusinessTaskExecutionPage(
      { page: nextPage, size: 20 },
      { sortDirection: 'DESC', sortField: 'plannedAt', taskId: props.taskId },
    );
    if (revision !== loadRevision) return;
    page.value = nextPage;
    total.value = response?.total ?? 0;
    executions.value = reset
      ? sortExecutions(response?.items ?? [])
      : mergeExecutions(response?.items ?? []);
    const selection =
      executions.value.find((item) => item.executionId === currentSelection) ??
      executions.value[0];
    if (selection?.executionId) await selectExecution(selection.executionId);
    else selectedExecution.value = undefined;
  } catch {
    if (revision === loadRevision) error.value = true;
  } finally {
    if (revision === loadRevision) loading.value = false;
  }
}

async function selectExecution(executionId: string) {
  const revision = ++selectionRevision;
  try {
    const detail = await getBusinessTaskExecution(executionId);
    if (revision === selectionRevision) selectedExecution.value = detail;
  } catch {
    if (revision === selectionRevision) error.value = true;
  }
}

function refresh() {
  return loadExecutions(true);
}

defineExpose({ refresh });
onMounted(refresh);
watch(() => props.taskId, refresh);
watch(() => props.refreshKey, refresh);
</script>

<template>
  <section aria-labelledby="task-executions" class="mt-6">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h3 id="task-executions" class="text-base font-medium">
        {{ $t('task.center.detail.executions') }}
      </h3>
      <Button size="small" type="link" :loading="loading" @click="refresh">
        {{ $t('common.refresh') }}
      </Button>
    </div>
    <Alert
      v-if="error"
      class="mb-3"
      type="warning"
      show-icon
      :message="$t('task.center.execution.loadError')"
    >
      <template #action>
        <a @click="refresh">{{ $t('common.retry') }}</a>
      </template>
    </Alert>
    <div v-if="executions.length > 0" class="space-y-2">
      <button
        v-for="execution in executions"
        :key="execution.executionId"
        class="execution-row flex w-full flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="{
          'border-primary':
            execution.executionId === selectedExecution?.executionId,
        }"
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
      <div v-if="hasMore" class="flex justify-center pt-2">
        <Button :loading="loading" @click="loadExecutions(false)">
          {{ $t('task.center.execution.loadMore') }}
        </Button>
      </div>
    </div>
    <div v-else-if="loading" class="grid min-h-24 place-items-center">
      <Spin />
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
