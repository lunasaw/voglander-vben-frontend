<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { BusinessTaskApi } from '#/api/task';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Statistic } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBusinessTaskPage, getBusinessTaskStatistics } from '#/api/task';
import { $t } from '#/locales';

import { TASK_STATISTIC_CARDS, useColumns, useGridFormSchema } from './data';
import { useTaskCenterRefresh } from './refresh';
import TaskDetailDrawer from './TaskDetailDrawer.vue';
import { buildTaskPageBody } from './utils';

const statistics = ref<BusinessTaskApi.BusinessTaskStatisticsVO>({});
const selectedTask = ref<BusinessTaskApi.BusinessTaskDetailVO>();
const detailOpen = ref(false);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['createTime', ['createStartTime', 'createEndTime']]],
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns<BusinessTaskApi.BusinessTaskVO>(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getBusinessTaskPage(
            { page: page.currentPage, size: page.pageSize },
            buildTaskPageBody(formValues),
          ),
      },
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
  } as VxeTableGridOptions<BusinessTaskApi.BusinessTaskVO>,
});

async function loadStatistics() {
  statistics.value = (await getBusinessTaskStatistics()) ?? {};
}

async function refreshAll() {
  await Promise.all([gridApi.query(), loadStatistics()]);
}

function onActionClick({
  code,
  row,
}: OnActionClickParams<BusinessTaskApi.BusinessTaskVO>) {
  if (code === 'detail') {
    selectedTask.value = row;
    detailOpen.value = true;
  }
}

useTaskCenterRefresh(refreshAll);
onMounted(loadStatistics);
</script>

<template>
  <Page auto-content-height>
    <TaskDetailDrawer v-model:open="detailOpen" :task="selectedTask" />
    <div
      class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <Card v-for="card in TASK_STATISTIC_CARDS" :key="card.key" size="small">
        <Statistic
          :title="$t(card.labelKey)"
          :value="statistics[card.valueKey] ?? 0"
        />
      </Card>
    </div>
    <Grid>
      <template #toolbar-tools>
        <span class="text-base font-medium">{{ $t('task.center.title') }}</span>
      </template>
    </Grid>
  </Page>
</template>
