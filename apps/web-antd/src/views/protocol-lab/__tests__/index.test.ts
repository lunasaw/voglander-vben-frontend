import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import Index from '../index.vue';

/**
 * index.vue —— 协议验证台容器编排。
 *
 * 规格依据：§4.2。
 *  - onMounted 拉 config 成功 → restart() 用完整 topics 建 SSE；失败(404) → labDisabled 降级告警
 *  - 事件按前缀分流：clientcmd.* → 左 ClientPanel.received；其余 → 右 ServerPanel.events
 */

vi.mock('#/locales', () => ({ $t: (k: string) => k }));

const getLabConfig = vi.fn();
vi.mock('#/api/protocol-lab', () => ({
  getLabConfig: (...a: any[]) => getLabConfig(...a),
}));

// useSseEvents 桩：用 hoisted 持有的 ref 让测试可在 mount 前注入事件。
const h = vi.hoisted(() => ({
  clear: undefined as any,
  eventsRef: undefined as any,
  restart: undefined as any,
  statusRef: undefined as any,
}));

vi.mock('#/composables/useSseEvents', async () => {
  const { ref } = await import('vue');
  h.eventsRef = ref([]);
  h.statusRef = ref('connecting');
  h.restart = vi.fn();
  h.clear = vi.fn();
  return {
    useSseEvents: () => ({
      clear: h.clear,
      close: vi.fn(),
      events: h.eventsRef,
      restart: h.restart,
      status: h.statusRef,
    }),
  };
});

vi.mock('@vben/common-ui', () => ({
  Page: {
    name: 'Page',
    props: ['title', 'description'],
    template: '<div class="page"><slot name="extra"/><slot/></div>',
  },
}));

vi.mock('ant-design-vue', () => ({
  Alert: {
    name: 'Alert',
    props: ['type', 'message', 'description'],
    template: '<div class="alert">{{ message }}</div>',
  },
  Badge: {
    name: 'Badge',
    props: ['status', 'text'],
    template: '<span class="badge" :data-status="status">{{ text }}</span>',
  },
  Button: {
    name: 'Button',
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot/></button>',
  },
}));

const ClientStub = {
  name: 'ClientPanel',
  props: ['config', 'received'],
  template: '<div class="client-stub" />',
};
const ServerStub = {
  name: 'ServerPanel',
  props: ['events'],
  template: '<div class="server-stub" />',
};

function mountIndex() {
  return mount(Index, {
    global: {
      stubs: { ClientPanel: ClientStub, ServerPanel: ServerStub },
    },
  });
}

const okConfig = {
  clientId: 'c1',
  clientIp: '1.1.1.1',
  clientPort: 5061,
  serverId: 's1',
  serverIp: '2.2.2.2',
  serverPort: 5060,
  topics: ['device.register', 'clientcmd.ptz'],
};

beforeEach(() => {
  getLabConfig.mockReset();
  h.eventsRef.value = [];
  h.statusRef.value = 'connecting';
  h.restart?.mockClear?.();
  h.clear?.mockClear?.();
});

describe('index.vue —— config 建连/降级', () => {
  it('config 成功 → 调用 restart 建连，不显示降级告警', async () => {
    getLabConfig.mockResolvedValue(okConfig);
    const wrapper = mountIndex();
    await flushPromises();
    expect(h.restart).toHaveBeenCalled();
    expect(wrapper.find('.alert').exists()).toBe(false);
    expect(wrapper.find('.client-stub').exists()).toBe(true);
    expect(wrapper.find('.server-stub').exists()).toBe(true);
  });

  it('config 失败(404) → 降级告警，隐藏左右面板', async () => {
    getLabConfig.mockRejectedValue(new Error('404'));
    const wrapper = mountIndex();
    await flushPromises();
    expect(wrapper.find('.alert').exists()).toBe(true);
    expect(wrapper.find('.client-stub').exists()).toBe(false);
    expect(wrapper.find('.server-stub').exists()).toBe(false);
  });
});

describe('index.vue —— 事件按前缀分流', () => {
  it('clientcmd.* 进左 received，device/session/alarm 进右 events', async () => {
    getLabConfig.mockResolvedValue(okConfig);
    h.eventsRef.value = [
      { topic: 'clientcmd.ptz', data: {}, ts: 1, seq: 0, dir: 'in' },
      { topic: 'device.register', data: {}, ts: 2, seq: 1, dir: 'out' },
      { topic: 'session.bye', data: {}, ts: 3, seq: 2, dir: 'out' },
      { topic: 'clientcmd.reboot', data: {}, ts: 4, seq: 3, dir: 'in' },
    ];
    const wrapper = mountIndex();
    await flushPromises();

    const received = wrapper
      .findComponent(ClientStub)
      .props('received') as any[];
    const platform = wrapper.findComponent(ServerStub).props('events') as any[];

    expect(received.map((e) => e.topic)).toEqual([
      'clientcmd.ptz',
      'clientcmd.reboot',
    ]);
    expect(platform.map((e) => e.topic)).toEqual([
      'device.register',
      'session.bye',
    ]);
  });

  it('config 传入 ClientPanel.config', async () => {
    getLabConfig.mockResolvedValue(okConfig);
    const wrapper = mountIndex();
    await flushPromises();
    expect(wrapper.findComponent(ClientStub).props('config')).toMatchObject({
      clientId: 'c1',
    });
  });
});

describe('index.vue —— SSE 状态徽标', () => {
  it('connecting → processing；open → success；error → error；closed → default', async () => {
    getLabConfig.mockResolvedValue(okConfig);
    const wrapper = mountIndex();
    await flushPromises();

    h.statusRef.value = 'open';
    await flushPromises();
    expect(wrapper.find('.badge').attributes('data-status')).toBe('success');

    h.statusRef.value = 'error';
    await flushPromises();
    expect(wrapper.find('.badge').attributes('data-status')).toBe('error');

    h.statusRef.value = 'closed';
    await flushPromises();
    expect(wrapper.find('.badge').attributes('data-status')).toBe('default');
  });

  it('清空时间线按钮调用 clear', async () => {
    getLabConfig.mockResolvedValue(okConfig);
    const wrapper = mountIndex();
    await flushPromises();
    await wrapper.find('button').trigger('click');
    expect(h.clear).toHaveBeenCalled();
  });
});
