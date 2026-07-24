import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import TaskDetailDrawer from '../TaskDetailDrawer.vue';

vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('#/api/task', () => ({
  getBusinessTask: vi.fn().mockResolvedValue(undefined),
  getBusinessTaskExecutionPage: vi
    .fn()
    .mockResolvedValue({ total: 0, items: [] }),
  getBusinessTaskExecution: vi.fn(),
}));
vi.mock('ant-design-vue', () => ({
  Alert: {
    name: 'Alert',
    template: '<div><slot /><slot name="action" /></div>',
  },
  Button: { name: 'Button', template: '<button><slot /></button>' },
  Descriptions: { name: 'Descriptions', template: '<div><slot /></div>' },
  DescriptionsItem: {
    name: 'DescriptionsItem',
    props: ['label'],
    template:
      '<div class="description-item"><span>{{ label }}</span><slot /></div>',
  },
  Drawer: {
    name: 'Drawer',
    props: ['open', 'title'],
    emits: ['close', 'update:open'],
    template: '<aside v-if="open"><h2>{{ title }}</h2><slot /></aside>',
  },
  Spin: { name: 'Spin', template: '<span />' },
  Tag: { name: 'Tag', template: '<span><slot /></span>' },
}));

describe('task detail drawer', () => {
  it('shows summary, schedule, owner, counters and result navigation without payload', () => {
    const wrapper = mount(TaskDetailDrawer, {
      props: {
        open: true,
        task: {
          taskId: 'btask_1',
          taskType: 'IMAGE_COLLECTION',
          taskName: 'Front camera',
          state: 'COMPLETED',
          taskMode: 'ONCE',
          progressCurrent: 1,
          progressTotal: 1,
          successCount: 1,
          plannedCount: 1,
          ownerId: 'user-1',
          resultRefId: 'asset-1',
        },
      },
      global: {
        stubs: { TaskProgress: { template: '<div class="task-progress" />' } },
      },
    });

    expect(wrapper.text()).toContain('task.center.detail.summary');
    expect(wrapper.text()).toContain('btask_1');
    expect(wrapper.text()).toContain('user-1');
    expect(wrapper.text()).toContain('1');
    expect(wrapper.find('a[href="/image/assets/asset-1"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('payload');
  });
});
