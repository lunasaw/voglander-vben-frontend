<script lang="ts" setup>
/* eslint-disable vue/html-closing-bracket-newline, vue/multiline-html-element-content-newline */
import type { TableProps } from 'ant-design-vue';

import type { DeviceApi } from '#/api/device';
import type { ImageApi } from '#/api/image';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { getDeviceChannelPage, getDevicePage } from '#/api/device';
import {
  createImageCollection,
  getImageCollectionConstraints,
  getImageCollectionPage,
} from '#/api/image';
import {
  cancelBusinessTask,
  getBusinessTask,
  pauseBusinessTask,
  resumeBusinessTask,
  retryBusinessTask,
} from '#/api/task';
import { useSseEvents } from '#/composables/useSseEvents';
import { $t } from '#/locales';

import {
  collectionActionAllowedWithPermission,
  collectionProgress,
  collectionQueryFromRoute,
  inclusivePlanCount,
} from './data';

const route = useRoute();
const { hasAccessByCodes } = useAccess();
const rows = ref<ImageApi.CollectionVO[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const formOpen = ref(false);
const detailOpen = ref(false);
const constraints = ref<ImageApi.CollectionConstraints>();
const selected = ref<ImageApi.CollectionVO>();
const deviceOptions = ref<
  Array<{ label: string; online: boolean; value: string }>
>([]);
const channelOptions = ref<
  Array<{ label: string; online: boolean; value: string }>
>([]);
const deviceLoading = ref(false);
const channelLoading = ref(false);
const filters = ref<ImageApi.CollectionQueryReq>(
  collectionQueryFromRoute(route.query),
);
const form = ref<ImageApi.CollectionCreateReq>({
  taskName: '',
  collectionMode: 'ONCE',
  deviceId: '',
  channelId: '',
});
const submitting = ref(false);
const actionBusy = ref<string>();
const formError = ref<string>();

const canQuery = computed(() => hasAccessByCodes(['Image:Collection:Query']));
const canCreate = computed(() => hasAccessByCodes(['Image:Collection:Create']));
const canControlImage = computed(() =>
  hasAccessByCodes(['Image:Collection:Control']),
);
const canControlTask = computed(() => hasAccessByCodes(['Task:Control']));
const canControl = computed(
  () => canControlImage.value && canControlTask.value,
);

const columns: TableProps['columns'] = [
  {
    title: $t('image.collections.field.name'),
    dataIndex: 'taskName',
    width: 180,
  },
  { title: $t('image.collections.field.camera'), key: 'camera', width: 220 },
  {
    title: $t('image.collections.field.mode'),
    dataIndex: 'taskMode',
    width: 110,
  },
  {
    title: $t('image.collections.field.state'),
    dataIndex: 'state',
    width: 130,
  },
  {
    title: $t('image.collections.field.progress'),
    key: 'progress',
    width: 120,
  },
  {
    title: $t('image.collections.field.actions'),
    key: 'actions',
    fixed: 'right' as const,
    width: 260,
  },
];
function collectionRecord(value: unknown) {
  return value as ImageApi.CollectionVO;
}

async function refresh() {
  if (!canQuery.value) return;
  loading.value = true;
  try {
    const result = await getImageCollectionPage(
      { page: page.value, size: 20 },
      filters.value,
    );
    rows.value = result?.items ?? [];
    total.value = result?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

async function loadDevices() {
  deviceLoading.value = true;
  try {
    const result = await getDevicePage({ page: 1, size: 200 }, {});
    deviceOptions.value = (result?.items ?? []).map(
      (device: DeviceApi.DeviceVO) => ({
        label: `${device.deviceId}${device.name ? ` · ${device.name}` : ''}`,
        value: device.deviceId,
        online: device.status === 1,
      }),
    );
  } finally {
    deviceLoading.value = false;
  }
}

async function loadChannels(deviceId = form.value.deviceId) {
  channelOptions.value = [];
  form.value.channelId = '';
  if (!deviceId) return;
  channelLoading.value = true;
  try {
    const result = await getDeviceChannelPage(
      { page: 1, size: 200 },
      { deviceId },
    );
    channelOptions.value = (result?.items ?? []).map(
      (channel: DeviceApi.DeviceChannelVO) => ({
        label: `${channel.channelId}${channel.name ? ` · ${channel.name}` : ''}`,
        value: channel.channelId,
        online: channel.status === 1,
      }),
    );
  } finally {
    channelLoading.value = false;
  }
}

async function showCreate() {
  if (!hasAccessByCodes(['Image:Collection:Create'])) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  constraints.value = await getImageCollectionConstraints();
  await loadDevices();
  form.value = {
    taskName: '',
    collectionMode: 'ONCE',
    deviceId: filters.value.deviceId ?? '',
    channelId: filters.value.channelId ?? '',
  };
  if (form.value.deviceId) {
    const channelId = form.value.channelId;
    await loadChannels(form.value.deviceId);
    form.value.channelId = channelId;
  }
  formError.value = undefined;
  formOpen.value = true;
}

async function submit() {
  if (!hasAccessByCodes(['Image:Collection:Create'])) return;
  const value = form.value;
  const count = inclusivePlanCount(
    value.scheduleStartTime,
    value.scheduleEndTime,
    value.intervalSeconds,
  );
  if (
    !value.taskName ||
    !value.deviceId ||
    !value.channelId ||
    (value.collectionMode === 'SCHEDULED' && count <= 0)
  ) {
    formError.value = $t('image.collections.error.invalid');
    return;
  }
  submitting.value = true;
  formError.value = undefined;
  try {
    await createImageCollection(value, crypto.randomUUID());
    formOpen.value = false;
    await refresh();
  } catch {
    formError.value = $t('image.collections.error.unknown');
  } finally {
    submitting.value = false;
  }
}

function actionAllowed(row: ImageApi.CollectionVO, capability: string) {
  return collectionActionAllowedWithPermission(
    row.state,
    capability,
    row.capabilities,
    canControlImage.value,
    canControlTask.value,
  );
}

async function control(
  row: ImageApi.CollectionVO,
  action: 'CANCEL' | 'MANUAL_RETRY' | 'PAUSE' | 'RESUME',
) {
  if (!canControl.value || !row.taskId || actionBusy.value) {
    message.error($t('image.common.permissionDenied'));
    return;
  }
  actionBusy.value = row.taskId;
  try {
    if (action === 'PAUSE')
      await pauseBusinessTask(row.taskId, { expectedVersion: row.version });
    if (action === 'RESUME')
      await resumeBusinessTask(row.taskId, { expectedVersion: row.version });
    if (action === 'CANCEL')
      await cancelBusinessTask(row.taskId, { expectedVersion: row.version });
    if (action === 'MANUAL_RETRY')
      await retryBusinessTask(row.taskId, {
        executionId: row.lastExecutionId,
        idempotencyKey: `manual-retry:${row.taskId}:${row.lastExecutionId}`,
      });
    await refresh();
  } catch {
    message.error($t('image.collections.error.stateConflict'));
    await refresh();
  } finally {
    actionBusy.value = undefined;
  }
}

async function showDetail(row: ImageApi.CollectionVO) {
  if (!hasAccessByCodes(['Image:Collection:Query'])) return;
  selected.value = row;
  detailOpen.value = true;
  const detail = await getBusinessTask(row.taskId);
  if (detail) selected.value = { ...row, ...detail };
}

const sse = useSseEvents(() => [
  'image.asset.created',
  'image.asset.deleted',
  'business.task.state',
  'business.task.progress',
  'business.task.execution-state',
]);
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
watch(sse.events, () => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void refresh(), 300);
});
watch(sse.status, (status, previous) => {
  if (status === 'open' && previous === 'error') void refresh();
});
onMounted(refresh);
</script>

<template>
  <Page auto-content-height>
    <Card :title="$t('image.collections.title')">
      <template #extra>
        <Button v-if="canCreate" type="primary" @click="showCreate">
          {{ $t('image.collections.action.create') }}
        </Button>
      </template>
      <Alert
        v-if="!canQuery"
        type="warning"
        show-icon
        :message="$t('image.common.permissionDenied')"
      />
      <Form v-else layout="inline" class="mb-4" @submit.prevent="refresh">
        <Form.Item :label="$t('image.collections.field.name')">
          <Input v-model:value="filters.taskName" allow-clear />
        </Form.Item>
        <Form.Item :label="$t('image.collections.field.state')">
          <Select
            v-model:value="filters.state"
            allow-clear
            class="min-w-32"
            :options="
              [
                'SCHEDULED',
                'RUNNING',
                'PAUSED',
                'COMPLETED',
                'FAILED',
                'CANCELLED',
              ].map((value) => ({
                label: $t(`image.collections.status.${value}`),
                value,
              }))
            "
          />
        </Form.Item>
        <Space>
          <Button type="primary" html-type="submit">
            {{ $t('common.search') }} </Button
          ><Button
            @click="
              filters = collectionQueryFromRoute(route.query);
              refresh();
            "
          >
            {{ $t('common.reset') }}
          </Button>
        </Space>
      </Form>
      <Spin :spinning="loading">
        <Empty
          v-if="!loading && rows.length === 0"
          :description="$t('image.collections.empty')"
        />
        <Table
          v-else
          :columns="columns"
          :data-source="rows"
          :pagination="{
            current: page,
            pageSize: 20,
            total,
            onChange: (value: number) => {
              page = value;
              refresh();
            },
          }"
          row-key="taskId"
          :scroll="{ x: 1100 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'camera'">
              {{ record.deviceName || record.deviceId }} /
              {{ record.channelName || record.channelId }}
            </template>
            <template v-else-if="column.key === 'progress'">
              {{
                collectionProgress(
                  record.progressCurrent ?? record.successCount,
                  record.progressTotal ?? record.plannedCount,
                )
              }}
            </template>
            <template v-else-if="column.dataIndex === 'state'">
              <Tag
                :color="
                  record.state === 'COMPLETED'
                    ? 'success'
                    : record.state === 'FAILED'
                      ? 'error'
                      : 'default'
                "
              >
                {{
                  $t(`image.collections.status.${record.state ?? 'unknown'}`)
                }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <Space wrap>
                <Button
                  type="link"
                  @click="showDetail(collectionRecord(record))"
                >
                  {{ $t('image.collections.action.detail') }} </Button
                ><Button
                  v-if="actionAllowed(collectionRecord(record), 'PAUSE')"
                  type="link"
                  :loading="actionBusy === collectionRecord(record).taskId"
                  @click="control(collectionRecord(record), 'PAUSE')"
                >
                  {{ $t('image.collections.action.pause') }} </Button
                ><Button
                  v-if="
                    collectionRecord(record).state === 'PAUSED' && canControl
                  "
                  type="link"
                  :loading="actionBusy === collectionRecord(record).taskId"
                  @click="control(collectionRecord(record), 'RESUME')"
                >
                  {{ $t('image.collections.action.resume') }} </Button
                ><Button
                  v-if="actionAllowed(collectionRecord(record), 'CANCEL')"
                  type="link"
                  danger
                  :loading="actionBusy === collectionRecord(record).taskId"
                  @click="control(collectionRecord(record), 'CANCEL')"
                >
                  {{ $t('image.collections.action.cancel') }} </Button
                ><Button
                  v-if="
                    collectionRecord(record).state === 'FAILED' && canControl
                  "
                  type="link"
                  @click="control(collectionRecord(record), 'MANUAL_RETRY')"
                >
                  {{ $t('image.collections.action.retry') }}
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </Spin>
    </Card>

    <Drawer
      v-model:open="formOpen"
      :title="$t('image.collections.action.create')"
      :width="520"
      destroy-on-close
    >
      <Form layout="vertical">
        <Form.Item :label="$t('image.collections.field.name')" required>
          <Input v-model:value="form.taskName" />
        </Form.Item>
        <Form.Item :label="$t('image.collections.field.mode')">
          <Select
            v-model:value="form.collectionMode"
            :options="[
              { label: $t('image.collections.mode.ONCE'), value: 'ONCE' },
              {
                label: $t('image.collections.mode.SCHEDULED'),
                value: 'SCHEDULED',
              },
            ]"
          />
        </Form.Item>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Form.Item :label="$t('image.collections.field.deviceId')" required>
            <Select
              v-model:value="form.deviceId"
              show-search
              :loading="deviceLoading"
              :options="
                deviceOptions.map((option) => ({
                  ...option,
                  label: option.online
                    ? `● ${option.label}`
                    : `○ ${option.label}`,
                }))
              "
              @change="() => loadChannels()"
            /> </Form.Item
          ><Form.Item :label="$t('image.collections.field.channelId')" required>
            <Select
              v-model:value="form.channelId"
              :loading="channelLoading"
              :disabled="!form.deviceId"
              :options="
                channelOptions.map((option) => ({
                  ...option,
                  disabled: !option.online,
                }))
              "
            />
          </Form.Item>
        </div>
        <template v-if="form.collectionMode === 'SCHEDULED'">
          <Form.Item :label="$t('image.collections.field.scheduleStart')">
            <InputNumber
              v-model:value="form.scheduleStartTime"
              class="w-full"
            /> </Form.Item
          ><Form.Item :label="$t('image.collections.field.scheduleEnd')">
            <InputNumber
              v-model:value="form.scheduleEndTime"
              class="w-full"
            /> </Form.Item
          ><Form.Item :label="$t('image.collections.field.interval')">
            <InputNumber
              v-model:value="form.intervalSeconds"
              :min="constraints?.minIntervalSeconds ?? 30"
              class="w-full"
            />
          </Form.Item>
          <p class="text-xs">
            {{
              $t('image.collections.schedule.count', {
                count: inclusivePlanCount(
                  form.scheduleStartTime,
                  form.scheduleEndTime,
                  form.intervalSeconds,
                ),
              })
            }}
          </p>
        </template>
        <Alert v-if="formError" type="error" show-icon :message="formError" />
        <Space class="mt-4">
          <Button @click="formOpen = false">
            {{ $t('image.collections.action.cancel') }} </Button
          ><Button type="primary" :loading="submitting" @click="submit">
            {{ $t('image.collections.action.submit') }}
          </Button>
        </Space>
      </Form>
    </Drawer>

    <Drawer
      v-model:open="detailOpen"
      :title="$t('image.collections.action.detail')"
      :width="520"
      destroy-on-close
    >
      <template v-if="selected">
        <p class="mb-2 font-medium">
          {{ selected.taskName || selected.taskId }}
        </p>
        <p>
          {{ selected.deviceName || selected.deviceId }} /
          {{ selected.channelName || selected.channelId }}
        </p>
        <p>
          {{ $t('image.collections.field.progress') }}:
          {{
            collectionProgress(
              selected.progressCurrent ?? selected.successCount,
              selected.progressTotal ?? selected.plannedCount,
            )
          }}
        </p>
        <p v-if="selected.resultRefId">
          <a :href="`/image/assets?assetId=${selected.resultRefId}`">{{
            $t('image.collections.action.viewAsset')
          }}</a>
        </p>
      </template>
    </Drawer>
  </Page>
</template>
