import type { LabEvent } from '../../../composables/useSseEvents';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ServerPanel from '../components/ServerPanel.vue';

/**
 * ServerPanel.vue —— 右侧平台控制台（最重业务逻辑）。
 *
 * 规格依据：§4.3。
 *  - 设备列表对 device.* 事件做 upsert：register/online/keepalive/catalog/info → online=true，offline → false
 *  - catalog 写 channelCount，info 写 manufacturer/model
 *  - 自动选中首个设备
 *  - C2 时序约束：未选中在线设备时命令区禁用
 *  - 通道号约定 deviceId+'01'
 */

vi.mock('#/locales', () => ({ $t: (k: string) => k }));

// vi.mock 工厂会被提升到文件顶部，工厂内若引用顶层变量会触发 TDZ；
// 故用 vi.hoisted 持有所有 spy，保证工厂执行时已初始化。
const m = vi.hoisted(() => ({
  liveStart: vi.fn().mockResolvedValue(undefined),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  ptzControl: vi.fn().mockResolvedValue(undefined),
  queryCatalog: vi.fn().mockResolvedValue(undefined),
  queryDeviceInfo: vi.fn().mockResolvedValue(undefined),
  rebootDevice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('#/api/protocol-lab', () => ({
  liveStart: m.liveStart,
  ptzControl: m.ptzControl,
  queryCatalog: m.queryCatalog,
  queryDeviceInfo: m.queryDeviceInfo,
  rebootDevice: m.rebootDevice,
}));

vi.mock('ant-design-vue', () => {
  const EmptyStub: any = {
    name: 'Empty',
    props: ['description', 'image'],
    template: '<div class="empty">{{ description }}</div>',
    PRESENTED_IMAGE_SIMPLE: 'simple',
  };
  return {
    Badge: {
      name: 'Badge',
      props: ['status'],
      template: '<span class="badge" :data-status="status"><slot/></span>',
    },
    Button: {
      name: 'Button',
      props: ['disabled', 'loading', 'type', 'danger'],
      emits: ['click'],
      template:
        '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot/></button>',
    },
    Card: { name: 'Card', template: '<div class="card"><slot/></div>' },
    Empty: EmptyStub,
    List: { name: 'List', template: '<div class="list"><slot/></div>' },
    ListItem: {
      name: 'ListItem',
      emits: ['click'],
      template: '<li class="list-item" @click="$emit(\'click\')"><slot/></li>',
    },
    message: { success: m.messageSuccess, warning: m.messageWarning },
    Space: { name: 'Space', template: '<div class="space"><slot/></div>' },
    Tooltip: {
      name: 'Tooltip',
      template: '<div class="tooltip"><slot/></div>',
    },
  };
});

function devEvent(topic: string, data: Record<string, any>, seq = 0): LabEvent {
  return { topic, data, ts: data.ts ?? seq, seq, dir: 'out' };
}

function mountPanel() {
  return mount(ServerPanel, {
    props: { events: [] },
    global: {
      stubs: {
        SipTimeline: { template: '<div class="sip-timeline-stub" />' },
      },
    },
  });
}

/** 找到可见文案精确等于 text 的按钮。 */
function buttonByText(wrapper: any, text: string) {
  return wrapper.findAll('button').find((b: any) => b.text() === text);
}

beforeEach(() => {
  m.ptzControl.mockClear();
  m.queryCatalog.mockClear();
  m.queryDeviceInfo.mockClear();
  m.rebootDevice.mockClear();
  m.liveStart.mockClear();
  m.messageWarning.mockClear();
  m.messageSuccess.mockClear();
});

describe('serverPanel —— 设备列表 upsert', () => {
  it('device.register 后设备出现且在线（badge=success）', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.register', { deviceId: 'd1' })],
    });
    await nextTick();

    expect(wrapper.find('.device-id').text()).toBe('d1');
    expect(wrapper.find('.badge').attributes('data-status')).toBe('success');
  });

  it('device.offline 把在线态置为 default（灰）', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.register', { deviceId: 'd1' })],
    });
    await nextTick();
    await wrapper.setProps({
      events: [devEvent('device.offline', { deviceId: 'd1' }, 1)],
    });
    await nextTick();

    expect(wrapper.find('.badge').attributes('data-status')).toBe('default');
  });

  it('device.catalog 写入 channelCount 并置在线', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.catalog', { deviceId: 'd1', channelCount: 8 })],
    });
    await nextTick();
    expect(wrapper.text()).toContain('8');
    expect(wrapper.find('.badge').attributes('data-status')).toBe('success');
  });

  it('device.info 写入 manufacturer', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [
        devEvent('device.info', { deviceId: 'd1', manufacturer: 'ACME' }),
      ],
    });
    await nextTick();
    expect(wrapper.text()).toContain('ACME');
  });

  it('无 deviceId 的事件被忽略，不产生空设备行', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('session.bye', { callId: 'c1' })],
    });
    await nextTick();
    expect(wrapper.findAll('.device-id')).toHaveLength(0);
  });
});

describe('serverPanel —— 自动选中与命令门控（C2）', () => {
  it('首个设备自动选中（active）', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.register', { deviceId: 'd1' })],
    });
    await nextTick();
    expect(wrapper.find('.list-item').classes()).toContain('active');
  });

  it('无在线设备时命令按钮禁用', () => {
    const wrapper = mountPanel();
    const btn = buttonByText(wrapper, 'protocolLab.server.queryCatalog');
    expect(btn?.attributes('disabled')).toBeDefined();
  });

  it('选中在线设备后命令按钮启用', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.register', { deviceId: 'd1' })],
    });
    await nextTick();
    const btn = buttonByText(wrapper, 'protocolLab.server.queryCatalog');
    expect(btn?.attributes('disabled')).toBeUndefined();
  });

  it('设备离线后命令按钮重新禁用', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.register', { deviceId: 'd1' })],
    });
    await nextTick();
    await wrapper.setProps({
      events: [devEvent('device.offline', { deviceId: 'd1' }, 1)],
    });
    await nextTick();
    const btn = buttonByText(wrapper, 'protocolLab.server.queryCatalog');
    expect(btn?.attributes('disabled')).toBeDefined();
  });
});

describe('serverPanel —— 命令下发', () => {
  async function onlineWrapper() {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.register', { deviceId: 'd1' })],
    });
    await nextTick();
    return wrapper;
  }

  it('查目录下发 queryCatalog(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'protocolLab.server.queryCatalog')?.trigger(
      'click',
    );
    expect(m.queryCatalog).toHaveBeenCalledWith('d1');
  });

  it('查设备信息下发 queryDeviceInfo(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'protocolLab.server.queryDeviceInfo')?.trigger(
      'click',
    );
    expect(m.queryDeviceInfo).toHaveBeenCalledWith('d1');
  });

  it('重启下发 rebootDevice(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'protocolLab.server.reboot')?.trigger('click');
    expect(m.rebootDevice).toHaveBeenCalledWith('d1');
  });

  it('pTZ 下发携带 channelId=deviceId+01 与 command/speed', async () => {
    const wrapper = await onlineWrapper();
    // 方向盘"上"按钮文案 = protocolLab.ptz.up
    await buttonByText(wrapper, 'protocolLab.ptz.up')?.trigger('click');
    expect(m.ptzControl).toHaveBeenCalledWith({
      deviceId: 'd1',
      channelId: 'd101',
      command: 'UP',
      speed: 128,
    });
  });

  it('点播下发 liveStart(deviceId, channelId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'protocolLab.server.play')?.trigger('click');
    expect(m.liveStart).toHaveBeenCalledWith({
      deviceId: 'd1',
      channelId: 'd101',
    });
  });

  it('下发成功提示 message.success', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'protocolLab.server.queryCatalog')?.trigger(
      'click',
    );
    await nextTick();
    expect(m.messageSuccess).toHaveBeenCalled();
  });
});
