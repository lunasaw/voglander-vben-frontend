import { describe, expect, it } from 'vitest';

import apiDocument from '../../../api/voglander-api.md?raw';

describe('business-task OpenAPI snapshot', () => {
  it('同步后端任务与执行端点，并保留稳定契约字段', () => {
    expect(apiDocument).toContain('POST /api/v1/business-tasks/getPage');
    expect(apiDocument).toContain('GET /api/v1/business-tasks/{taskId}');
    expect(apiDocument).toContain('GET /api/v1/business-tasks/statistics');
    expect(apiDocument).toContain('GET /api/v1/business-tasks/constraints');
    expect(apiDocument).toContain(
      'POST /api/v1/business-task-executions/getPage',
    );
    expect(apiDocument).toContain(
      'GET /api/v1/business-task-executions/{executionId}',
    );
    expect(apiDocument).toContain('BusinessTaskExecutionVO');
    expect(apiDocument).toContain('finishedAt');
    expect(apiDocument).not.toContain('claimToken');
  });
});
