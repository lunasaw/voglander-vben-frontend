import type { BusinessTaskApi } from '#/api/task';

export type TaskCenterAction = 'CANCEL' | 'MANUAL_RETRY' | 'PAUSE' | 'RESUME';

export interface TaskActionContext {
  state?: string;
  capabilities?: readonly string[];
  permissions?: readonly string[];
}

export interface TaskProgressPresentation {
  mode: 'indeterminate' | 'quantified';
  percent: number | undefined;
  text: string;
  phase: string | undefined;
  ariaLabel: string;
}

/** Convert task-center form ranges to the backend's explicit millisecond fields. */
export function buildTaskPageBody(
  formValues: Record<string, unknown>,
): BusinessTaskApi.BusinessTaskPageReq {
  const ranges: Array<[string, string, string]> = [
    ['createTime', 'createStartTime', 'createEndTime'],
    ['scheduleTime', 'scheduleStartTime', 'scheduleEndTime'],
  ];
  const rangeFields = new Set(ranges.map(([field]) => field));
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(formValues)) {
    if (!rangeFields.has(key) && value !== undefined && value !== '') {
      body[key] = value;
    }
  }
  for (const [rangeField, startField, endField] of ranges) {
    const range = formValues[rangeField];
    if (Array.isArray(range) && range.length === 2 && range[0] && range[1]) {
      body[startField] = new Date(range[0] as Date | number | string).getTime();
      body[endField] = new Date(range[1] as Date | number | string).getTime();
    }
  }
  return body as BusinessTaskApi.BusinessTaskPageReq;
}

const CONTROL_PERMISSION = 'Task:Control';

const actionStates: Record<TaskCenterAction, readonly string[]> = {
  PAUSE: ['PAUSED', 'SCHEDULED', 'RUNNING'],
  RESUME: ['PAUSED'],
  CANCEL: ['SCHEDULED', 'RUNNING', 'PAUSED'],
  MANUAL_RETRY: ['FAILED'],
};

/** Derive visible controls from current state, Handler capabilities and permission. */
export function getTaskActions(context: TaskActionContext): TaskCenterAction[] {
  if (!context.permissions?.includes(CONTROL_PERMISSION)) {
    return [];
  }
  const capabilities = new Set(context.capabilities);
  const actions: TaskCenterAction[] = [];
  if (
    capabilities.has('PAUSE') &&
    actionStates.PAUSE.includes(context.state ?? '')
  ) {
    actions.push(context.state === 'PAUSED' ? 'RESUME' : 'PAUSE');
  }
  if (
    capabilities.has('CANCEL') &&
    actionStates.CANCEL.includes(context.state ?? '')
  ) {
    actions.push('CANCEL');
  }
  if (
    capabilities.has('MANUAL_RETRY') &&
    actionStates.MANUAL_RETRY.includes(context.state ?? '')
  ) {
    actions.push('MANUAL_RETRY');
  }
  return actions;
}

/** Build a non-color-only progress representation for quantified and unknown totals. */
export function presentTaskProgress(
  current = 0,
  total = 0,
  phase?: string,
): TaskProgressPresentation {
  const safeCurrent = Math.max(0, Number.isFinite(current) ? current : 0);
  const safeTotal = Math.max(0, Number.isFinite(total) ? total : 0);
  if (safeTotal > 0) {
    const percent = Math.min(
      100,
      Math.max(0, Math.round((safeCurrent / safeTotal) * 100)),
    );
    const text = `${safeCurrent} / ${safeTotal}`;
    return {
      mode: 'quantified',
      percent,
      text,
      phase,
      ariaLabel: `${phase ? `${phase}: ` : ''}${text} (${percent}%)`,
    };
  }
  const text = String(safeCurrent);
  return {
    mode: 'indeterminate',
    percent: undefined,
    text,
    phase,
    ariaLabel: `${phase ? `${phase}: ` : ''}${text}`,
  };
}
