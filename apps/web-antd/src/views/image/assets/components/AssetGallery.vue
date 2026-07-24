<script lang="ts" setup>
import type { MenuProps } from 'ant-design-vue';

import type { ImageApi } from '#/api/image';

import { computed } from 'vue';

import { Button, Card, Dropdown, Space, Tag, Tooltip } from 'ant-design-vue';

import { $t } from '#/locales';
import {
  assetStatusColor,
  assetStatusKey,
  formatBytes,
  imageFormatLabel,
} from '#/views/image/shared/image-presentation';

import { assetActionAllowed } from '../data';
import AssetThumbnail from './AssetThumbnail.vue';

const props = defineProps<{
  canDelete: boolean;
  rows: ImageApi.AssetVO[];
}>();

const emit = defineEmits<{
  action: [
    action: 'delete' | 'download' | 'retryDelete',
    asset: ImageApi.AssetVO,
  ];
  detail: [asset: ImageApi.AssetVO];
}>();

function menuItems(asset: ImageApi.AssetVO) {
  const items: MenuProps['items'] = [
    { key: 'download', label: $t('image.assets.action.download') },
  ];
  if (props.canDelete && assetActionAllowed(asset.status, 'delete')) {
    items.push({
      danger: true,
      key: 'delete',
      label: $t('image.assets.action.delete'),
    });
  }
  if (props.canDelete && assetActionAllowed(asset.status, 'retryDelete')) {
    items.push({
      key: 'retryDelete',
      label: $t('image.assets.action.retryDelete'),
    });
  }
  return items;
}

function onMenuClick(asset: ImageApi.AssetVO, info: { key: string }) {
  emit('action', info.key as 'delete' | 'download' | 'retryDelete', asset);
}

const hasRows = computed(() => props.rows.length > 0);
</script>

<template>
  <div v-if="hasRows" class="asset-gallery">
    <Card
      v-for="asset in rows"
      :key="asset.assetId"
      size="small"
      class="asset-gallery__card"
      :class="{
        'asset-gallery__card--deleting': asset.status === 'DELETING',
        'asset-gallery__card--failed': asset.status === 'DELETE_FAILED',
      }"
      :body-style="{ padding: '12px' }"
    >
      <button
        type="button"
        class="asset-gallery__preview"
        :aria-label="asset.assetName || asset.assetId"
        @click="emit('detail', asset)"
      >
        <AssetThumbnail
          :alt="asset.assetName || asset.assetId"
          :asset-id="asset.assetId"
          :disabled="asset.status === 'DELETED'"
          variant="gallery"
        />
        <span v-if="asset.status === 'DELETING'" class="asset-gallery__mask">
          {{ $t('image.assets.status.DELETING') }}
        </span>
      </button>

      <div class="asset-gallery__body">
        <Tooltip :title="asset.assetName || asset.assetId">
          <button
            type="button"
            class="asset-gallery__name"
            :aria-label="asset.assetName || asset.assetId"
            @click="emit('detail', asset)"
          >
            {{ asset.assetName || asset.assetId }}
          </button>
        </Tooltip>
        <span class="asset-gallery__meta">
          {{ imageFormatLabel(asset.imageFormat) }} ·
          {{ formatBytes(asset.fileSize) }}
        </span>
        <span class="asset-gallery__meta">
          {{
            $t(
              `image.assets.source.${asset.sourceType ?? asset.source?.sourceType ?? 'unknown'}`,
            )
          }}
        </span>
      </div>

      <template #actions>
        <Space class="asset-gallery__actions">
          <Tag :color="assetStatusColor(asset.status)">
            {{ $t(assetStatusKey(asset.status)) }}
          </Tag>
          <Button type="link" @click="emit('detail', asset)">
            {{ $t('image.assets.action.detail') }}
          </Button>
          <Dropdown
            placement="bottomRight"
            :menu="{
              items: menuItems(asset),
              onClick: (info: any) =>
                onMenuClick(asset, { key: String(info.key) }),
            }"
          >
            <Button type="text" :aria-label="$t('image.assets.action.more')">
              ···
            </Button>
          </Dropdown>
        </Space>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.asset-gallery {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.asset-gallery__card {
  overflow: hidden;
}

.asset-gallery__card--failed {
  border-color: var(--destructive);
}

.asset-gallery__card--deleting {
  opacity: 0.84;
}

.asset-gallery__preview {
  position: relative;
  display: block;
  width: calc(100% + 24px);
  aspect-ratio: 4 / 3;
  margin: -12px -12px 12px;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.asset-gallery__preview:focus-visible,
.asset-gallery__name:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.asset-gallery__mask {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-weight: 600;
  color: var(--foreground);
  background: color-mix(in srgb, var(--card) 72%, transparent);
}

.asset-gallery__body {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.asset-gallery__name {
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--foreground);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.asset-gallery__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.asset-gallery__actions {
  justify-content: space-between;
  width: 100%;
}

@media (min-width: 480px) {
  .asset-gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .asset-gallery {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .asset-gallery {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .asset-gallery {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .asset-gallery {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
