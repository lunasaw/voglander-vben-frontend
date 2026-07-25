import { mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import TaskExecutionHistory from '../TaskExecutionHistory.vue';

const getPage = vi.fn();
const getExecution = vi.fn();

vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/api/task', () => ({
  getBusinessTaskExecutionPage: (...args: unknown[]) => getPage(...args),
  getBusinessTaskExecution: (...args: unknown[]) => getExecution(...args),
}));

describe('task execution history', () => {
  beforeEach(() => {
    getPage.mockReset();
    getExecution.mockReset();
  });

  it('renders execution history and sanitized append-only events', async () => {
    getPage.mockResolvedValueOnce({
      total: 1,
      items: [
        {
          executionId: 'bexec_1',
          taskId: 'btask_1',
          state: 'FAILED',
          attemptCount: 2,
          failureCode: 'EXECUTION_TIMEOUT',
          failureMessage: 'Timed out',
        },
      ],
    });
    getExecution.mockResolvedValueOnce({
      executionId: 'bexec_1',
      taskId: 'btask_1',
      state: 'FAILED',
      events: [
        {
          eventId: 'bevt_1',
          eventType: 'FAILED',
          occurredAt: 1_725_000_000_000,
          failureCode: 'EXECUTION_TIMEOUT',
          failureMessage: 'Timed out',
          eventData: '{"phase":"capture"}',
        },
      ],
    });

    const wrapper = mount(TaskExecutionHistory, {
      props: { taskId: 'btask_1' },
    });
    await vi.waitFor(() =>
      expect(wrapper.findAll('.execution-row')).toHaveLength(1),
    );

    expect(wrapper.text()).toContain('bexec_1');
    expect(wrapper.text()).toContain('EXECUTION_TIMEOUT');
    expect(wrapper.find('.event-row').text()).toContain('FAILED');
    expect(wrapper.find('.event-row').text()).toContain('capture');
    expect(wrapper.text()).not.toContain('stack');
    expect(wrapper.text()).not.toContain('claimToken');
  });

  it('loads 20-row pages, sorts newest first and preserves selection on refresh', async () => {
    getPage
      .mockResolvedValueOnce({
        total: 3,
        items: [
          { executionId: 'bexec_old', plannedAt: 100, state: 'FAILED' },
          { executionId: 'bexec_latest', plannedAt: 300, state: 'SUCCEEDED' },
        ],
      })
      .mockResolvedValueOnce({
        total: 3,
        items: [
          { executionId: 'bexec_middle', plannedAt: 200, state: 'SUCCEEDED' },
        ],
      })
      .mockResolvedValueOnce({
        total: 2,
        items: [
          { executionId: 'bexec_fresh', plannedAt: 400, state: 'SUCCEEDED' },
          { executionId: 'bexec_old', plannedAt: 100, state: 'FAILED' },
        ],
      });
    getExecution.mockImplementation((executionId: string) =>
      Promise.resolve({ executionId, events: [] }),
    );

    const wrapper = mount(TaskExecutionHistory, {
      props: { refreshKey: 0, taskId: 'btask_1' },
    });
    await vi.waitFor(() =>
      expect(wrapper.findAll('.execution-row')).toHaveLength(2),
    );
    expect(wrapper.findAll('.execution-row')[0]?.text()).toContain(
      'bexec_latest',
    );

    await wrapper.findAll('.execution-row')[1]?.trigger('click');
    await vi.waitFor(() =>
      expect(getExecution).toHaveBeenLastCalledWith('bexec_old'),
    );
    const loadMore = wrapper
      .findAll('button')
      .find((button) =>
        button.text().includes('task.center.execution.loadMore'),
      );
    await loadMore?.trigger('click');
    await vi.waitFor(() =>
      expect(wrapper.findAll('.execution-row')).toHaveLength(3),
    );
    expect(wrapper.findAll('.execution-row').map((row) => row.text())).toEqual([
      expect.stringContaining('bexec_latest'),
      expect.stringContaining('bexec_middle'),
      expect.stringContaining('bexec_old'),
    ]);
    expect(getPage).toHaveBeenNthCalledWith(
      2,
      { page: 2, size: 20 },
      {
        sortDirection: 'DESC',
        sortField: 'plannedAt',
        taskId: 'btask_1',
      },
    );

    await wrapper.setProps({ refreshKey: 1 });
    await vi.waitFor(() =>
      expect(wrapper.findAll('.execution-row')).toHaveLength(2),
    );
    expect(wrapper.findAll('.execution-row')[0]?.text()).toContain(
      'bexec_fresh',
    );
    expect(getExecution).toHaveBeenLastCalledWith('bexec_old');
  });
});
