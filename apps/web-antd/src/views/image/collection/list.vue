<script lang="ts" setup>
import type { MenuProps } from 'ant-design-vue';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ImageApi } from '#/api/image';
import type { CollectionControlAction } from '#/views/image/shared/image-permissions';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Badge,
  Button,
  Dropdown,
  message,
  Modal,
  Result,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getImageCollection, getImageCollectionPage } from '#/api/image';
import {
  cancelBusinessTask,
  pauseBusinessTask,
  resumeBusinessTask,
  retryBusinessTask,
} from '#/api/task';
import { useSseEvents } from '#/composables/useSseEvents';
import { $t } from '#/locales';
import { createAuthoritativeRefresh } from '#/views/image/shared/authoritative-refresh';
import { stableFingerprint } from '#/views/image/shared/idempotent-submit';
import {
  availableCollectionActions,
  collectionActionAllowed,
} from '#/views/image/shared/image-permissions';
import {
  collectionModeKey,
  collectionStateColor,
  collectionStateKey,
  formatDateTime,
} from '#/views/image/shared/image-presentation';
import TaskProgress from '#/views/task/center/TaskProgress.vue';

import CollectionCreateDrawer from './components/CollectionCreateDrawer.vue';
import CollectionDetailDrawer from './components/CollectionDetailDrawer.vue';
import CollectionRescheduleDrawer from './components/CollectionRescheduleDrawer.vue';
import {
  collectionFormValuesToQuery,
  collectionQueryFromRoute,
  collectionQueryToRoute,
  collectionTaskIdFromRoute,
  useCollectionGridFormSchema,
} from './data';

const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const initialFilters = collectionQueryFromRoute(route.query);
const initialContext = {
  channelId: initialFilters.channelId,
  deviceId: initialFilters.deviceId,
};
const currentFilters = ref<ImageApi.CollectionQueryReq>(initialFilters);
const listError = ref(false);
const actionBusy = ref<string>();

const canQuery = computed(() => hasAccessByCodes(['Image:Collection:Query']));
const canCreate = computed(() => hasAccessByCodes(['Image:Collection:Create']));
const canControlImage = computed(() =>
  hasAccessByCodes(['Image:Collection:Control']),
);
const canControlTask = computed(() => hasAccessByCodes(['Task:Control']));

function permissions() {
  return {
    canControlImage: canControlImage.value,
    canControlTask: canControlTask.value,
  };
}

const [CreateDrawer, createDrawerApi] = useVbenDrawer({
  connectedComponent: CollectionCreateDrawer,
  destroyOnClose: false,
});
const [RescheduleDrawer, rescheduleDrawerApi] = useVbenDrawer({
  connectedComponent: CollectionRescheduleDrawer,
  destroyOnClose: false,
});
const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: CollectionDetailDrawer,
  destroyOnClose: false,
});

const columns: VxeTableGridOptions<ImageApi.CollectionVO>['columns'] = [
  {
    field: 'taskName',
    minWidth: 230,
    slots: { default: 'task' },
    title: $t('image.collections.field.name'),
  },
  {
    field: 'camera',
    minWidth: 240,
    slots: { default: 'camera' },
    title: $t('image.collections.field.camera'),
  },
  {
    field: 'taskMode',
    slots: { default: 'mode' },
    title: $t('image.collections.field.mode'),
    width: 120,
  },
  {
    field: 'state',
    slots: { default: 'state' },
    title: $t('image.collections.field.state'),
    width: 140,
  },
  {
    field: 'progress',
    minWidth: 180,
    slots: { default: 'progress' },
    title: $t('image.collections.field.progress'),
  },
  {
    field: 'schedule',
    minWidth: 210,
    slots: { default: 'schedule' },
    title: $t('image.collections.field.schedule'),
  },
  {
    field: 'result',
    minWidth: 180,
    slots: { default: 'result' },
    title: $t('image.collections.field.result'),
  },
  {
    field: 'operation',
    fixed: 'right',
    slots: { default: 'operation' },
    title: $t('image.collections.field.actions'),
    width: 180,
  },
];

async function syncQuery(filters: ImageApi.CollectionQueryReq) {
  const taskId = collectionTaskIdFromRoute(route.query);
  await router.replace({
    query: {
      ...collectionQueryToRoute(filters),
      ...(taskId ? { taskId } : {}),
    },
  });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useCollectionGridFormSchema(initialContext),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  },
  gridOptions: {
    columns,
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const filters = collectionFormValuesToQuery(formValues);
          listError.value = false;
          try {
            const result = await getImageCollectionPage(
              { page: page.currentPage, size: page.pageSize },
              filters,
            );
            currentFilters.value = filters;
            await syncQuery(filters);
            return result;
          } catch (error) {
            listError.value = true;
            throw error;
          }
        },
      },
      autoLoad: false,
    },
    rowConfig: { keyField: 'taskId' },
    scrollX: { enabled: true },
    scrollY: { enabled: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ImageApi.CollectionVO>,
});

function showCreate() {
  if (!hasAccessByCodes(['Image:Collection:Create'])) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  createDrawerApi
    .setData({
      channelId: currentFilters.value.channelId,
      deviceId: currentFilters.value.deviceId,
    })
    .open();
}

async function openDetail(task: ImageApi.CollectionVO) {
  if (!hasAccessByCodes(['Image:Collection:Query'])) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  detailDrawerApi.setData(task).open();
  await router.replace({ query: { ...route.query, taskId: task.taskId } });
}

async function closeDetailRoute() {
  if (!collectionTaskIdFromRoute(route.query)) return;
  const query = { ...route.query };
  delete query.taskId;
  await router.replace({ query });
}

function actionItems(
  task: ImageApi.CollectionVO,
): NonNullable<MenuProps['items']> {
  return availableCollectionActions(task, permissions()).map((action) => ({
    danger: action === 'CANCEL',
    key: action,
    label: $t(
      `image.collections.action.${
        {
          CANCEL: 'cancel',
          MANUAL_RETRY: 'retry',
          PAUSE: 'pause',
          RESCHEDULE: 'reschedule',
          RESUME: 'resume',
        }[action]
      }`,
    ),
  }));
}

function confirmCancel(task: ImageApi.CollectionVO) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      content: $t('image.collections.confirm.cancel', [
        task.taskName || task.taskId,
      ]),
      okButtonProps: { danger: true },
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: $t('image.collections.action.cancel'),
    });
  });
}

async function control(
  row: ImageApi.CollectionVO,
  action: CollectionControlAction,
) {
  if (actionBusy.value) return;
  let task: ImageApi.CollectionVO;
  try {
    task = await getImageCollection(row.taskId);
  } catch {
    message.error($t('image.collections.error.stateConflict'));
    return;
  }
  if (!collectionActionAllowed(task, action, permissions())) {
    message.error($t('image.collections.error.stateConflict'));
    await gridApi.query();
    return;
  }
  if (action === 'RESCHEDULE') {
    rescheduleDrawerApi.setData(task).open();
    return;
  }
  if (action === 'CANCEL' && !(await confirmCancel(task))) return;

  actionBusy.value = task.taskId;
  try {
    switch (action) {
      case 'CANCEL': {
        await cancelBusinessTask(task.taskId, {
          expectedVersion: task.version,
        });
        break;
      }
      case 'PAUSE': {
        await pauseBusinessTask(task.taskId, {
          expectedVersion: task.version,
        });
        break;
      }
      case 'RESUME': {
        await resumeBusinessTask(task.taskId, {
          expectedVersion: task.version,
        });
        break;
      }
      default: {
        const executionId = task.lastExecutionId;
        if (!executionId) throw new Error('execution is unavailable');
        await retryBusinessTask(task.taskId, {
          executionId,
          idempotencyKey: `manual-retry:${task.taskId}:${executionId}`,
        });
      }
    }
    message.success($t('image.collections.control.success'));
  } catch {
    message.error($t('image.collections.error.stateConflict'));
  } finally {
    actionBusy.value = undefined;
    await gridApi.query();
  }
}

async function openReschedule(task: ImageApi.CollectionVO) {
  await detailDrawerApi.close();
  rescheduleDrawerApi.setData(task).open();
}

async function copy(value: string) {
  await navigator.clipboard.writeText(value);
  message.success($t('image.common.copied'));
}

async function clearContext(field: 'channelId' | 'deviceId') {
  await gridApi.formApi.setFieldValue(field, undefined);
  const filters = collectionFormValuesToQuery(
    await gridApi.formApi.getValues(),
  );
  gridApi.formApi.setLatestSubmissionValues(filters);
  await gridApi.query(filters);
}

const routeFilterFingerprint = computed(() =>
  stableFingerprint(collectionQueryFromRoute(route.query)),
);
watch(routeFilterFingerprint, async () => {
  const filters = collectionQueryFromRoute(route.query);
  if (stableFingerprint(filters) === stableFingerprint(currentFilters.value)) {
    return;
  }
  await gridApi.formApi.setValues(filters);
  gridApi.formApi.setLatestSubmissionValues(filters);
  await gridApi.query(filters);
});

const routeTaskId = computed(() => collectionTaskIdFromRoute(route.query));
function syncRouteTask(taskId?: string) {
  if (!taskId || !canQuery.value) {
    void detailDrawerApi.close();
    return;
  }
  const rows = (gridApi.grid?.getData?.() ?? []) as ImageApi.CollectionVO[];
  const task =
    rows.find((item) => item.taskId === taskId) ??
    ({ taskId } as ImageApi.CollectionVO);
  detailDrawerApi.setData(task).open();
}
watch(routeTaskId, syncRouteTask);

const sse = useSseEvents(() => [
  'image.asset.created',
  'image.asset.deleted',
  'business.task.state',
  'business.task.progress',
  'business.task.execution-state',
]);
const listRefresher = createAuthoritativeRefresh(() => gridApi.query(), {
  delay: 300,
  maxWait: 1500,
});
let hadDisconnect = false;
let fallbackTimer: ReturnType<typeof setInterval> | undefined;

function stopFallback() {
  if (fallbackTimer) clearInterval(fallbackTimer);
  fallbackTimer = undefined;
}

function startFallback() {
  if (fallbackTimer || document.visibilityState !== 'visible') return;
  fallbackTimer = setInterval(() => listRefresher.notify(), 30_000);
}

watch(sse.events, () => listRefresher.notify());
watch(sse.status, (status) => {
  if (status === 'error' || status === 'closed') {
    hadDisconnect = true;
    startFallback();
  } else if (status === 'open') {
    stopFallback();
    if (hadDisconnect) {
      hadDisconnect = false;
      void listRefresher.flush();
    }
  }
});

function onVisibilityChange() {
  if (document.visibilityState !== 'visible') {
    stopFallback();
    return;
  }
  if (sse.status.value !== 'open' || listRefresher.isDirty()) {
    void listRefresher.flush();
  }
  if (sse.status.value !== 'open') startFallback();
}

const livePresentation = computed(() => {
  if (sse.status.value === 'open') {
    return {
      status: 'success' as const,
      text: $t('image.collections.live.open'),
    };
  }
  if (sse.status.value === 'connecting') {
    return {
      status: 'processing' as const,
      text: $t('image.collections.live.connecting'),
    };
  }
  return {
    status: 'warning' as const,
    text: $t('image.collections.live.polling'),
  };
});

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (!canQuery.value) return;
  await gridApi.formApi.setValues(initialFilters);
  gridApi.formApi.setLatestSubmissionValues(initialFilters);
  await gridApi.query(initialFilters);
  syncRouteTask(routeTaskId.value);
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  stopFallback();
  listRefresher.dispose();
  sse.close();
});
</script>

<template>
  <Page
    auto-content-height
    :description="$t('image.collections.description')"
    :title="$t('image.collections.title')"
  >
    <template #extra>
      <Space wrap>
        <Badge
          :status="livePresentation.status"
          :text="livePresentation.text"
        />
        <Button v-if="canCreate" type="primary" @click="showCreate">
          {{ $t('image.collections.action.create') }}
        </Button>
      </Space>
    </template>

    <CreateDrawer @success="gridApi.query" />
    <RescheduleDrawer @success="gridApi.query" />
    <DetailDrawer
      @closed="closeDetailRoute"
      @reschedule="openReschedule"
      @success="gridApi.query"
    />

    <Result
      v-if="!canQuery"
      status="403"
      :sub-title="$t('image.common.permissionDenied')"
      :title="$t('image.common.forbidden')"
    />
    <div v-else class="collection-page">
      <Alert
        v-if="listError"
        type="error"
        show-icon
        :message="$t('image.collections.error.load')"
      >
        <template #action>
          <a @click="gridApi.query">{{ $t('common.retry') }}</a>
        </template>
      </Alert>

      <Grid>
        <template #toolbar-tools>
          <Space wrap>
            <strong>{{ $t('image.collections.listTitle') }}</strong>
            <Tag
              v-if="currentFilters.deviceId"
              closable
              @close.prevent="clearContext('deviceId')"
            >
              {{ $t('image.collections.field.deviceId') }}:
              {{ currentFilters.deviceId }}
            </Tag>
            <Tag
              v-if="currentFilters.channelId"
              closable
              @close.prevent="clearContext('channelId')"
            >
              {{ $t('image.collections.field.channelId') }}:
              {{ currentFilters.channelId }}
            </Tag>
          </Space>
        </template>

        <template #task="{ row }">
          <div class="min-w-0">
            <Tooltip :title="row.taskName || row.taskId">
              <strong class="block truncate">{{
                row.taskName || row.taskId
              }}</strong>
            </Tooltip>
            <Button size="small" type="link" @click="copy(row.taskId)">
              <code>{{ row.taskId }}</code>
            </Button>
          </div>
        </template>

        <template #camera="{ row }">
          <div>
            <strong>{{ row.deviceName || row.deviceId || '-' }}</strong>
            <span aria-hidden="true"> / </span>
            <strong>{{ row.channelName || row.channelId || '-' }}</strong>
            <small class="text-muted-foreground block truncate">
              {{ row.deviceId || '-' }} / {{ row.channelId || '-' }}
            </small>
          </div>
        </template>

        <template #mode="{ row }">
          <Tag>{{ $t(collectionModeKey(row)) }}</Tag>
        </template>

        <template #state="{ row }">
          <Badge
            v-if="row.state === 'RUNNING'"
            status="processing"
            :text="$t(collectionStateKey(row.state))"
          />
          <Tag v-else :color="collectionStateColor(row.state)">
            {{ $t(collectionStateKey(row.state)) }}
          </Tag>
        </template>

        <template #progress="{ row }">
          <TaskProgress
            :current="row.progressCurrent ?? row.successCount"
            :message="row.progressMessage"
            :total="row.progressTotal ?? row.plannedCount"
          />
        </template>

        <template #schedule="{ row }">
          <div class="text-xs">
            <span v-if="row.nextPlanTime">
              {{ $t('image.collections.field.nextPlanTime') }}:
              {{ formatDateTime(row.nextPlanTime) }}
            </span>
            <span v-else-if="row.intervalSeconds">
              {{ row.intervalSeconds }}
              {{ $t('image.collections.schedule.seconds') }}
            </span>
            <span v-else>-</span>
          </div>
        </template>

        <template #result="{ row }">
          <Space direction="vertical" size="small">
            <a
              v-if="row.resultRefType === 'IMAGE_ASSET' && row.resultRefId"
              :href="`/image/assets?assetId=${encodeURIComponent(row.resultRefId)}`"
            >
              {{ $t('image.collections.action.viewAsset') }}
            </a>
            <a
              :href="`/image/assets?sourceTaskId=${encodeURIComponent(row.taskId)}`"
            >
              {{ $t('image.collections.action.viewAllAssets') }}
            </a>
          </Space>
        </template>

        <template #operation="{ row }">
          <Space>
            <Button type="link" @click="openDetail(row)">
              {{ $t('image.collections.action.detail') }}
            </Button>
            <Dropdown
              v-if="actionItems(row).length > 0"
              :menu="{
                items: actionItems(row),
                onClick: (info: any) =>
                  control(row, String(info.key) as CollectionControlAction),
              }"
            >
              <Button
                type="link"
                :loading="actionBusy === row.taskId"
                :aria-label="$t('image.collections.action.more')"
              >
                {{ $t('image.collections.action.more') }}
              </Button>
            </Dropdown>
          </Space>
        </template>
      </Grid>
    </div>
  </Page>
</template>

<style scoped>
.collection-page {
  display: grid;
  gap: 16px;
}

@media (max-width: 767px) {
  :deep(.vxe-grid) {
    min-width: 960px;
  }
}
</style>
