<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { ImageApi, ImageCollectionMode } from '#/api/image';

import { computed } from 'vue';

import { Alert, DatePicker, Form, FormItem, InputNumber } from 'ant-design-vue';
import dayjs from 'dayjs';

import { $t } from '#/locales';
import { formatDateTime } from '#/views/image/shared/image-presentation';

import { inclusivePlanCount } from '../data';

export interface CollectionScheduleValue {
  intervalSeconds?: number;
  range?: [Dayjs, Dayjs];
}

const props = withDefaults(
  defineProps<{
    constraints?: ImageApi.CollectionConstraints;
    disabled?: boolean;
    mode: ImageCollectionMode;
    modelValue: CollectionScheduleValue;
  }>(),
  { constraints: undefined, disabled: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: CollectionScheduleValue];
}>();

const start = computed(() => props.modelValue.range?.[0]?.valueOf());
const end = computed(() => props.modelValue.range?.[1]?.valueOf());
const count = computed(() =>
  inclusivePlanCount(start.value, end.value, props.modelValue.intervalSeconds),
);

const errorKey = computed(() => {
  if (props.mode !== 'SCHEDULED') return undefined;
  if (start.value === undefined || end.value === undefined) {
    return 'image.collections.schedule.validation.range';
  }
  if (end.value < start.value) {
    return 'image.collections.schedule.validation.order';
  }
  if (
    !props.modelValue.intervalSeconds ||
    !Number.isInteger(props.modelValue.intervalSeconds) ||
    props.modelValue.intervalSeconds <
      (props.constraints?.minIntervalSeconds ?? 1)
  ) {
    return 'image.collections.schedule.validation.interval';
  }
  if (
    props.constraints?.maxPlannedCount &&
    count.value > props.constraints.maxPlannedCount
  ) {
    return 'image.collections.schedule.validation.count';
  }
  return undefined;
});

const summary = computed(() =>
  $t('image.collections.schedule.summary', [
    formatDateTime(start.value),
    formatDateTime(end.value),
    props.modelValue.intervalSeconds ?? '-',
    count.value,
  ]),
);

function updateRange(value?: [Dayjs, Dayjs] | [string, string]) {
  emit('update:modelValue', {
    ...props.modelValue,
    range: value
      ? [
          typeof value[0] === 'string' ? dayjs(value[0]) : value[0],
          typeof value[1] === 'string' ? dayjs(value[1]) : value[1],
        ]
      : undefined,
  });
}

function updateInterval(value: null | number | string) {
  const parsed = value === null ? undefined : Number(value);
  emit('update:modelValue', {
    ...props.modelValue,
    intervalSeconds: Number.isFinite(parsed) ? parsed : undefined,
  });
}

function validate() {
  return props.mode !== 'SCHEDULED' || !errorKey.value;
}

function toRequestFields() {
  if (props.mode !== 'SCHEDULED') return {};
  return {
    intervalSeconds: props.modelValue.intervalSeconds,
    scheduleEndTime: end.value,
    scheduleStartTime: start.value,
  };
}

defineExpose({ count, toRequestFields, validate });
</script>

<template>
  <section v-if="mode === 'SCHEDULED'" class="collection-schedule">
    <h3 class="collection-schedule__title">
      {{ $t('image.collections.schedule.title') }}
    </h3>
    <Form layout="vertical">
      <FormItem :label="$t('image.collections.field.scheduleRange')" required>
        <DatePicker.RangePicker
          class="w-full"
          :disabled="disabled"
          :value="modelValue.range"
          show-time
          @update:value="updateRange"
        />
      </FormItem>
      <FormItem :label="$t('image.collections.field.interval')" required>
        <InputNumber
          class="w-full"
          :disabled="disabled"
          :min="constraints?.minIntervalSeconds ?? 1"
          :precision="0"
          :value="modelValue.intervalSeconds"
          @update:value="updateInterval"
        >
          <template #addonAfter>
            {{ $t('image.collections.schedule.seconds') }}
          </template>
        </InputNumber>
      </FormItem>
    </Form>
    <Alert
      :type="errorKey ? 'error' : 'info'"
      show-icon
      :message="errorKey ? $t(errorKey) : summary"
    />
  </section>
</template>

<style scoped>
.collection-schedule {
  display: grid;
  gap: 8px;
  padding-top: 4px;
}

.collection-schedule__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}
</style>
