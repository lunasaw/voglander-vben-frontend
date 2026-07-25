import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { BusinessTaskApi } from '#/api/task';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

export const TASK_STATISTIC_CARDS = [
  {
    key: 'scheduled',
    labelKey: 'task.center.stats.scheduled',
    valueKey: 'scheduledCount',
  },
  {
    key: 'running',
    labelKey: 'task.center.stats.running',
    valueKey: 'runningCount',
  },
  {
    key: 'paused',
    labelKey: 'task.center.stats.paused',
    valueKey: 'pausedCount',
  },
  {
    key: 'cancelling',
    labelKey: 'task.center.stats.cancelling',
    valueKey: 'cancellingCount',
  },
  {
    key: 'completedToday',
    labelKey: 'task.center.stats.completedToday',
    valueKey: 'completedTodayCount',
  },
  {
    key: 'failed',
    labelKey: 'task.center.stats.failed',
    valueKey: 'failedCount',
  },
] as const;

const TASK_TYPE_OPTIONS = [
  { label: $t('task.center.type.imageCollection'), value: 'IMAGE_COLLECTION' },
  { label: $t('task.center.type.dataExport'), value: 'DATA_EXPORT' },
  { label: $t('task.center.type.dataImport'), value: 'DATA_IMPORT' },
  { label: $t('task.center.type.aiAnalysis'), value: 'AI_ANALYSIS' },
  { label: $t('task.center.type.test'), value: 'TEST' },
];

const TASK_STATE_OPTIONS = [
  'SCHEDULED',
  'RUNNING',
  'PAUSED',
  'CANCELLING',
  'COMPLETED',
  'PARTIAL_COMPLETED',
  'FAILED',
  'CANCELLED',
].map((value) => ({ label: $t(`task.center.status.${value}`), value }));

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'taskId',
      label: $t('task.center.filter.taskId'),
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: TASK_TYPE_OPTIONS },
      fieldName: 'taskType',
      label: $t('task.center.filter.taskType'),
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: TASK_STATE_OPTIONS },
      fieldName: 'state',
      label: $t('task.center.filter.state'),
    },
    {
      component: 'Input',
      fieldName: 'taskName',
      label: $t('task.center.filter.taskName'),
    },
    {
      component: 'Input',
      fieldName: 'ownerId',
      label: $t('task.center.filter.owner'),
    },
    {
      component: 'RangePicker',
      componentProps: { showTime: true },
      fieldName: 'createTime',
      label: $t('task.center.filter.createdAt'),
    },
  ];
}

function formatTaskTime({ cellValue }: { cellValue?: number }): string {
  return cellValue ? new Date(cellValue).toLocaleString() : '-';
}

function formatProgress(row: BusinessTaskApi.BusinessTaskVO): string {
  const current = row.progressCurrent ?? 0;
  const total = row.progressTotal ?? 0;
  return total > 0 ? `${current} / ${total}` : row.progressMessage || '-';
}

function statusColor(value: string): string {
  if (['COMPLETED', 'SUCCEEDED'].includes(value)) {
    return 'success';
  }
  if (value === 'FAILED') {
    return 'error';
  }
  return 'default';
}

export function useColumns<
  T extends BusinessTaskApi.BusinessTaskVO = BusinessTaskApi.BusinessTaskVO,
>(onActionClick: OnActionClickFn<T>): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();
  const statusOptions = TASK_STATE_OPTIONS.map(({ label, value }) => ({
    color: statusColor(value),
    label,
    value,
  }));

  return [
    {
      field: 'taskName',
      minWidth: 180,
      title: $t('task.center.field.taskName'),
    },
    {
      field: 'taskType',
      minWidth: 140,
      title: $t('task.center.field.taskType'),
    },
    {
      cellRender: { name: 'CellTag', options: statusOptions },
      field: 'state',
      minWidth: 130,
      title: $t('task.center.field.state'),
    },
    {
      field: 'progress',
      formatter: ({ row }: { row: BusinessTaskApi.BusinessTaskVO }) =>
        formatProgress(row),
      minWidth: 130,
      title: $t('task.center.field.progress'),
    },
    {
      field: 'nextPlanTime',
      formatter: formatTaskTime,
      minWidth: 170,
      title: $t('task.center.field.schedule'),
    },
    {
      field: 'lastExecuteTime',
      formatter: formatTaskTime,
      minWidth: 170,
      title: $t('task.center.field.lastExecution'),
    },
    {
      field: 'ownerId',
      minWidth: 130,
      title: $t('task.center.field.owner'),
    },
    {
      field: 'createTime',
      formatter: formatTaskTime,
      minWidth: 170,
      title: $t('task.center.field.createTime'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: { onClick: onActionClick },
        name: 'CellOperation',
        options: [
          {
            code: 'detail',
            show: () => hasAccessByCodes(['Task:Query']),
            text: $t('task.center.action.detail'),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('task.center.field.result'),
      width: 120,
    },
  ];
}
