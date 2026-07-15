<script lang="ts" setup>
/* eslint-disable vue/html-closing-bracket-newline, vue/multiline-html-element-content-newline */
import type { TableProps, UploadChangeParam } from 'ant-design-vue';

import type { ImageApi } from '#/api/image';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Empty,
  Form,
  Image,
  Input,
  message,
  Modal,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Upload,
} from 'ant-design-vue';

import {
  deleteImageAsset,
  getImageAsset,
  getImageAssetPage,
  getImageAssetStatistics,
  imageAssetContentUrl,
  imageAssetDownloadUrl,
  retryDeleteImageAsset,
  uploadImageAsset,
} from '#/api/image';
import { useImageAssetRefresh } from '#/composables/useImageAssetRefresh';
import { $t } from '#/locales';

import {
  assetActionAllowed,
  formatBytes,
  imageFormatLabel,
  mergeAssetQuery,
} from './data';

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const rows = ref<ImageApi.AssetVO[]>([]);
const total = ref(0);
const page = ref(1);
const size = 24;
const loading = ref(false);
const error = ref<string>();
const stats = ref<ImageApi.AssetStatisticsVO>({});
const filters = ref<ImageApi.AssetQueryReq>(mergeAssetQuery({}, route.query));
const selected = ref<ImageApi.AssetVO>();
const detailOpen = ref(false);
const uploadOpen = ref(false);
const uploadFile = ref<File>();
const uploadName = ref('');
const uploadBusy = ref(false);
const uploadKey = ref<string>();
const uploadError = ref(false);

const canQuery = computed(() => hasAccessByCodes(['Image:Asset:Query']));
const canUpload = computed(() => hasAccessByCodes(['Image:Asset:Upload']));
const canView = computed(() => hasAccessByCodes(['Image:Asset:View']));
const canDelete = computed(() => hasAccessByCodes(['Image:Asset:Delete']));

const columns: TableProps['columns'] = [
  {
    title: $t('image.assets.field.name'),
    dataIndex: 'assetName',
    key: 'name',
    width: 200,
  },
  {
    title: $t('image.assets.field.format'),
    dataIndex: 'imageFormat',
    key: 'format',
    width: 100,
  },
  { title: $t('image.assets.field.size'), key: 'size', width: 120 },
  {
    title: $t('image.assets.field.status'),
    dataIndex: 'status',
    key: 'status',
    width: 130,
  },
  {
    title: $t('image.assets.field.actions'),
    key: 'actions',
    fixed: 'right' as const,
    width: 180,
  },
];

function assetRecord(value: unknown) {
  return value as ImageApi.AssetVO;
}

async function refresh() {
  if (!canQuery.value) return;
  loading.value = true;
  error.value = undefined;
  try {
    const [list, summary] = await Promise.all([
      getImageAssetPage({ page: page.value, size }, filters.value),
      getImageAssetStatistics(),
    ]);
    rows.value = list?.items ?? [];
    total.value = list?.total ?? 0;
    stats.value = summary ?? {};
  } catch {
    error.value = $t('image.assets.error.load');
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  void refresh();
}

function resetFilters() {
  filters.value = mergeAssetQuery({}, route.query);
  applyFilters();
}

function openDetail(asset: ImageApi.AssetVO) {
  if (!hasAccessByCodes(['Image:Asset:View'])) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  selected.value = asset;
  detailOpen.value = true;
  void getImageAsset(asset.assetId).then((value) => {
    if (value) selected.value = value;
  });
}

async function openDeepLinkedAsset() {
  const assetId = String(route.params.assetId || route.query.assetId || '');
  if (!assetId || !canView.value) return;
  const asset = await getImageAsset(assetId);
  if (asset) {
    selected.value = asset;
    detailOpen.value = true;
  }
}

async function remove(asset: ImageApi.AssetVO, retry = false) {
  if (!hasAccessByCodes(['Image:Asset:Delete'])) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  if (!assetActionAllowed(asset.status, retry ? 'retryDelete' : 'delete'))
    return;
  Modal.confirm({
    title: retry
      ? $t('image.assets.action.retryDelete')
      : $t('image.assets.action.delete'),
    content: $t(
      retry
        ? 'image.assets.confirm.retryDelete'
        : 'image.assets.confirm.delete',
    ),
    onOk: async () => {
      await (retry
        ? retryDeleteImageAsset(asset.assetId)
        : deleteImageAsset(asset.assetId));
      await refresh();
    },
  });
}

function openUpload() {
  if (!hasAccessByCodes(['Image:Asset:Upload'])) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  uploadOpen.value = true;
  uploadError.value = false;
  uploadKey.value = undefined;
}

function onUploadChange(info: UploadChangeParam) {
  const file = info.file.originFileObj;
  if (file) uploadFile.value = file;
}

async function submitUpload() {
  if (!uploadFile.value || !hasAccessByCodes(['Image:Asset:Upload'])) return;
  uploadBusy.value = true;
  uploadError.value = false;
  uploadKey.value ??= crypto.randomUUID();
  try {
    await uploadImageAsset(
      uploadFile.value,
      uploadKey.value,
      uploadName.value || undefined,
    );
    uploadOpen.value = false;
    uploadFile.value = undefined;
    uploadName.value = '';
    await refresh();
  } catch {
    // Keep the same idempotency key so an unknown network result can be retried safely.
    uploadError.value = true;
  } finally {
    uploadBusy.value = false;
  }
}

function pageChange(value: number) {
  page.value = value;
  void refresh();
}

useImageAssetRefresh(refresh);
onMounted(async () => {
  await refresh();
  await openDeepLinkedAsset();
});
</script>

<template>
  <Page auto-content-height>
    <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <Statistic
          :title="$t('image.assets.stats.total')"
          :value="stats.total ?? 0"
        />
      </Card>
      <Card>
        <Statistic
          :title="$t('image.assets.stats.available')"
          :value="stats.available ?? 0"
        />
      </Card>
      <Card>
        <Statistic
          :title="$t('image.assets.stats.today')"
          :value="stats.today ?? 0"
        />
      </Card>
    </div>

    <Card :title="$t('image.assets.title')">
      <template #extra>
        <Button v-if="canUpload" type="primary" @click="openUpload">
          {{ $t('image.assets.action.upload') }}
        </Button>
      </template>
      <Alert
        v-if="!canQuery"
        type="warning"
        show-icon
        :message="$t('image.common.permissionDenied')"
      />
      <Alert
        v-else-if="error"
        type="error"
        show-icon
        :message="error"
        closable
        @close="refresh"
      />
      <Form v-else layout="inline" class="mb-4" @submit.prevent="applyFilters">
        <Form.Item :label="$t('image.assets.field.name')">
          <Input v-model:value="filters.assetName" allow-clear />
        </Form.Item>
        <Form.Item :label="$t('image.assets.field.status')">
          <Select
            v-model:value="filters.status"
            allow-clear
            class="min-w-32"
            :options="
              ['AVAILABLE', 'DELETING', 'DELETE_FAILED', 'DELETED'].map(
                (value) => ({
                  label: $t(`image.assets.status.${value}`),
                  value,
                }),
              )
            "
          />
        </Form.Item>
        <Space>
          <Button type="primary" html-type="submit">
            {{ $t('common.search') }} </Button
          ><Button @click="resetFilters">
            {{ $t('common.reset') }}
          </Button>
        </Space>
      </Form>

      <Skeleton
        v-if="loading"
        active
        :paragraph="{ rows: 5 }"
        aria-busy="true"
      />
      <Empty
        v-else-if="rows.length === 0"
        :description="$t('image.assets.empty')"
      />
      <template v-else>
        <div
          class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        >
          <button
            v-for="asset in rows"
            :key="asset.assetId"
            type="button"
            class="rounded border p-2 text-left focus-visible:ring"
            :aria-label="asset.assetName || asset.assetId"
            @click="openDetail(asset)"
          >
            <Image
              :src="imageAssetContentUrl(asset.assetId)"
              :alt="asset.assetName || asset.assetId"
              :preview="false"
              class="mb-2 aspect-video w-full object-cover"
            />
            <span class="block truncate text-xs">{{
              asset.assetName || asset.assetId
            }}</span>
            <span class="block text-xs text-muted-foreground"
              >{{ imageFormatLabel(asset.imageFormat) }} ·
              {{ formatBytes(asset.fileSize) }}</span
            >
          </button>
        </div>
        <Table
          :columns="columns"
          :data-source="rows"
          :pagination="{
            current: page,
            pageSize: size,
            total,
            onChange: pageChange,
          }"
          row-key="assetId"
          :scroll="{ x: 800 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'size'">
              {{ formatBytes(record.fileSize) }}
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag
                :color="
                  record.status === 'AVAILABLE'
                    ? 'success'
                    : record.status === 'DELETE_FAILED'
                      ? 'error'
                      : 'default'
                "
              >
                {{ $t(`image.assets.status.${record.status ?? 'unknown'}`) }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button type="link" @click="openDetail(assetRecord(record))">
                  {{ $t('image.assets.action.detail') }} </Button
                ><Button
                  v-if="
                    canDelete &&
                    assetActionAllowed(assetRecord(record).status, 'delete')
                  "
                  type="link"
                  danger
                  @click="remove(assetRecord(record))"
                >
                  {{ $t('image.assets.action.delete') }} </Button
                ><Button
                  v-if="
                    canDelete &&
                    assetActionAllowed(
                      assetRecord(record).status,
                      'retryDelete',
                    )
                  "
                  type="link"
                  @click="remove(assetRecord(record), true)"
                >
                  {{ $t('image.assets.action.retryDelete') }}
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </template>
    </Card>

    <Drawer
      v-model:open="uploadOpen"
      :title="$t('image.assets.action.upload')"
      :width="420"
      destroy-on-close
    >
      <Form layout="vertical">
        <Form.Item :label="$t('image.assets.field.file')" required>
          <Upload
            :max-count="1"
            :before-upload="() => false"
            @change="onUploadChange"
          >
            <Button>{{ $t('image.assets.action.chooseFile') }}</Button>
          </Upload>
        </Form.Item>
        <Form.Item :label="$t('image.assets.field.name')">
          <Input v-model:value="uploadName" />
        </Form.Item>
        <Alert
          v-if="uploadError"
          type="error"
          show-icon
          :message="$t('image.assets.error.uploadRetry')"
        />
        <Button
          type="primary"
          :loading="uploadBusy"
          :disabled="!uploadFile"
          @click="submitUpload"
        >
          {{
            uploadError
              ? $t('image.assets.action.retryUpload')
              : $t('image.assets.action.submit')
          }}
        </Button>
      </Form>
    </Drawer>

    <Drawer
      v-model:open="detailOpen"
      :title="$t('image.assets.detail.title')"
      :width="520"
      destroy-on-close
    >
      <template v-if="selected && canView">
        <Image
          :src="imageAssetContentUrl(selected.assetId)"
          :alt="selected.assetName || selected.assetId"
          class="mb-4 max-h-80 w-full object-contain"
        />
        <Descriptions bordered :column="1" size="small">
          <DescriptionsItem :label="$t('image.assets.field.name')">
            {{ selected.assetName || selected.assetId }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('image.assets.field.format')">
            {{ imageFormatLabel(selected.imageFormat) }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('image.assets.field.size')">
            {{ formatBytes(selected.fileSize) }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('image.assets.field.dimensions')">
            {{ selected.width }} × {{ selected.height }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('image.assets.field.source')">
            {{ selected.source?.sourceType || '-' }}
          </DescriptionsItem>
        </Descriptions>
        <Space class="mt-4">
          <Button
            :href="imageAssetDownloadUrl(selected.assetId)"
            target="_blank"
          >
            {{ $t('image.assets.action.download') }} </Button
          ><Button
            v-if="canDelete && assetActionAllowed(selected.status, 'delete')"
            danger
            @click="remove(selected)"
          >
            {{ $t('image.assets.action.delete') }} </Button
          ><Button
            v-if="
              canDelete && assetActionAllowed(selected.status, 'retryDelete')
            "
            @click="remove(selected, true)"
          >
            {{ $t('image.assets.action.retryDelete') }}
          </Button>
        </Space>
      </template>
    </Drawer>
  </Page>
</template>
