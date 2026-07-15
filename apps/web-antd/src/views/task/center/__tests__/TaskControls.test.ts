import { mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import TaskDetailDrawer from '../TaskDetailDrawer.vue';

const m = vi.hoisted(() => ({
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  getTask: vi.fn(),
  hasAccess: vi.fn(),
  messageError: vi.fn(),
}));

vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: m.hasAccess }),
}));
vi.mock('#/api/task', () => ({
  cancelBusinessTask: (...args: unknown[]) => m.cancel(...args),
  getBusinessTask: (...args: unknown[]) => m.getTask(...args),
  pauseBusinessTask: (...args: unknown[]) => m.pause(...args),
  resumeBusinessTask: (...args: unknown[]) => m.resume(...args),
  retryBusinessTask: (...args: unknown[]) => m.retry(...args),
  getBusinessTaskExecutionPage: vi
    .fn()
    .mockResolvedValue({ total: 0, items: [] }),
  getBusinessTaskExecution: vi.fn(),
}));
vi.mock('ant-design-vue', () => ({
  Button: {
    name: 'Button',
    props: ['loading', 'disabled'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  Descriptions: { name: 'Descriptions', template: '<div><slot /></div>' },
  DescriptionsItem: {
    name: 'DescriptionsItem',
    template: '<div><slot /></div>',
  },
  Drawer: {
    name: 'Drawer',
    props: ['open', 'title'],
    template: '<aside v-if="open"><slot /></aside>',
  },
  Modal: {
    confirm: ({ onOk }: { onOk: () => void }) => onOk(),
  },
  Tag: { name: 'Tag', template: '<span><slot /></span>' },
  message: { error: m.messageError, success: vi.fn() },
}));

function mountDrawer() {
  return mount(TaskDetailDrawer, {
    props: {
      open: true,
      task: {
        taskId: 'btask_1',
        taskType: 'TEST',
        state: 'RUNNING',
        capabilities: ['PAUSE', 'CANCEL'],
        progressCurrent: 0,
        progressTotal: 0,
      },
    },
    global: {
      stubs: {
        TaskExecutionHistory: true,
        TaskProgress: true,
      },
    },
  });
}

describe('task detail drawer controls', () => {
  beforeEach(() => {
    for (const fn of [
      m.pause,
      m.resume,
      m.cancel,
      m.retry,
      m.getTask,
      m.messageError,
    ]) {
      fn.mockReset();
    }
  });

  it('checks permission at click time, confirms and refreshes after pause', async () => {
    m.hasAccess.mockReturnValue(true);
    m.pause.mockResolvedValueOnce({ taskId: 'btask_1', state: 'PAUSED' });
    m.getTask.mockResolvedValueOnce({ taskId: 'btask_1', state: 'PAUSED' });
    const wrapper = mountDrawer();

    await wrapper.find('[data-action="PAUSE"]').trigger('click');

    expect(m.pause).toHaveBeenCalledWith('btask_1', {});
    expect(m.getTask).toHaveBeenCalledWith('btask_1');
  });

  it('rejects a stale click without permission and never calls the API', async () => {
    m.hasAccess.mockReturnValue(true);
    const wrapper = mountDrawer();
    m.hasAccess.mockReturnValue(false);

    await wrapper.find('[data-action="PAUSE"]').trigger('click');

    expect(m.pause).not.toHaveBeenCalled();
    expect(m.messageError).toHaveBeenCalledWith(
      'task.center.message.permissionDenied',
    );
  });
});
