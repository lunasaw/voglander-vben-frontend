import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import TaskProgress from '../TaskProgress.vue';

vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('ant-design-vue', () => ({
  Progress: {
    name: 'Progress',
    props: ['percent'],
    template: '<div class="progress" :data-percent="percent" />',
  },
}));

describe('task progress', () => {
  it('renders numbers, text and accessible label for quantified progress', () => {
    const wrapper = mount(TaskProgress, {
      props: { current: 25, total: 100, message: 'Downloading' },
    });

    expect(wrapper.find('[role="progressbar"]').attributes('aria-label')).toBe(
      'Downloading: 25 / 100 (25%)',
    );
    expect(wrapper.find('.progress').attributes('data-percent')).toBe('25');
    expect(wrapper.text()).toContain('25 / 100');
    expect(wrapper.text()).toContain('Downloading');
  });

  it('renders an indeterminate indicator with text when total is zero', () => {
    const wrapper = mount(TaskProgress, {
      props: { current: 3, total: 0, message: 'Preparing' },
    });

    expect(wrapper.find('[role="progressbar"]').attributes('aria-label')).toBe(
      'Preparing: 3',
    );
    expect(wrapper.find('.indeterminate').exists()).toBe(true);
    expect(wrapper.text()).toContain('Preparing');
    expect(wrapper.text()).toContain('3');
  });
});
