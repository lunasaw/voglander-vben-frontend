import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import listSource from '../list.vue?raw';
import detailContentSource from '../TaskDetailContent.vue?raw';
import TaskDetailDrawer from '../TaskDetailDrawer.vue';

vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('#/api/task', () => ({
  getBusinessTask: vi.fn(),
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
    template: '<div><slot /></div>',
  },
  Drawer: {
    name: 'Drawer',
    props: ['open', 'title'],
    emits: ['close'],
    template: '<aside v-if="open"><slot /></aside>',
  },
  Spin: { name: 'Spin', template: '<span />' },
  Tag: { name: 'Tag', template: '<span><slot /></span>' },
}));

describe('task-center responsive and keyboard accessibility', () => {
  it('returns focus to the trigger when the drawer closes', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const wrapper = mount(TaskDetailDrawer, {
      props: {
        open: true,
        returnFocus: trigger,
        task: { taskId: 'btask_1', taskType: 'TEST', state: 'RUNNING' },
      },
      global: { stubs: { TaskExecutionHistory: true, TaskProgress: true } },
    });

    await wrapper.findComponent({ name: 'Drawer' }).vm.$emit('close');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('keeps responsive grid classes, 44px control targets and textual status cues', () => {
    expect(listSource).toContain('grid-cols-1');
    expect(listSource).toContain('sm:grid-cols-2');
    expect(listSource).toContain('lg:grid-cols-3');
    expect(listSource).toContain('xl:grid-cols-6');
    expect(listSource).toContain('task.center.title');
    expect(detailContentSource).toContain('min-h-11');
  });
});
