import type { BusinessTaskApi } from '../task';

import { describe, expect, it } from 'vitest';

import {
  EXECUTION_STATE_CODES,
  TASK_CAPABILITY_CODES,
  TASK_EVENT_CODES,
  TASK_FAILURE_CODES,
  TASK_MODE_CODES,
  TASK_STATE_CODES,
  TASK_TYPE_CODES,
} from '../task';

describe('business-task API types', () => {
  it('locks stable backend codes used by task center', () => {
    expect(TASK_TYPE_CODES).toEqual([
      'IMAGE_COLLECTION',
      'DATA_EXPORT',
      'DATA_IMPORT',
      'AI_ANALYSIS',
      'TEST',
    ]);
    expect(TASK_MODE_CODES).toEqual(['ONCE', 'AT_TIME', 'FIXED_RATE']);
    expect(TASK_STATE_CODES).toEqual([
      'SCHEDULED',
      'RUNNING',
      'PAUSED',
      'CANCELLING',
      'COMPLETED',
      'PARTIAL_COMPLETED',
      'FAILED',
      'CANCELLED',
    ]);
    expect(EXECUTION_STATE_CODES).toEqual([
      'PENDING',
      'RUNNING',
      'RETRY_WAIT',
      'SUCCEEDED',
      'FAILED',
      'MISSED',
      'CANCELLED',
    ]);
    expect(TASK_CAPABILITY_CODES).toEqual([
      'PAUSE',
      'CANCEL',
      'MANUAL_RETRY',
      'PROGRESS',
      'RESCHEDULE',
    ]);
    expect(TASK_EVENT_CODES).toContain('LEASE_EXPIRED');
    expect(TASK_FAILURE_CODES).toContain('SYSTEM_ERROR');
  });

  it('mirrors safe task, execution and event response shapes', () => {
    const event: BusinessTaskApi.BusinessTaskEventVO = {
      eventId: 'bevt_1',
      taskId: 'btask_1',
      executionId: 'bexec_1',
      eventType: 'PROGRESS',
      progressCurrent: 1,
      progressTotal: 2,
      occurredAt: 1_725_000_000_000,
    };
    const execution: BusinessTaskApi.BusinessTaskExecutionDetailVO = {
      executionId: 'bexec_1',
      taskId: 'btask_1',
      state: 'RUNNING',
      attemptCount: 1,
      maxAttempts: 2,
      events: [event],
    };
    const task: BusinessTaskApi.BusinessTaskDetailVO = {
      taskId: 'btask_1',
      taskType: 'IMAGE_COLLECTION',
      state: 'RUNNING',
      taskMode: 'ONCE',
      activeExecution: execution,
      capabilities: ['CANCEL', 'PROGRESS'],
    };

    expect(execution.events?.[0]?.eventType).toBe('PROGRESS');
    expect(task).not.toHaveProperty('payload');
    expect(execution).not.toHaveProperty('claimToken');
  });
});
