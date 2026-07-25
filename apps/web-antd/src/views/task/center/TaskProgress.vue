<script lang="ts" setup>
import { computed } from 'vue';

import { Progress } from 'ant-design-vue';

import { $t } from '#/locales';

import { presentTaskProgress } from './utils';

const props = withDefaults(
  defineProps<{
    current?: number;
    message?: string;
    total?: number;
  }>(),
  { current: 0, message: undefined, total: 0 },
);

const presentation = computed(() =>
  presentTaskProgress(
    props.current,
    props.total,
    props.message || $t('task.center.progress.indeterminate'),
  ),
);
</script>

<template>
  <div
    class="flex min-w-28 items-center gap-2 text-xs text-foreground dark:text-foreground"
    role="progressbar"
    :aria-label="presentation.ariaLabel"
    :aria-valuemax="presentation.mode === 'quantified' ? 100 : undefined"
    :aria-valuenow="presentation.percent"
  >
    <Progress
      v-if="presentation.mode === 'quantified'"
      class="min-w-16 flex-1"
      :percent="presentation.percent"
      :show-info="false"
      size="small"
    />
    <span
      v-else
      aria-hidden="true"
      class="indeterminate size-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
    ></span>
    <span class="whitespace-nowrap">{{ presentation.text }}</span>
    <span v-if="props.message" class="sr-only">{{ props.message }}</span>
  </div>
</template>
