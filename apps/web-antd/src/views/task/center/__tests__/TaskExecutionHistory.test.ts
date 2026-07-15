import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import TaskExecutionHistory from '../TaskExecutionHistory.vue';

const getPage = vi.fn();
const getExecution = vi.fn();

vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/api/task', () => ({
  getBusinessTaskExecutionPage: (...args: unknown[]) => getPage(...args),
  getBusinessTaskExecution: (...args: unknown[]) => getExecution(...args),
}));

describe('task execution history', () => {
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
});
