// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { h as createEl, defineComponent, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCascadeStatusRefresh } from '../useCascadeStatusRefresh';

// useSseEvents 桩：用 hoisted ref 让测试可在调用前注入事件
const h = vi.hoisted(() => ({
  eventsRef: undefined as any,
}));

vi.mock('#/composables/useSseEvents', async () => {
  const { ref } = await import('vue');
  h.eventsRef = ref([]);
  return {
    useSseEvents: () => ({ events: h.eventsRef }),
  };
});

function mountWith(
  onStatus: (platformId: string, registerStatus: number) => void,
  onPoll?: () => void,
) {
  return mount(
    defineComponent({
      setup() {
        useCascadeStatusRefresh(onStatus, onPoll, 0); // 关轮询，仅测 SSE
        return () => createEl('div');
      },
    }),
  );
}

describe('useCascadeStatusRefresh', () => {
  beforeEach(() => {
    h.eventsRef.value = [];
  });

  it('收到 cascade.register 事件 → 回调 platformId + registerStatus', async () => {
    const onStatus = vi.fn();
    mountWith(onStatus);

    h.eventsRef.value = [
      {
        topic: 'cascade.register',
        data: { platformId: '34020000002000000001', registerStatus: 1 },
        ts: 1,
        seq: 0,
        dir: 'out',
      },
    ];
    await nextTick();

    expect(onStatus).toHaveBeenCalledWith('34020000002000000001', 1);
  });

  it('非法 payload（缺字段）不触发回调', async () => {
    const onStatus = vi.fn();
    mountWith(onStatus);

    h.eventsRef.value = [
      { topic: 'cascade.register', data: {}, ts: 1, seq: 0, dir: 'out' },
    ];
    await nextTick();

    expect(onStatus).not.toHaveBeenCalled();
  });

  it('只取最新一条事件应用', async () => {
    const onStatus = vi.fn();
    mountWith(onStatus);

    h.eventsRef.value = [
      {
        topic: 'cascade.register',
        data: { platformId: 'p1', registerStatus: 0 },
        ts: 1,
        seq: 0,
        dir: 'out',
      },
      {
        topic: 'cascade.register',
        data: { platformId: 'p2', registerStatus: 3 },
        ts: 2,
        seq: 1,
        dir: 'out',
      },
    ];
    await nextTick();

    expect(onStatus).toHaveBeenLastCalledWith('p2', 3);
  });
});
