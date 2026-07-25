<script lang="ts" setup>
import type { ImageApi } from '#/api/image';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Empty,
  Image,
  message,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import { downloadImageAssetBlob, getImageAsset } from '#/api/image';
import { useImagePreview } from '#/composables/useImagePreview';
import { $t } from '#/locales';
import {
  assetStatusColor,
  assetStatusKey,
  filenameFromContentDisposition,
  formatBytes,
  formatDateTime,
  imageFormatLabel,
  suggestedAssetFilename,
} from '#/views/image/shared/image-presentation';
import { imageCameraLabel } from '#/views/image/shared/image-source';

import { assetActionAllowed } from '../data';

interface DrawerPayload {
  asset: ImageApi.AssetVO;
  canDelete: boolean;
}

const emit = defineEmits<{
  action: [action: 'delete' | 'retryDelete', asset: ImageApi.AssetVO];
  closed: [];
}>();

const detail = ref<ImageApi.AssetVO>();
const canDelete = ref(false);
const detailLoading = ref(false);
const detailError = ref(false);
const imageUrl = ref<string>();
const imageLoading = ref(false);
const imageError = ref(false);
const downloadBusy = ref(false);
const preview = useImagePreview();
let request: AbortController | undefined;
let previewAssetId: string | undefined;
let imageRevision = 0;

const source = computed(() => detail.value?.source);

function releasePreview() {
  imageRevision++;
  if (previewAssetId) preview.release(previewAssetId, 'content');
  previewAssetId = undefined;
  imageUrl.value = undefined;
}

async function loadImage(assetId: string, retry = false) {
  const revision = ++imageRevision;
  imageLoading.value = true;
  imageError.value = false;
  try {
    if (!previewAssetId) {
      previewAssetId = assetId;
      const url = await preview.load(assetId, 'content');
      if (revision === imageRevision) imageUrl.value = url;
    } else if (retry) {
      const url = await preview.retry(assetId, 'content');
      if (revision === imageRevision) imageUrl.value = url;
    }
  } catch (error) {
    if (
      revision === imageRevision &&
      (error as { name?: string })?.name !== 'AbortError'
    ) {
      imageError.value = true;
    }
  } finally {
    if (revision === imageRevision) imageLoading.value = false;
  }
}

async function loadDetail(asset: ImageApi.AssetVO) {
  request?.abort();
  const currentRequest = new AbortController();
  request = currentRequest;
  detail.value = asset;
  detailLoading.value = true;
  detailError.value = false;
  releasePreview();
  await Promise.all([
    getImageAsset(asset.assetId, currentRequest.signal)
      .then((value) => {
        if (!currentRequest.signal.aborted) detail.value = value;
      })
      .catch(() => {
        if (!currentRequest.signal.aborted) detailError.value = true;
      })
      .finally(() => {
        if (!currentRequest.signal.aborted) detailLoading.value = false;
      }),
    loadImage(asset.assetId),
  ]);
}

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (!isOpen) {
      request?.abort();
      releasePreview();
      emit('closed');
      return;
    }
    const payload = drawerApi.getData<DrawerPayload>();
    canDelete.value = payload.canDelete;
    void loadDetail(payload.asset);
  },
});

async function copy(value?: string) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  message.success($t('image.common.copied'));
}

async function download() {
  if (!detail.value || downloadBusy.value) return;
  downloadBusy.value = true;
  try {
    const response = await downloadImageAssetBlob(detail.value.assetId);
    const url = URL.createObjectURL(response.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      filenameFromContentDisposition(response.contentDisposition) ??
      suggestedAssetFilename(detail.value);
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    message.error($t('image.assets.error.download'));
  } finally {
    downloadBusy.value = false;
  }
}
</script>

<template>
  <Drawer class="w-full max-w-[720px]" :title="$t('image.assets.detail.title')">
    <div class="asset-detail">
      <div class="asset-detail__preview">
        <Spin v-if="imageLoading" />
        <Image
          v-else-if="imageUrl"
          :alt="detail?.assetName || detail?.assetId"
          :src="imageUrl"
          class="asset-detail__image"
        />
        <Empty
          v-else-if="imageError"
          :description="$t('image.assets.error.preview')"
        >
          <Button
            type="primary"
            @click="detail && loadImage(detail.assetId, true)"
          >
            {{ $t('common.retry') }}
          </Button>
        </Empty>
      </div>

      <Alert
        v-if="detailError"
        type="error"
        show-icon
        :message="$t('image.assets.error.detail')"
      >
        <template #action>
          <a v-if="detail" @click="loadDetail(detail)">{{
            $t('common.retry')
          }}</a>
        </template>
      </Alert>

      <Descriptions
        v-if="detail"
        bordered
        :column="{ xs: 1, sm: 2 }"
        size="small"
        :loading="detailLoading"
      >
        <DescriptionsItem :label="$t('image.assets.field.name')">
          {{ detail.assetName || detail.assetId }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.status')">
          <Tag :color="assetStatusColor(detail.status)">
            {{ $t(assetStatusKey(detail.status)) }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.format')">
          {{ imageFormatLabel(detail.imageFormat) }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.dimensions')">
          {{ detail.width ?? '-' }} × {{ detail.height ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.size')">
          {{ formatBytes(detail.fileSize) }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.source')">
          {{
            $t(
              `image.assets.source.${detail.sourceType ?? source?.sourceType ?? 'unknown'}`,
            )
          }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.camera')" :span="2">
          {{ imageCameraLabel(source) }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.capturedAt')">
          {{ formatDateTime(detail.capturedAt) }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.ingestedAt')">
          {{ formatDateTime(detail.ingestedAt) }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('image.assets.field.assetId')" :span="2">
          <Space>
            <code>{{ detail.assetId }}</code>
            <Button size="small" type="link" @click="copy(detail.assetId)">
              {{ $t('common.copy') }}
            </Button>
          </Space>
        </DescriptionsItem>
        <DescriptionsItem
          v-if="detail.sourceTaskId ?? source?.sourceTaskId"
          :label="$t('image.assets.field.sourceTaskId')"
          :span="2"
        >
          <Space>
            <code>{{ detail.sourceTaskId ?? source?.sourceTaskId }}</code>
            <Button
              size="small"
              type="link"
              @click="copy(detail.sourceTaskId ?? source?.sourceTaskId)"
            >
              {{ $t('common.copy') }}
            </Button>
          </Space>
        </DescriptionsItem>
        <DescriptionsItem
          v-if="detail.sourceExecutionId ?? source?.sourceExecutionId"
          :label="$t('image.assets.field.sourceExecutionId')"
          :span="2"
        >
          <Space>
            <code>{{
              detail.sourceExecutionId ?? source?.sourceExecutionId
            }}</code>
            <Button
              size="small"
              type="link"
              @click="
                copy(detail.sourceExecutionId ?? source?.sourceExecutionId)
              "
            >
              {{ $t('common.copy') }}
            </Button>
          </Space>
        </DescriptionsItem>
      </Descriptions>
    </div>

    <template #footer>
      <Space wrap>
        <Button :loading="downloadBusy" @click="download">
          {{ $t('image.assets.action.download') }}
        </Button>
        <Button
          v-if="
            canDelete && detail && assetActionAllowed(detail.status, 'delete')
          "
          danger
          @click="emit('action', 'delete', detail)"
        >
          {{ $t('image.assets.action.delete') }}
        </Button>
        <Button
          v-if="
            canDelete &&
            detail &&
            assetActionAllowed(detail.status, 'retryDelete')
          "
          @click="emit('action', 'retryDelete', detail)"
        >
          {{ $t('image.assets.action.retryDelete') }}
        </Button>
      </Space>
    </template>
  </Drawer>
</template>

<style scoped>
.asset-detail {
  display: grid;
  gap: 20px;
}

.asset-detail__preview {
  display: grid;
  place-items: center;
  min-height: 260px;
  overflow: hidden;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--muted) 70%, transparent),
      transparent
    ),
    var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.asset-detail__image,
.asset-detail__image :deep(img) {
  width: 100%;
  max-height: 520px;
  object-fit: contain;
}
</style>
