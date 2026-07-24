<script lang="ts" setup>
import type { MenuProps } from 'ant-design-vue';

import type { AssetQueryFormValues } from './data';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ImageApi, ImageAssetStatus } from '#/api/image';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  message,
  Modal,
  Pagination,
  Result,
  Segmented,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteImageAsset,
  downloadImageAssetBlob,
  getImageAssetStatistics,
  retryDeleteImageAsset,
} from '#/api/image';
import { useImageAssetRefresh } from '#/composables/useImageAssetRefresh';
import { $t } from '#/locales';
import { stableFingerprint } from '#/views/image/shared/idempotent-submit';
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

import AssetDetailDrawer from './components/AssetDetailDrawer.vue';
import AssetGallery from './components/AssetGallery.vue';
import AssetStatistics from './components/AssetStatistics.vue';
import AssetThumbnail from './components/AssetThumbnail.vue';
import AssetUploadDrawer from './components/AssetUploadDrawer.vue';
import {
  assetActionAllowed,
  assetDetailIdFromRoute,
  assetFormValuesToQuery,
  assetQueryFromRoute,
  assetQueryToRoute,
  useAssetQuerySchema,
} from './data';
import { useAssetPageController } from './use-asset-page-controller';

type AssetView = 'gallery' | 'list';

const VIEW_STORAGE_KEY = 'voglander:image-assets:view';
const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const initialContext = {
  channelId: assetQueryFromRoute(route.query).channelId,
  deviceId: assetQueryFromRoute(route.query).deviceId,
};
const controller = useAssetPageController(assetQueryFromRoute(route.query));
const statistics = ref<ImageApi.AssetStatisticsVO>({});
const statisticsLoading = ref(false);
const statisticsError = ref(false);
const actionBusy = ref<string>();

const canQuery = computed(() => hasAccessByCodes(['Image:Asset:Query']));
const canView = computed(() => hasAccessByCodes(['Image:Asset:View']));
const canUpload = computed(() => hasAccessByCodes(['Image:Asset:Upload']));
const canDelete = computed(() => hasAccessByCodes(['Image:Asset:Delete']));

function readViewPreference(): AssetView {
  if (!canView.value) return 'list';
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === 'list' ? 'list' : 'gallery';
  } catch {
    return 'gallery';
  }
}

const view = ref<AssetView>(readViewPreference());

function setView(next: number | string) {
  view.value = canView.value && next === 'gallery' ? 'gallery' : 'list';
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view.value);
  } catch {
    // Storage is a preference only; query remains fully functional without it.
  }
}

const [UploadDrawer, uploadDrawerApi] = useVbenDrawer({
  connectedComponent: AssetUploadDrawer,
  destroyOnClose: false,
});
const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: AssetDetailDrawer,
  destroyOnClose: false,
});

function filtersToForm(filters: ImageApi.AssetQueryReq): AssetQueryFormValues {
  return {
    assetId: filters.assetId,
    assetName: filters.assetName,
    capturedRange:
      filters.capturedStart !== undefined && filters.capturedEnd !== undefined
        ? [dayjs(filters.capturedStart), dayjs(filters.capturedEnd)]
        : undefined,
    channelId: filters.channelId,
    deviceId: filters.deviceId,
    sourceTaskId: filters.sourceTaskId,
    sourceType: filters.sourceType,
    status: filters.status,
  };
}

const [QueryForm, queryFormApi] = useVbenForm({
  actionLayout: 'rowEnd',
  collapsed: true,
  commonConfig: {
    componentProps: { class: 'w-full' },
  },
  handleReset: resetFilters,
  handleSubmit: submitFilters,
  schema: useAssetQuerySchema(),
  showCollapseButton: true,
  submitButtonOptions: { content: $t('common.search') },
  wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
});

const gridColumns = computed<VxeTableGridOptions<ImageApi.AssetVO>['columns']>(
  () => [
    ...(canView.value
      ? [
          {
            field: 'image',
            slots: { default: 'image' },
            title: $t('image.assets.field.image'),
            width: 88,
          },
        ]
      : []),
    {
      field: 'assetName',
      minWidth: 220,
      slots: { default: 'name' },
      title: $t('image.assets.field.name'),
    },
    {
      field: 'sourceType',
      minWidth: 210,
      slots: { default: 'source' },
      title: $t('image.assets.field.source'),
    },
    {
      field: 'dimensions',
      formatter: ({ row }: { row: ImageApi.AssetVO }) =>
        `${row.width ?? '-'} × ${row.height ?? '-'} · ${imageFormatLabel(row.imageFormat)}`,
      minWidth: 150,
      title: $t('image.assets.field.specification'),
    },
    {
      field: 'fileSize',
      formatter: ({ row }: { row: ImageApi.AssetVO }) =>
        formatBytes(row.fileSize),
      minWidth: 110,
      title: $t('image.assets.field.size'),
    },
    {
      field: 'capturedAt',
      formatter: ({ row }: { row: ImageApi.AssetVO }) =>
        formatDateTime(row.capturedAt),
      minWidth: 180,
      title: $t('image.assets.field.capturedAt'),
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('image.assets.field.status'),
      width: 130,
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: $t('image.assets.field.actions'),
      width: canView.value ? 170 : 100,
    },
  ],
);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: gridColumns.value,
    data: [],
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'assetId' },
    scrollX: { enabled: true },
    scrollY: { enabled: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: false,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<ImageApi.AssetVO>,
});

watch(controller.rows, (rows) => gridApi.setGridOptions({ data: rows }), {
  immediate: true,
});
watch(controller.loading, (loading) => gridApi.setLoading(loading), {
  immediate: true,
});
watch(gridColumns, (columns) => gridApi.setGridOptions({ columns }));
watch(canView, (allowed) => {
  if (!allowed) view.value = 'list';
});

async function loadStatistics() {
  if (!canQuery.value) return;
  statisticsLoading.value = true;
  statisticsError.value = false;
  try {
    statistics.value = (await getImageAssetStatistics()) ?? {};
  } catch {
    statisticsError.value = true;
  } finally {
    statisticsLoading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([controller.refreshCurrentPage(), loadStatistics()]);
}

async function syncQuery(filters: ImageApi.AssetQueryReq) {
  const stable = assetQueryToRoute(filters);
  const detailId = assetDetailIdFromRoute(route.query, route.params.assetId);
  await router.replace({
    query: {
      ...stable,
      ...(detailId && !route.params.assetId ? { assetId: detailId } : {}),
    },
  });
}

async function submitFilters(values: Record<string, unknown>) {
  const filters = assetFormValuesToQuery(values as AssetQueryFormValues);
  const succeeded = await controller.query(filters);
  if (succeeded) await syncQuery(filters);
}

async function resetFilters() {
  const filters = { ...initialContext };
  await queryFormApi.setValues(filtersToForm(filters));
  const succeeded = await controller.query(filters);
  if (succeeded) await syncQuery(filters);
}

async function applyStatistic(status?: ImageAssetStatus) {
  const values = await queryFormApi.getValues<AssetQueryFormValues>();
  await queryFormApi.setValues({
    ...values,
    ...(status === undefined ? { capturedRange: undefined } : {}),
    status,
  });
  await queryFormApi.submitForm();
}

async function clearContext(field: 'channelId' | 'deviceId') {
  await queryFormApi.setFieldValue(field, undefined);
  await queryFormApi.submitForm();
}

function ensureViewPermission() {
  if (hasAccessByCodes(['Image:Asset:View'])) return true;
  message.error($t('image.common.permissionDenied'));
  return false;
}

async function openDetail(asset: ImageApi.AssetVO) {
  if (!ensureViewPermission()) return;
  detailDrawerApi.setData({ asset, canDelete: canDelete.value }).open();
  if (!route.params.assetId) {
    await router.replace({ query: { ...route.query, assetId: asset.assetId } });
  }
}

async function closeDetailRoute() {
  const assetId = assetDetailIdFromRoute(route.query, route.params.assetId);
  if (!assetId) return;
  const query = { ...route.query };
  delete query.assetId;
  await (route.params.assetId
    ? router.replace({ path: '/image/assets', query })
    : router.replace({ query }));
}

function actionMenu(asset: ImageApi.AssetVO): NonNullable<MenuProps['items']> {
  const items: NonNullable<MenuProps['items']> = [];
  if (canView.value) {
    items.push({ key: 'download', label: $t('image.assets.action.download') });
  }
  if (canDelete.value && assetActionAllowed(asset.status, 'delete')) {
    items.push({
      danger: true,
      key: 'delete',
      label: $t('image.assets.action.delete'),
    });
  }
  if (canDelete.value && assetActionAllowed(asset.status, 'retryDelete')) {
    items.push({
      key: 'retryDelete',
      label: $t('image.assets.action.retryDelete'),
    });
  }
  return items;
}

async function download(asset: ImageApi.AssetVO) {
  if (!ensureViewPermission()) return;
  actionBusy.value = asset.assetId;
  try {
    const response = await downloadImageAssetBlob(asset.assetId);
    const url = URL.createObjectURL(response.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      filenameFromContentDisposition(response.contentDisposition) ??
      suggestedAssetFilename(asset);
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    message.error($t('image.assets.error.download'));
  } finally {
    actionBusy.value = undefined;
  }
}

function mutateAsset(
  asset: ImageApi.AssetVO,
  action: 'delete' | 'retryDelete',
) {
  if (
    !hasAccessByCodes(['Image:Asset:Delete']) ||
    !assetActionAllowed(asset.status, action)
  ) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  Modal.confirm({
    content: $t(`image.assets.confirm.${action}`, [
      asset.assetName || asset.assetId,
    ]),
    okButtonProps: { danger: action === 'delete' },
    onOk: async () => {
      actionBusy.value = asset.assetId;
      try {
        await (action === 'delete'
          ? deleteImageAsset(asset.assetId)
          : retryDeleteImageAsset(asset.assetId));
        message.success($t(`image.assets.success.${action}`));
        await Promise.all([
          controller.refreshAfterMutation(),
          loadStatistics(),
        ]);
      } finally {
        actionBusy.value = undefined;
      }
    },
    title: $t(`image.assets.action.${action}`),
  });
}

function handleAssetAction(
  action: 'delete' | 'download' | 'retryDelete',
  asset: ImageApi.AssetVO,
) {
  if (action === 'download') void download(asset);
  else mutateAsset(asset, action);
}

async function onPageChange(page: number, pageSize: number) {
  await controller.setPage(page, pageSize);
}

const routeFilterFingerprint = computed(() =>
  stableFingerprint(assetQueryFromRoute(route.query)),
);
watch(routeFilterFingerprint, async () => {
  const filters = assetQueryFromRoute(route.query);
  if (
    stableFingerprint(filters) === stableFingerprint(controller.filters.value)
  ) {
    return;
  }
  await queryFormApi.setValues(filtersToForm(filters));
  await controller.query(filters);
});

const routeDetailId = computed(() =>
  assetDetailIdFromRoute(route.query, route.params.assetId),
);
function syncRouteDetail(assetId?: string) {
  if (!assetId || !canView.value) {
    void detailDrawerApi.close();
    return;
  }
  const asset =
    controller.rows.value.find((row) => row.assetId === assetId) ??
    ({ assetId } as ImageApi.AssetVO);
  detailDrawerApi.setData({ asset, canDelete: canDelete.value }).open();
}
watch(routeDetailId, syncRouteDetail);

useImageAssetRefresh(refreshAll);
onMounted(async () => {
  if (!canQuery.value) return;
  await queryFormApi.setValues(filtersToForm(controller.filters.value));
  await refreshAll();
  syncRouteDetail(routeDetailId.value);
});
</script>

<template>
  <Page
    auto-content-height
    :description="$t('image.assets.description')"
    :title="$t('image.assets.title')"
  >
    <template #extra>
      <Button v-if="canUpload" type="primary" @click="uploadDrawerApi.open()">
        {{ $t('image.assets.action.upload') }}
      </Button>
    </template>

    <UploadDrawer @success="refreshAll" />
    <DetailDrawer @action="handleAssetAction" @closed="closeDetailRoute" />

    <Result
      v-if="!canQuery"
      status="403"
      :sub-title="$t('image.common.permissionDenied')"
      :title="$t('image.common.forbidden')"
    />
    <div v-else class="asset-page">
      <AssetStatistics
        :active-status="controller.filters.value.status"
        :loading="statisticsLoading"
        :statistics="statistics"
        @select="applyStatistic"
      />
      <Alert
        v-if="statisticsError"
        type="warning"
        show-icon
        :message="$t('image.assets.error.statistics')"
      >
        <template #action>
          <a @click="loadStatistics">{{ $t('common.retry') }}</a>
        </template>
      </Alert>

      <Card size="small" class="asset-page__query">
        <QueryForm />
      </Card>

      <Alert
        v-if="controller.error.value"
        type="error"
        show-icon
        :message="$t('image.assets.error.load')"
      >
        <template #action>
          <a @click="controller.refreshCurrentPage">{{ $t('common.retry') }}</a>
        </template>
      </Alert>

      <Card size="small" :body-style="{ padding: '12px' }">
        <div class="asset-page__toolbar">
          <Space wrap>
            <strong>{{
              $t('image.assets.resultCount', [controller.total.value])
            }}</strong>
            <Tag
              v-if="controller.filters.value.deviceId"
              closable
              @close.prevent="clearContext('deviceId')"
            >
              {{ $t('image.assets.field.deviceId') }}:
              {{ controller.filters.value.deviceId }}
            </Tag>
            <Tag
              v-if="controller.filters.value.channelId"
              closable
              @close.prevent="clearContext('channelId')"
            >
              {{ $t('image.assets.field.channelId') }}:
              {{ controller.filters.value.channelId }}
            </Tag>
          </Space>
          <Space wrap>
            <Segmented
              v-if="canView"
              :options="[
                { label: $t('image.assets.view.gallery'), value: 'gallery' },
                { label: $t('image.assets.view.list'), value: 'list' },
              ]"
              :value="view"
              @change="setView"
            />
            <Button :loading="controller.loading.value" @click="refreshAll">
              {{ $t('common.refresh') }}
            </Button>
          </Space>
        </div>

        <Empty
          v-if="!controller.loading.value && controller.rows.value.length === 0"
          class="asset-page__empty"
          :description="
            Object.values(controller.filters.value).some(Boolean)
              ? $t('image.assets.emptyFiltered')
              : $t('image.assets.empty')
          "
        >
          <Button
            v-if="canUpload"
            type="primary"
            @click="uploadDrawerApi.open()"
          >
            {{ $t('image.assets.action.upload') }}
          </Button>
        </Empty>

        <AssetGallery
          v-else-if="view === 'gallery' && canView"
          :can-delete="canDelete"
          :rows="controller.rows.value"
          @action="handleAssetAction"
          @detail="openDetail"
        />

        <Grid v-else>
          <template #image="{ row }">
            <button
              type="button"
              class="asset-page__table-image"
              @click="openDetail(row)"
            >
              <AssetThumbnail
                :alt="row.assetName || row.assetId"
                :asset-id="row.assetId"
                :disabled="row.status === 'DELETED'"
                variant="table"
              />
            </button>
          </template>
          <template #name="{ row }">
            <div class="min-w-0">
              <Tooltip :title="row.assetName || row.assetId">
                <strong class="block truncate">{{
                  row.assetName || row.assetId
                }}</strong>
              </Tooltip>
              <code class="text-muted-foreground text-xs">{{
                row.assetId
              }}</code>
            </div>
          </template>
          <template #source="{ row }">
            <div>
              <Tag>
                {{
                  $t(
                    `image.assets.source.${row.sourceType ?? row.source?.sourceType ?? 'unknown'}`,
                  )
                }}
              </Tag>
              <small class="text-muted-foreground block truncate">
                {{ imageCameraLabel(row.source) }}
              </small>
            </div>
          </template>
          <template #status="{ row }">
            <Tag :color="assetStatusColor(row.status)">
              {{ $t(assetStatusKey(row.status)) }}
            </Tag>
          </template>
          <template #operation="{ row }">
            <Space>
              <Button v-if="canView" type="link" @click="openDetail(row)">
                {{ $t('image.assets.action.detail') }}
              </Button>
              <Dropdown
                v-if="actionMenu(row).length > 0"
                :menu="{
                  items: actionMenu(row),
                  onClick: (info: any) =>
                    handleAssetAction(
                      String(info.key) as 'delete' | 'download' | 'retryDelete',
                      row,
                    ),
                }"
              >
                <Button
                  type="link"
                  :loading="actionBusy === row.assetId"
                  :aria-label="$t('image.assets.action.more')"
                >
                  {{ $t('image.assets.action.more') }}
                </Button>
              </Dropdown>
            </Space>
          </template>
        </Grid>

        <div v-if="controller.total.value > 0" class="asset-page__pagination">
          <Pagination
            show-size-changer
            :current="controller.page.value"
            :page-size="controller.pageSize.value"
            :page-size-options="['12', '24', '48', '96']"
            :show-total="
              (value: number) => $t('image.assets.resultCount', [value])
            "
            :total="controller.total.value"
            @change="onPageChange"
            @show-size-change="onPageChange"
          />
        </div>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.asset-page {
  display: grid;
  gap: 16px;
}

.asset-page__query :deep(form) {
  margin-bottom: 0;
}

.asset-page__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.asset-page__empty {
  padding: 48px 0;
}

.asset-page__table-image {
  display: block;
  width: 56px;
  height: 42px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: calc(var(--radius) - 2px);
}

.asset-page__table-image:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.asset-page__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 767px) {
  .asset-page__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .asset-page__pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
