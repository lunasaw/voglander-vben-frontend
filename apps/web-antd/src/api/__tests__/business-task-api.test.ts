import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cancelBusinessTask,
  getBusinessTask,
  getBusinessTaskConstraints,
  getBusinessTaskExecution,
  getBusinessTaskExecutionPage,
  getBusinessTaskPage,
  getBusinessTaskStatistics,
  pauseBusinessTask,
  resumeBusinessTask,
  retryBusinessTask,
} from '../task';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('#/api/request', () => ({
  requestClient: {
    get: (...args: any[]) => getMock(...args),
    post: (...args: any[]) => postMock(...args),
  },
}));

beforeEach(() => {
  getMock.mockReset().mockResolvedValue(undefined);
  postMock.mockReset().mockResolvedValue(undefined);
});

describe('business-task query API', () => {
  it('任务分页将 page/size 放 query、过滤条件放 body', async () => {
    await getBusinessTaskPage(
      { page: 2, size: 20 },
      { taskType: 'IMAGE_COLLECTION', state: 'RUNNING' },
    );
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/business-tasks/getPage?page=2&size=20',
      { taskType: 'IMAGE_COLLECTION', state: 'RUNNING' },
    );
  });

  it('查询没有 body 时发送空对象，并保持响应本体', async () => {
    postMock.mockResolvedValueOnce({ total: 1, items: [] });
    const result = await getBusinessTaskPage({ page: 1, size: 10 });
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/business-tasks/getPage?page=1&size=10',
      {},
    );
    expect(result).toEqual({ total: 1, items: [] });
  });

  it('任务详情、统计和约束使用 GET 端点', async () => {
    await getBusinessTask('btask_1');
    await getBusinessTaskStatistics();
    await getBusinessTaskConstraints();
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/business-tasks/btask_1',
      { signal: undefined, suppressGlobalError: true },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/business-tasks/statistics',
    );
    expect(getMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/business-tasks/constraints',
    );
  });

  it('执行分页和详情镜像后端路径', async () => {
    await getBusinessTaskExecutionPage(
      { page: 3, size: 5 },
      { taskId: 'btask_1', state: 'FAILED' },
    );
    await getBusinessTaskExecution('bexec_1');
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/business-task-executions/getPage?page=3&size=5',
      { taskId: 'btask_1', state: 'FAILED' },
      { suppressGlobalError: true },
    );
    expect(getMock).toHaveBeenCalledWith(
      '/api/v1/business-task-executions/bexec_1',
      { suppressGlobalError: true },
    );
  });
});

describe('business-task control API', () => {
  it('pause/resume/cancel 使用 POST、稳定冒号动作和 command body', async () => {
    const command = { expectedVersion: 3, reason: 'operator' };
    await pauseBusinessTask('btask_1', command);
    await resumeBusinessTask('btask_1', command);
    await cancelBusinessTask('btask_1', command);
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/business-tasks/btask_1:pause',
      command,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/business-tasks/btask_1:resume',
      command,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/business-tasks/btask_1:cancel',
      command,
    );
  });

  it('控制命令缺省 body 发送空对象，人工重试透传幂等键与执行 ID', async () => {
    await pauseBusinessTask('btask_1');
    await retryBusinessTask('btask_1', {
      executionId: 'bexec_1',
      idempotencyKey: 'retry-1',
    });
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/business-tasks/btask_1:pause',
      {},
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/business-tasks/btask_1:retry',
      { executionId: 'bexec_1', idempotencyKey: 'retry-1' },
    );
  });
});
