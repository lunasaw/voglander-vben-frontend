import { describe, expect, it } from 'vitest';

import {
  buildTaskPageBody,
  getTaskActions,
  presentTaskProgress,
} from '../utils';

describe('task-center pure functions', () => {
  it('converts date ranges to backend Unix-millisecond filters', () => {
    const body = buildTaskPageBody({
      taskType: 'IMAGE_COLLECTION',
      state: 'RUNNING',
      createTime: [
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-07-02T00:00:00.000Z'),
      ],
      scheduleTime: [
        new Date('2026-07-03T00:00:00.000Z'),
        new Date('2026-07-04T00:00:00.000Z'),
      ],
    });

    expect(body).toEqual({
      taskType: 'IMAGE_COLLECTION',
      state: 'RUNNING',
      createStartTime: Date.parse('2026-07-01T00:00:00.000Z'),
      createEndTime: Date.parse('2026-07-02T00:00:00.000Z'),
      scheduleStartTime: Date.parse('2026-07-03T00:00:00.000Z'),
      scheduleEndTime: Date.parse('2026-07-04T00:00:00.000Z'),
    });
  });

  it('derives actions from state, declared capabilities and Task:Control permission', () => {
    expect(
      getTaskActions({
        state: 'RUNNING',
        capabilities: ['PAUSE', 'CANCEL', 'MANUAL_RETRY'],
        permissions: ['Task:Query', 'Task:Control'],
      }),
    ).toEqual(['PAUSE', 'CANCEL']);
    expect(
      getTaskActions({
        state: 'FAILED',
        capabilities: ['MANUAL_RETRY'],
        permissions: ['Task:Query', 'Task:Control'],
      }),
    ).toEqual(['MANUAL_RETRY']);
    expect(
      getTaskActions({
        state: 'RUNNING',
        capabilities: ['PAUSE', 'CANCEL'],
        permissions: ['Task:Query'],
      }),
    ).toEqual([]);
  });

  it('presents quantified and indeterminate progress with accessible text', () => {
    expect(presentTaskProgress(25, 100, 'Downloading')).toEqual({
      mode: 'quantified',
      percent: 25,
      text: '25 / 100',
      phase: 'Downloading',
      ariaLabel: 'Downloading: 25 / 100 (25%)',
    });
    expect(presentTaskProgress(3, 0, 'Preparing')).toEqual({
      mode: 'indeterminate',
      percent: undefined,
      text: '3',
      phase: 'Preparing',
      ariaLabel: 'Preparing: 3',
    });
    expect(presentTaskProgress(120, 100)).toMatchObject({
      mode: 'quantified',
      percent: 100,
    });
  });
});
