import type { BusinessTaskApi } from '#/api/task';

export interface TaskResultContext {
  task?: BusinessTaskApi.BusinessTaskVO;
  execution?: BusinessTaskApi.BusinessTaskExecutionVO;
}

export interface TaskResultView {
  href?: string;
  labelKey: string;
}

export type TaskResultRenderer = (
  context?: TaskResultContext,
) => TaskResultView | undefined;

export interface TaskTypeAdapter {
  labelKey: string;
  icon: string;
  detailRoute?: (task: BusinessTaskApi.BusinessTaskVO) => string | undefined;
  resultRenderer?: TaskResultRenderer;
}

export const UNKNOWN_TASK_TYPE_ADAPTER: TaskTypeAdapter = {
  labelKey: 'task.center.detail.unknownType',
  icon: 'lucide:circle-help',
};

const taskTypeAdapters = new Map<string, TaskTypeAdapter>([
  [
    'AI_ANALYSIS',
    {
      labelKey: 'task.center.type.aiAnalysis',
      icon: 'lucide:sparkles',
    },
  ],
  [
    'DATA_EXPORT',
    {
      labelKey: 'task.center.type.dataExport',
      icon: 'lucide:file-output',
    },
  ],
  [
    'DATA_IMPORT',
    {
      labelKey: 'task.center.type.dataImport',
      icon: 'lucide:file-input',
    },
  ],
  [
    'IMAGE_COLLECTION',
    {
      labelKey: 'task.center.type.imageCollection',
      icon: 'lucide:images',
      detailRoute: (task) =>
        task.taskId
          ? `/image/collections?taskId=${encodeURIComponent(task.taskId)}`
          : undefined,
      resultRenderer: (context) =>
        context?.task?.resultRefId
          ? {
              href: `/image/assets/${encodeURIComponent(context.task.resultRefId)}`,
              labelKey: 'task.center.action.viewResult',
            }
          : undefined,
    },
  ],
  [
    'TEST',
    {
      labelKey: 'task.center.type.test',
      icon: 'lucide:flask-conical',
    },
  ],
]);

export function registerTaskTypeAdapter(
  taskType: string,
  adapter: TaskTypeAdapter,
): void {
  if (!taskType.trim()) {
    throw new Error('taskType adapter key must not be blank');
  }
  taskTypeAdapters.set(taskType, adapter);
}

export function getTaskTypeAdapter(taskType?: string): TaskTypeAdapter {
  return (
    (taskType && taskTypeAdapters.get(taskType)) || UNKNOWN_TASK_TYPE_ADAPTER
  );
}
