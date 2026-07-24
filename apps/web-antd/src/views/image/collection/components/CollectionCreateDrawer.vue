<script lang="ts" setup>
import type CollectionScheduleFields from './CollectionScheduleFields.vue';
import type { CollectionScheduleValue } from './CollectionScheduleFields.vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { ImageApi, ImageCollectionMode } from '#/api/image';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';

import { Alert, message, Modal } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createImageCollection,
  getImageCollectionConstraints,
} from '#/api/image';
import { $t } from '#/locales';
import {
  stableFingerprint,
  useIdempotentSubmit,
} from '#/views/image/shared/idempotent-submit';

import { COLLECTION_MODES, normalizedCollectionFingerprint } from '../data';
import { useCameraOptions } from '../use-camera-options';
import ScheduleFields from './CollectionScheduleFields.vue';

interface DrawerPayload {
  channelId?: string;
  deviceId?: string;
}

interface CreateFormValues {
  channelId?: string;
  collectionMode?: ImageCollectionMode;
  deviceId?: string;
  retentionPolicy?: string;
  taskName?: string;
}

const emit = defineEmits<{ success: [] }>();
const { hasAccessByCodes } = useAccess();
const camera = useCameraOptions();
const constraints = ref<ImageApi.CollectionConstraints>();
const constraintsError = ref(false);
const mode = ref<ImageCollectionMode>('ONCE');
const schedule = ref<CollectionScheduleValue>({});
const scheduleRef = ref<InstanceType<typeof CollectionScheduleFields>>();
const validationError = ref<string>();
const submit = useIdempotentSubmit();
let initializing = false;

function reachedBottom(event: Event) {
  const target = event.target as HTMLElement;
  return target.scrollTop + target.clientHeight >= target.scrollHeight - 24;
}

function formSchema(): VbenFormSchema[] {
  const supportedModes = COLLECTION_MODES.filter((value) =>
    constraints.value?.modes?.includes(value),
  );
  return [
    {
      component: 'Input',
      componentProps: { maxlength: 160, showCount: true },
      fieldName: 'taskName',
      label: $t('image.collections.field.name'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: supportedModes.map((value) => ({
          label: $t(`image.collections.mode.${value}`),
          value,
        })),
      },
      fieldName: 'collectionMode',
      label: $t('image.collections.field.mode'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        filterOption: false,
        loading: camera.deviceLoading.value,
        onPopupScroll: (event: Event) =>
          reachedBottom(event) && camera.loadMoreDevices(),
        onSearch: camera.searchDevices,
        options: camera.devices.value,
        placeholder: $t('image.collections.camera.devicePlaceholder'),
        showSearch: true,
      }),
      fieldName: 'deviceId',
      label: $t('image.collections.field.deviceId'),
    },
    {
      component: 'Select',
      componentProps: (values) => ({
        allowClear: true,
        disabled: !values.deviceId,
        filterOption: false,
        loading: camera.channelLoading.value,
        onPopupScroll: (event: Event) =>
          reachedBottom(event) && camera.loadMoreChannels(),
        onSearch: (keyword: string) =>
          camera.searchChannels(values.deviceId as string, keyword),
        options: camera.channels.value,
        placeholder: $t('image.collections.camera.channelPlaceholder'),
        showSearch: true,
      }),
      fieldName: 'channelId',
      label: $t('image.collections.field.channelId'),
    },
    ...(constraints.value?.retentionPolicies?.length
      ? [
          {
            component: 'Select' as const,
            componentProps: {
              options: constraints.value.retentionPolicies.map((value) => ({
                label: value,
                value,
              })),
            },
            fieldName: 'retentionPolicy',
            label: $t('image.collections.field.retentionPolicy'),
          },
        ]
      : []),
  ];
}

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true },
  handleValuesChange(values, fieldsChanged) {
    mode.value = (values.collectionMode as ImageCollectionMode) ?? 'ONCE';
    if (!initializing && fieldsChanged.includes('deviceId')) {
      void formApi.setFieldValue('channelId', undefined);
      camera.clearChannels();
      if (values.deviceId) {
        void camera.queryChannels(values.deviceId as string);
      }
    }
    if (!initializing) void markContentChanged(values as CreateFormValues);
  },
  schema: formSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

async function buildRequest(values?: CreateFormValues) {
  const formValues = values ?? (await formApi.getValues<CreateFormValues>());
  return {
    channelId: formValues.channelId?.trim() ?? '',
    collectionMode: formValues.collectionMode ?? mode.value,
    deviceId: formValues.deviceId?.trim() ?? '',
    retentionPolicy: formValues.retentionPolicy,
    ...scheduleRef.value?.toRequestFields(),
    taskName: formValues.taskName?.trim() ?? '',
  } as ImageApi.CollectionCreateReq;
}

async function markContentChanged(values?: CreateFormValues) {
  const request = await buildRequest(values);
  submit.contentChanged(
    stableFingerprint(normalizedCollectionFingerprint(request)),
  );
}

watch(schedule, () => void markContentChanged(), { deep: true });

function reset() {
  constraints.value = undefined;
  constraintsError.value = false;
  validationError.value = undefined;
  schedule.value = {};
  mode.value = 'ONCE';
  submit.reset();
  camera.clearChannels();
  void formApi.resetForm();
}

async function initialize(payload: DrawerPayload) {
  reset();
  initializing = true;
  try {
    constraints.value = await getImageCollectionConstraints();
    formApi.setState({ schema: formSchema() });
    const supported = COLLECTION_MODES.filter((value) =>
      constraints.value?.modes?.includes(value),
    );
    mode.value = supported.includes('ONCE') ? 'ONCE' : (supported[0] ?? 'ONCE');
    await Promise.all([
      camera.queryDevices(),
      payload.deviceId ? camera.resolveDevice(payload.deviceId) : undefined,
    ]);
    await formApi.setValues({
      collectionMode: mode.value,
      deviceId: payload.deviceId,
      retentionPolicy: constraints.value.retentionPolicies?.[0],
      taskName: '',
    });
    if (payload.deviceId) {
      await camera.queryChannels(payload.deviceId);
      if (payload.channelId) {
        await camera.resolveChannel(payload.deviceId, payload.channelId);
        await formApi.setFieldValue('channelId', payload.channelId);
      }
    }
  } catch {
    constraintsError.value = true;
  } finally {
    initializing = false;
  }
}

function confirmUnknownClose() {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      content: $t('image.collections.create.unknownClose'),
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: $t('image.collections.create.unknownTitle'),
    });
  });
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onBeforeClose() {
    return submit.isUnknownResult.value ? confirmUnknownClose() : true;
  },
  onConfirm: submitCollection,
  onOpenChange(isOpen) {
    if (!isOpen) {
      reset();
      return;
    }
    void initialize(drawerApi.getData<DrawerPayload>() ?? {});
  },
});

async function submitCollection() {
  if (!hasAccessByCodes(['Image:Collection:Create'])) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  const request = await buildRequest();
  const modeSupported = constraints.value?.modes?.includes(
    request.collectionMode,
  );
  const selectedChannel = camera.channels.value.find(
    (option) => option.value === request.channelId,
  );
  const selectedDevice = camera.devices.value.find(
    (option) => option.value === request.deviceId,
  );
  if (
    !request.taskName ||
    !request.deviceId ||
    !request.channelId ||
    !modeSupported ||
    selectedDevice?.missing ||
    selectedChannel?.disabled ||
    selectedChannel?.missing ||
    !scheduleRef.value?.validate()
  ) {
    validationError.value = $t('image.collections.error.invalid');
    return;
  }
  validationError.value = undefined;
  const fingerprint = stableFingerprint(
    normalizedCollectionFingerprint(request),
  );
  const idempotencyKey = submit.begin(fingerprint);
  drawerApi.lock();
  try {
    await createImageCollection(request, idempotencyKey);
    submit.succeed();
    message.success($t('image.collections.create.success'));
    await drawerApi.close();
    emit('success');
  } catch (error) {
    submit.fail(error);
  } finally {
    drawerApi.unlock();
  }
}

watch(
  () => submit.isUnknownResult.value,
  (unknown) => {
    drawerApi.setState({
      confirmText: unknown
        ? $t('image.collections.action.retryCreate')
        : $t('image.collections.action.create'),
    });
  },
);

const cameraError = computed(
  () => camera.deviceError.value || camera.channelError.value,
);
</script>

<template>
  <Drawer
    class="w-full max-w-[640px]"
    :title="$t('image.collections.action.create')"
  >
    <div class="collection-create">
      <Alert
        v-if="constraintsError"
        type="error"
        show-icon
        :message="$t('image.collections.create.constraintsError')"
      >
        <template #action>
          <a @click="initialize(drawerApi.getData())">{{
            $t('common.retry')
          }}</a>
        </template>
      </Alert>
      <Form />
      <Alert
        v-if="cameraError"
        type="warning"
        show-icon
        :message="$t('image.collections.camera.loadError')"
      />
      <ScheduleFields
        ref="scheduleRef"
        v-model="schedule"
        :constraints="constraints"
        :mode="mode"
      />
      <Alert
        v-if="validationError"
        type="error"
        show-icon
        :message="validationError"
      />
      <Alert
        v-if="submit.errorMeta.value"
        :type="submit.isUnknownResult.value ? 'warning' : 'error'"
        show-icon
        :message="
          submit.isUnknownResult.value
            ? $t('image.collections.error.unknown')
            : submit.errorMeta.value.message
        "
      />
    </div>
  </Drawer>
</template>

<style scoped>
.collection-create {
  display: grid;
  gap: 16px;
}
</style>
