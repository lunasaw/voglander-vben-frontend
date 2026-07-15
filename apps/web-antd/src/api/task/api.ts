import type { BusinessTaskApi } from './types';

import { requestClient } from '#/api/request';

export interface BusinessTaskPageParams {
  page: number;
  size: number;
}

export async function getBusinessTaskPage(
  paging: BusinessTaskPageParams,
  filters: BusinessTaskApi.BusinessTaskPageReq = {},
) {
  return requestClient.post<BusinessTaskApi.BusinessTaskListResp>(
    `/api/v1/business-tasks/getPage?page=${paging.page}&size=${paging.size}`,
    filters,
  );
}

export async function getBusinessTask(taskId: string) {
  return requestClient.get<BusinessTaskApi.BusinessTaskDetailVO>(
    `/api/v1/business-tasks/${taskId}`,
  );
}

export async function getBusinessTaskStatistics() {
  return requestClient.get<BusinessTaskApi.BusinessTaskStatisticsVO>(
    '/api/v1/business-tasks/statistics',
  );
}

export async function getBusinessTaskConstraints() {
  return requestClient.get<BusinessTaskApi.BusinessTaskConstraintsVO>(
    '/api/v1/business-tasks/constraints',
  );
}

export async function getBusinessTaskExecutionPage(
  paging: BusinessTaskPageParams,
  filters: BusinessTaskApi.BusinessTaskExecutionPageReq = {},
) {
  return requestClient.post<BusinessTaskApi.BusinessTaskExecutionListResp>(
    `/api/v1/business-task-executions/getPage?page=${paging.page}&size=${paging.size}`,
    filters,
  );
}

export async function getBusinessTaskExecution(executionId: string) {
  return requestClient.get<BusinessTaskApi.BusinessTaskExecutionDetailVO>(
    `/api/v1/business-task-executions/${executionId}`,
  );
}

export async function pauseBusinessTask(
  taskId: string,
  command?: BusinessTaskApi.BusinessTaskControlReq,
) {
  return requestClient.post<BusinessTaskApi.BusinessTaskDetailVO>(
    `/api/v1/business-tasks/${taskId}:pause`,
    command ?? {},
  );
}

export async function resumeBusinessTask(
  taskId: string,
  command?: BusinessTaskApi.BusinessTaskControlReq,
) {
  return requestClient.post<BusinessTaskApi.BusinessTaskDetailVO>(
    `/api/v1/business-tasks/${taskId}:resume`,
    command ?? {},
  );
}

export async function cancelBusinessTask(
  taskId: string,
  command?: BusinessTaskApi.BusinessTaskControlReq,
) {
  return requestClient.post<BusinessTaskApi.BusinessTaskDetailVO>(
    `/api/v1/business-tasks/${taskId}:cancel`,
    command ?? {},
  );
}

export async function retryBusinessTask(
  taskId: string,
  command: BusinessTaskApi.BusinessTaskControlReq,
) {
  return requestClient.post<BusinessTaskApi.BusinessTaskDetailVO>(
    `/api/v1/business-tasks/${taskId}:retry`,
    command,
  );
}
