<script lang="ts" setup>
import type { UploadFile } from 'ant-design-vue';

import type { ImageApi } from '#/api/image';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';

import { Alert, Image, message, Modal, Upload } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getImageAssetConstraints, uploadImageAsset } from '#/api/image';
import { $t } from '#/locales';
import {
  fileSelectionToken,
  stableFingerprint,
  useIdempotentSubmit,
} from '#/views/image/shared/idempotent-submit';
import { formatBytes } from '#/views/image/shared/image-presentation';

import { inspectImageFile } from '../upload-validation';

const emit = defineEmits<{ success: [] }>();
const { hasAccessByCodes } = useAccess();

const constraints = ref<ImageApi.AssetConstraintsVO>();
const constraintsError = ref(false);
const file = ref<File>();
const fileList = ref<UploadFile[]>([]);
const previewUrl = ref<string>();
const validation = ref<Awaited<ReturnType<typeof inspectImageFile>>>();
const validationBusy = ref(false);
const submit = useIdempotentSubmit();

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true },
  handleValuesChange(values) {
    if (file.value) submit.contentChanged(uploadFingerprint(values.assetName));
  },
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 160, showCount: true },
      fieldName: 'assetName',
      label: $t('image.assets.field.name'),
    },
  ],
  showDefaultActions: false,
});

const validationMessage = computed(() => {
  if (!validation.value || validation.value.valid) return undefined;
  return $t(`image.assets.upload.validation.${validation.value.code}`);
});

const constraintsMessage = computed(() => {
  if (!constraints.value) return $t('image.assets.upload.constraintsLoading');
  return $t('image.assets.upload.constraints', [
    (constraints.value.formats ?? []).join(' / '),
    formatBytes(constraints.value.maxUploadBytes),
    constraints.value.maxPixels?.toLocaleString() ?? '-',
  ]);
});

function uploadFingerprint(assetName?: string) {
  return stableFingerprint({
    assetName: assetName?.trim() ?? '',
    file: file.value ? fileSelectionToken(file.value) : undefined,
  });
}

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = undefined;
}

function reset() {
  clearPreview();
  constraints.value = undefined;
  constraintsError.value = false;
  file.value = undefined;
  fileList.value = [];
  validation.value = undefined;
  validationBusy.value = false;
  submit.reset();
  void formApi.resetForm();
}

async function validateSelection() {
  if (!file.value || !constraints.value) return;
  const current = file.value;
  validationBusy.value = true;
  const result = await inspectImageFile(current, constraints.value);
  if (current === file.value) validation.value = result;
  validationBusy.value = false;
}

async function selectFile(selected: File) {
  clearPreview();
  file.value = selected;
  fileList.value = [
    {
      name: selected.name,
      originFileObj: selected as UploadFile['originFileObj'],
      uid: fileSelectionToken(selected),
    },
  ];
  previewUrl.value = URL.createObjectURL(selected);
  validation.value = undefined;
  await formApi.setValues({
    assetName: selected.name.replace(/\.[^.]+$/, ''),
  });
  submit.contentChanged(
    uploadFingerprint(selected.name.replace(/\.[^.]+$/, '')),
  );
  await validateSelection();
}

function beforeUpload(selected: File) {
  void selectFile(selected);
  return false;
}

function removeFile() {
  clearPreview();
  file.value = undefined;
  fileList.value = [];
  validation.value = undefined;
  submit.reset();
  return true;
}

async function loadConstraints() {
  constraintsError.value = false;
  try {
    constraints.value = await getImageAssetConstraints();
    await validateSelection();
  } catch {
    constraintsError.value = true;
  }
}

function confirmUnknownClose() {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      content: $t('image.assets.upload.unknownClose'),
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: $t('image.assets.upload.unknownTitle'),
    });
  });
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onBeforeClose() {
    return submit.isUnknownResult.value ? confirmUnknownClose() : true;
  },
  onConfirm: submitUpload,
  onOpenChange(isOpen) {
    if (!isOpen) {
      reset();
      return;
    }
    reset();
    void loadConstraints();
  },
});

async function submitUpload() {
  if (!hasAccessByCodes(['Image:Asset:Upload'])) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  if (!file.value || !constraints.value) return;
  const values = await formApi.getValues<{ assetName?: string }>();
  if (!validation.value) await validateSelection();
  if (!validation.value?.valid) return;

  const fingerprint = uploadFingerprint(values.assetName);
  const idempotencyKey = submit.begin(fingerprint);
  drawerApi.lock();
  try {
    await uploadImageAsset(
      file.value,
      idempotencyKey,
      values.assetName?.trim(),
    );
    submit.succeed();
    message.success($t('image.assets.upload.success'));
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
        ? $t('image.assets.action.retryUpload')
        : $t('image.assets.action.upload'),
    });
  },
);
</script>

<template>
  <Drawer
    class="w-full max-w-[560px]"
    :title="$t('image.assets.action.upload')"
  >
    <div class="grid gap-4">
      <Upload.Dragger
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        :before-upload="beforeUpload"
        :file-list="fileList"
        :max-count="1"
        :multiple="false"
        @remove="removeFile"
      >
        <p class="font-medium">{{ $t('image.assets.upload.dropTitle') }}</p>
        <p class="text-muted-foreground">
          {{ $t('image.assets.upload.dropHint') }}
        </p>
      </Upload.Dragger>

      <div v-if="file" class="asset-upload-preview">
        <Image
          v-if="previewUrl"
          :alt="file.name"
          :preview="false"
          :src="previewUrl"
          class="asset-upload-preview__image"
        />
        <div class="min-w-0">
          <strong class="block truncate">{{ file.name }}</strong>
          <span class="text-muted-foreground text-xs">
            {{ formatBytes(file.size) }}
            <template v-if="validation?.valid">
              · {{ validation.format }} · {{ validation.width }} ×
              {{ validation.height }}
            </template>
          </span>
        </div>
      </div>

      <Form />

      <Alert
        v-if="constraintsError"
        type="error"
        show-icon
        :message="$t('image.assets.upload.constraintsError')"
      >
        <template #action>
          <a @click="loadConstraints">{{ $t('common.retry') }}</a>
        </template>
      </Alert>
      <Alert v-else type="info" show-icon :message="constraintsMessage" />
      <Alert
        v-if="validationMessage"
        type="error"
        show-icon
        :message="validationMessage"
      />
      <Alert
        v-if="validationBusy"
        type="info"
        show-icon
        :message="$t('image.assets.upload.validating')"
      />
      <Alert
        v-if="submit.errorMeta.value"
        :type="submit.isUnknownResult.value ? 'warning' : 'error'"
        show-icon
        :message="
          submit.isUnknownResult.value
            ? $t('image.assets.error.uploadRetry')
            : submit.errorMeta.value.message
        "
      />
    </div>
  </Drawer>
</template>

<style scoped>
.asset-upload-preview {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.asset-upload-preview__image,
.asset-upload-preview__image :deep(img) {
  width: 96px;
  height: 72px;
  object-fit: cover;
  border-radius: calc(var(--radius) - 2px);
}
</style>
