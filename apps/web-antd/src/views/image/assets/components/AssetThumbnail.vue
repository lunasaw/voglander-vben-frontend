<script lang="ts" setup>
import type { ImagePreviewVariant } from '#/composables/useImagePreview';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Button, Image, Spin } from 'ant-design-vue';

import { useImagePreview } from '#/composables/useImagePreview';
import { $t } from '#/locales';

const props = withDefaults(
  defineProps<{
    alt: string;
    assetId: string;
    disabled?: boolean;
    variant?: ImagePreviewVariant;
  }>(),
  { disabled: false, variant: 'gallery' },
);

const root = ref<HTMLElement>();
const source = ref<string>();
const loading = ref(false);
const failed = ref(false);
const visible = ref(false);
const preview = useImagePreview();
let acquired: undefined | { assetId: string; variant: ImagePreviewVariant };
let revision = 0;
let observer: IntersectionObserver | undefined;

function releaseCurrent() {
  revision++;
  if (acquired) preview.release(acquired.assetId, acquired.variant);
  acquired = undefined;
  source.value = undefined;
  loading.value = false;
  failed.value = false;
}

async function loadCurrent(retry = false) {
  if (!visible.value || props.disabled) return;
  const current = { assetId: props.assetId, variant: props.variant };
  const currentRevision = ++revision;
  loading.value = true;
  failed.value = false;
  try {
    if (!acquired) {
      acquired = current;
      source.value = await preview.load(current.assetId, current.variant);
    } else if (retry) {
      source.value = await preview.retry(current.assetId, current.variant);
    }
  } catch (error) {
    if ((error as { name?: string })?.name !== 'AbortError')
      failed.value = true;
  } finally {
    if (currentRevision === revision) loading.value = false;
  }
}

function retry() {
  void loadCurrent(true);
}

watch(
  () => [props.assetId, props.disabled, props.variant] as const,
  () => {
    releaseCurrent();
    if (visible.value) void loadCurrent();
  },
);

onMounted(() => {
  if (!root.value || typeof IntersectionObserver === 'undefined') {
    visible.value = true;
    void loadCurrent();
    return;
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      visible.value = Boolean(entry?.isIntersecting);
      if (visible.value) void loadCurrent();
      else releaseCurrent();
    },
    { rootMargin: '280px 0px' },
  );
  observer.observe(root.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  releaseCurrent();
});
</script>

<template>
  <div ref="root" class="asset-thumbnail" :aria-busy="loading">
    <Image
      v-if="source"
      :alt="alt"
      :preview="false"
      :src="source"
      class="asset-thumbnail__image"
    />
    <div v-else class="asset-thumbnail__placeholder">
      <Spin v-if="loading" size="small" />
      <template v-else-if="failed">
        <span>{{ $t('image.assets.error.thumbnail') }}</span>
        <Button size="small" type="link" @click.stop="retry">
          {{ $t('image.assets.action.retryThumbnail') }}
        </Button>
      </template>
      <span v-else>{{ $t('image.assets.imageUnavailable') }}</span>
    </div>
  </div>
</template>

<style scoped>
.asset-thumbnail {
  width: 100%;
  height: 100%;
  min-height: 42px;
  overflow: hidden;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--muted) 72%, transparent),
      transparent
    ),
    var(--card);
}

.asset-thumbnail__image,
.asset-thumbnail__image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-thumbnail__placeholder {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: inherit;
  font-size: 12px;
  color: var(--muted-foreground);
  text-align: center;
}
</style>
