import { describe, expect, it, vi } from 'vitest';

import { TASK_STATISTIC_CARDS, useColumns, useGridFormSchema } from '../data';

vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

describe('task-center data definitions', () => {
  it('defines all backend statistics as bounded cards', () => {
    expect(TASK_STATISTIC_CARDS.map((card) => card.valueKey)).toEqual([
      'scheduledCount',
      'runningCount',
      'pausedCount',
      'cancellingCount',
      'completedTodayCount',
      'failedCount',
    ]);
  });

  it('uses only backend query fields and converts ranges in the view', () => {
    const fields = useGridFormSchema().map((schema) => schema.fieldName);
    expect(fields).toEqual(
      expect.arrayContaining([
        'taskId',
        'taskType',
        'state',
        'taskName',
        'ownerId',
        'createTime',
      ]),
    );
    expect(fields).not.toContain('progressPercent');
  });

  it('keeps deterministic columns and a fixed-right operation column', () => {
    const columns = useColumns(vi.fn()) as any[];
    expect(columns.map((column) => column.field)).toEqual([
      'taskName',
      'taskType',
      'state',
      'progress',
      'nextPlanTime',
      'lastExecuteTime',
      'ownerId',
      'createTime',
      'operation',
    ]);
    const operation = columns.at(-1);
    expect(operation.fixed).toBe('right');
    expect(operation.cellRender.name).toBe('CellOperation');
  });
});
