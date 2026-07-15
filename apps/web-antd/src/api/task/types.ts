/** Stable codes published by voglander-common task enums. */
export const TASK_TYPE_CODES = [
  'IMAGE_COLLECTION',
  'DATA_EXPORT',
  'DATA_IMPORT',
  'AI_ANALYSIS',
  'TEST',
] as const;

export const TASK_MODE_CODES = ['ONCE', 'AT_TIME', 'FIXED_RATE'] as const;

export const TASK_STATE_CODES = [
  'SCHEDULED',
  'RUNNING',
  'PAUSED',
  'CANCELLING',
  'COMPLETED',
  'PARTIAL_COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export const EXECUTION_STATE_CODES = [
  'PENDING',
  'RUNNING',
  'RETRY_WAIT',
  'SUCCEEDED',
  'FAILED',
  'MISSED',
  'CANCELLED',
] as const;

export const TASK_EVENT_CODES = [
  'CREATED',
  'SCHEDULED',
  'CLAIMED',
  'STARTED',
  'PROGRESS',
  'RETRY_SCHEDULED',
  'SUCCEEDED',
  'FAILED',
  'MISSED',
  'PAUSED',
  'RESUMED',
  'CANCELLING',
  'CANCELLED',
  'LEASE_EXPIRED',
  'MANUAL_RETRY',
] as const;

export const TASK_CAPABILITY_CODES = [
  'PAUSE',
  'CANCEL',
  'MANUAL_RETRY',
  'PROGRESS',
  'RESCHEDULE',
] as const;

export const TASK_FAILURE_CODES = [
  'HANDLER_NOT_FOUND',
  'PAYLOAD_INVALID',
  'CLAIM_CONFLICT',
  'LEASE_EXPIRED',
  'EXECUTION_TIMEOUT',
  'CANCELLED',
  'QUEUE_SATURATED',
  'RETRY_EXHAUSTED',
  'COMPLETION_FAILED',
  'SYSTEM_ERROR',
] as const;

export namespace BusinessTaskApi {
  export type TaskTypeCode = (typeof TASK_TYPE_CODES)[number];
  export type TaskModeCode = (typeof TASK_MODE_CODES)[number];
  export type TaskStateCode = (typeof TASK_STATE_CODES)[number];
  export type ExecutionStateCode = (typeof EXECUTION_STATE_CODES)[number];
  export type TaskEventCode = (typeof TASK_EVENT_CODES)[number];
  export type TaskCapabilityCode = (typeof TASK_CAPABILITY_CODES)[number];
  export type TaskFailureCode = (typeof TASK_FAILURE_CODES)[number];

  /** Safe task-center filters; time values are Unix milliseconds. */
  export interface BusinessTaskPageReq {
    taskId?: string;
    taskType?: string;
    state?: string;
    taskName?: string;
    ownerType?: string;
    ownerId?: string;
    organizationId?: string;
    subjectType?: string;
    subjectId?: string;
    bizKey?: string;
    createStartTime?: number;
    createEndTime?: number;
    scheduleStartTime?: number;
    scheduleEndTime?: number;
    sortField?: string;
    sortDirection?: string;
  }

  /** Safe execution-history filters; time values are Unix milliseconds. */
  export interface BusinessTaskExecutionPageReq {
    executionId?: string;
    taskId?: string;
    state?: string;
    retryable?: boolean;
    plannedStartTime?: number;
    plannedEndTime?: number;
    createStartTime?: number;
    createEndTime?: number;
    sortField?: string;
    sortDirection?: string;
  }

  /** Click-time command body shared by pause/resume/cancel/retry. */
  export interface BusinessTaskControlReq {
    expectedVersion?: number;
    executionId?: string;
    idempotencyKey?: string;
    reason?: string;
  }

  /** Sanitized task representation. Payload and persistence internals are absent. */
  export interface BusinessTaskVO {
    createTime?: number;
    updateTime?: number;
    taskId?: string;
    taskType?: string;
    taskName?: string;
    description?: string;
    taskMode?: string;
    scheduleStartTime?: number;
    scheduleEndTime?: number;
    intervalSeconds?: number;
    nextPlanTime?: number;
    scheduleVersion?: number;
    state?: string;
    priority?: number;
    lastExecutionId?: string;
    lastExecuteTime?: number;
    completedTime?: number;
    plannedCount?: number;
    successCount?: number;
    failedCount?: number;
    missedCount?: number;
    cancelledCount?: number;
    progressCurrent?: number;
    progressTotal?: number;
    progressMessage?: string;
    progressRevision?: number;
    bizKey?: string;
    subjectType?: string;
    subjectId?: string;
    resultRefType?: string;
    resultRefId?: string;
    resultSummary?: string;
    lastFailureCode?: string;
    lastFailureMessage?: string;
    originTaskId?: string;
    originExecutionId?: string;
    ownerType?: string;
    ownerId?: string;
    organizationId?: string;
  }

  export interface BusinessTaskDetailVO extends BusinessTaskVO {
    activeExecution?: BusinessTaskExecutionVO;
    capabilities?: string[];
  }

  /** Sanitized execution fact; lease internals are never exposed. */
  export interface BusinessTaskExecutionVO {
    executionId?: string;
    taskId?: string;
    scheduleVersion?: number;
    plannedAt?: number;
    deadlineAt?: number;
    state?: string;
    attemptCount?: number;
    maxAttempts?: number;
    nextAttemptTime?: number;
    startedAt?: number;
    heartbeatAt?: number;
    finishedAt?: number;
    progressCurrent?: number;
    progressTotal?: number;
    progressMessage?: string;
    progressRevision?: number;
    resultRefType?: string;
    resultRefId?: string;
    resultSummary?: string;
    failureCode?: string;
    failureMessage?: string;
    retryable?: boolean;
    retryOriginExecutionId?: string;
  }

  export interface BusinessTaskExecutionDetailVO extends BusinessTaskExecutionVO {
    events?: BusinessTaskEventVO[];
  }

  /** Sanitized append-only task event. */
  export interface BusinessTaskEventVO {
    eventId?: string;
    taskId?: string;
    executionId?: string;
    eventType?: string;
    fromState?: string;
    toState?: string;
    attemptNo?: number;
    progressCurrent?: number;
    progressTotal?: number;
    progressMessage?: string;
    failureCode?: string;
    failureMessage?: string;
    actorType?: string;
    actorId?: string;
    eventData?: string;
    occurredAt?: number;
  }

  export interface BusinessTaskStatisticsVO {
    scheduledCount?: number;
    runningCount?: number;
    pausedCount?: number;
    cancellingCount?: number;
    completedTodayCount?: number;
    failedCount?: number;
  }

  export interface BusinessTaskConstraintsVO {
    taskTypes?: string[];
    taskModes?: string[];
    taskStates?: string[];
    executionStates?: string[];
    capabilities?: Record<string, string[]>;
    maxPlannedCount?: number;
    maxScheduleDurationDays?: number;
    maxPayloadBytes?: number;
  }

  export interface BusinessTaskListResp {
    total?: number;
    items?: BusinessTaskVO[];
  }

  export interface BusinessTaskExecutionListResp {
    total?: number;
    items?: BusinessTaskExecutionVO[];
  }
}
