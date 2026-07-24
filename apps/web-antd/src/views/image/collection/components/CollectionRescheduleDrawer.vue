<script lang="ts" setup>
import type CollectionScheduleFields from './CollectionScheduleFields.vue';
import type { CollectionScheduleValue } from './CollectionScheduleFields.vue';

import type { ImageApi } from '#/api/image';

import { ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';

import { Alert, Descriptions, DescriptionsItem, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import {
  getImageCollection,
  getImageCollectionConstraints,
  rescheduleImageCollection,
} from '#/api/image';
import { $t } from '#/locales';
import { collectionActionAllowed } from '#/views/image/shared/image-permissions';

import ScheduleFields from './CollectionScheduleFields.vue';

const emit = defineEmits<{ success: [] }>();
const { hasAccessByCodes } = useAccess();
const task = ref<ImageApi.CollectionVO>();
const constraints = ref<ImageApi.CollectionConstraints>();
const schedule = ref<CollectionScheduleValue>({});
const scheduleRef = ref<InstanceType<typeof CollectionScheduleFields>>();
const errorMessage = ref<string>();

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true },
  schema: [
    {
      component: 'Textarea',
      componentProps: { maxlength: 300, rows: 3, showCount: true },
      fieldName: 'reason',
      label: $t('image.collections.field.reason'),
    },
  ],
  showDefaultActions: false,
});

function permissions() {
  return {
    canControlImage: hasAccessByCodes(['Image:Collection:Control']),
    canControlTask: hasAccessByCodes(['Task:Control']),
  };
}

async function initialize(value: ImageApi.CollectionVO) {
  task.value = value;
  constraints.value = undefined;
  errorMessage.value = undefined;
  schedule.value = {
    intervalSeconds: value.intervalSeconds,
    range:
      value.scheduleStartTime !== undefined &&
      value.scheduleEndTime !== undefined
        ? [dayjs(value.scheduleStartTime), dayjs(value.scheduleEndTime)]
        : undefined,
  };
  await formApi.resetForm();
  try {
    constraints.value = await getImageCollectionConstraints();
  } catch {
    errorMessage.value = $t('image.collections.create.constraintsError');
  }
}

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: submit,
  onOpenChange(isOpen) {
    if (isOpen) void initialize(drawerApi.getData<ImageApi.CollectionVO>());
  },
});

async function submit() {
  if (
    !task.value ||
    !collectionActionAllowed(task.value, 'RESCHEDULE', permissions())
  ) {
    message.error($t('image.collections.error.stateConflict'));
    return;
  }
  if (!scheduleRef.value?.validate()) return;
  const fields = scheduleRef.value.toRequestFields();
  if (
    fields.scheduleStartTime === undefined ||
    fields.scheduleEndTime === undefined ||
    fields.intervalSeconds === undefined
  ) {
    return;
  }
  const values = await formApi.getValues<{ reason?: string }>();
  drawerApi.lock();
  errorMessage.value = undefined;
  try {
    task.value = await rescheduleImageCollection(task.value.taskId, {
      expectedVersion: task.value.version as number,
      intervalSeconds: fields.intervalSeconds,
      reason: values.reason?.trim(),
      scheduleEndTime: fields.scheduleEndTime,
      scheduleStartTime: fields.scheduleStartTime,
    });
    message.success($t('image.collections.reschedule.success'));
    await drawerApi.close();
    emit('success');
  } catch {
    errorMessage.value = $t('image.collections.error.stateConflict');
    try {
      task.value = await getImageCollection(task.value.taskId);
    } catch {
      // Keep the user's timing input visible even if the authority refresh fails.
    }
  } finally {
    drawerApi.unlock();
  }
}
</script>

<template>
  <Drawer
    class="w-full max-w-[640px]"
    :title="$t('image.collections.action.reschedule')"
  >
    <div v-if="task" class="collection-reschedule">
      <Descriptions bordered :column="1" size="small">
        <DescriptionsItem :label="$t('image.collections.field.name')">
          {{ task.taskName || task.taskId }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.collections.field.camera')">
          {{ task.deviceName || task.deviceId }} /
          {{ task.channelName || task.channelId }}
        </DescriptionsItem>
      </Descriptions>
      <ScheduleFields
        ref="scheduleRef"
        v-model="schedule"
        :constraints="constraints"
        mode="SCHEDULED"
      />
      <Form />
      <Alert
        v-if="errorMessage"
        type="error"
        show-icon
        :message="errorMessage"
      />
    </div>
  </Drawer>
</template>

<style scoped>
.collection-reschedule {
  display: grid;
  gap: 16px;
}
</style>
