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
  broadcast: vi.fn().mockResolvedValue(undefined),
  controlAlarm: vi.fn().mockResolvedValue(undefined),
  controlRecordStart: vi.fn().mockResolvedValue(undefined),
  controlRecordStop: vi.fn().mockResolvedValue(undefined),
  downloadConfig: vi.fn().mockResolvedValue(undefined),
  liveStart: vi.fn().mockResolvedValue(undefined),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  ptzControl: vi.fn().mockResolvedValue(undefined),
  queryAlarm: vi.fn().mockResolvedValue(undefined),
  queryCatalog: vi.fn().mockResolvedValue(undefined),
  queryDeviceInfo: vi.fn().mockResolvedValue(undefined),
  queryDeviceStatus: vi.fn().mockResolvedValue(undefined),
  queryMobilePosition: vi.fn().mockResolvedValue(undefined),
  queryPreset: vi.fn().mockResolvedValue(undefined),
  queryRecord: vi.fn().mockResolvedValue(undefined),
  rebootDevice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('#/api/protocol-lab', () => ({
  broadcast: m.broadcast,
  controlAlarm: m.controlAlarm,
  controlRecordStart: m.controlRecordStart,
  controlRecordStop: m.controlRecordStop,
  downloadConfig: m.downloadConfig,
  liveStart: m.liveStart,
  ptzControl: m.ptzControl,
  queryAlarm: m.queryAlarm,
  queryCatalog: m.queryCatalog,
  queryDeviceInfo: m.queryDeviceInfo,
  queryDeviceStatus: m.queryDeviceStatus,
  queryMobilePosition: m.queryMobilePosition,
  queryPreset: m.queryPreset,
  queryRecord: m.queryRecord,
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
    Divider: { name: 'Divider', template: '<hr class="divider"><slot/></hr>' },
    Empty: EmptyStub,
    List: { name: 'List', template: '<div class="list"><slot/></div>' },
    ListItem: {
      name: 'ListItem',
      emits: ['click'],
      template: '<li class="list-item" @click="$emit(\'click\')"><slot/></li>',
    },
    message: { success: m.messageSuccess, warning: m.messageWarning },
    Select: {
      name: 'Select',
      props: ['value', 'options', 'disabled'],
      emits: ['update:value'],
      template: '<select class="select" :disabled="disabled"></select>',
    },
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
        MediaPlayer: {
          name: 'MediaPlayer',
          props: ['open', 'playUrls', 'title', 'loading'],
          emits: ['close'],
          template:
            '<div class="media-player-stub" :data-open="String(open)" @click="$emit(\'close\')" />',
        },
      },
    },
  });
}

/** 找到可见文案精确等于 text 的按钮。 */
function buttonByText(wrapper: any, text: string) {
  return wrapper.findAll('button').find((b: any) => b.text() === text);
}

beforeEach(() => {
  for (const k of [
    'broadcast',
    'controlAlarm',
    'controlRecordStart',
    'controlRecordStop',
    'downloadConfig',
    'liveStart',
    'ptzControl',
    'queryAlarm',
    'queryCatalog',
    'queryDeviceInfo',
    'queryDeviceStatus',
    'queryMobilePosition',
    'queryPreset',
    'queryRecord',
    'rebootDevice',
    'messageWarning',
    'messageSuccess',
  ] as const) {
    m[k].mockClear();
  }
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
    const btn = buttonByText(wrapper, 'device.action.queryCatalog');
    expect(btn?.attributes('disabled')).toBeDefined();
  });

  it('选中在线设备后命令按钮启用', async () => {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.register', { deviceId: 'd1' })],
    });
    await nextTick();
    const btn = buttonByText(wrapper, 'device.action.queryCatalog');
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
    const btn = buttonByText(wrapper, 'device.action.queryCatalog');
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
    await buttonByText(wrapper, 'device.action.queryCatalog')?.trigger('click');
    expect(m.queryCatalog).toHaveBeenCalledWith('d1');
  });

  it('查设备信息下发 queryDeviceInfo(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.queryInfo')?.trigger('click');
    expect(m.queryDeviceInfo).toHaveBeenCalledWith('d1');
  });

  it('重启下发 rebootDevice(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.reboot')?.trigger('click');
    expect(m.rebootDevice).toHaveBeenCalledWith('d1');
  });

  it('查状态下发 queryDeviceStatus(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.queryStatus')?.trigger('click');
    expect(m.queryDeviceStatus).toHaveBeenCalledWith('d1');
  });

  it('查预置位下发 queryPreset(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.queryPreset')?.trigger('click');
    expect(m.queryPreset).toHaveBeenCalledWith('d1');
  });

  it('查移动位置下发 queryMobilePosition(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.queryMobilePosition')?.trigger(
      'click',
    );
    expect(m.queryMobilePosition).toHaveBeenCalledWith('d1');
  });

  it('配置下载下发 downloadConfig(selectedId, BASIC)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.configDownload')?.trigger(
      'click',
    );
    expect(m.downloadConfig).toHaveBeenCalledWith('d1', 'BASIC');
  });

  it('开始/停止录像下发 controlRecordStart/Stop(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.recordStart')?.trigger('click');
    expect(m.controlRecordStart).toHaveBeenCalledWith('d1');
    await buttonByText(wrapper, 'device.action.recordStop')?.trigger('click');
    expect(m.controlRecordStop).toHaveBeenCalledWith('d1');
  });

  it('录像查询下发 queryRecord({deviceId})', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.recordQuery')?.trigger('click');
    expect(m.queryRecord).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'd1' }),
    );
  });

  it('报警查询 / 复位下发 queryAlarm / controlAlarm({deviceId})', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.alarmQuery')?.trigger('click');
    expect(m.queryAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'd1' }),
    );
    await buttonByText(wrapper, 'device.action.alarmControl')?.trigger('click');
    expect(m.controlAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'd1' }),
    );
  });

  it('广播下发 broadcast(selectedId)', async () => {
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'device.action.broadcast')?.trigger('click');
    expect(m.broadcast).toHaveBeenCalledWith('d1');
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
    await buttonByText(wrapper, 'device.action.queryCatalog')?.trigger('click');
    await nextTick();
    expect(m.messageSuccess).toHaveBeenCalled();
  });
});

describe('serverPanel —— 点播后自动开播放器弹窗', () => {
  const playUrls = {
    httpFlv: 'http://127.0.0.1:8082/rtp/s.live.flv',
    hls: 'http://127.0.0.1:8082/rtp/s/hls.m3u8',
    rtmp: 'rtmp://127.0.0.1:1935/rtp/s',
  };

  async function onlineWrapper() {
    const wrapper = mountPanel();
    await wrapper.setProps({
      events: [devEvent('device.register', { deviceId: 'd1' })],
    });
    await nextTick();
    return wrapper;
  }

  it('点播默认不开弹窗（初始 open=false）', async () => {
    const wrapper = await onlineWrapper();
    expect(wrapper.find('.media-player-stub').attributes('data-open')).toBe(
      'false',
    );
  });

  it('liveStart 返回 playUrls 后打开弹窗并透传地址', async () => {
    m.liveStart.mockResolvedValueOnce({ status: 1, playUrls });
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'protocolLab.server.play')?.trigger('click');
    await nextTick();
    await nextTick();

    const player = wrapper.findComponent({ name: 'MediaPlayer' });
    expect(player.props('open')).toBe(true);
    expect(player.props('playUrls')).toEqual(playUrls);
  });

  it('liveStart 无 playUrls（点播失败）时不开弹窗', async () => {
    m.liveStart.mockResolvedValueOnce({ status: 0, playUrls: null });
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'protocolLab.server.play')?.trigger('click');
    await nextTick();
    await nextTick();

    expect(wrapper.find('.media-player-stub').attributes('data-open')).toBe(
      'false',
    );
  });

  it('弹窗 close 事件后 open 回落 false', async () => {
    m.liveStart.mockResolvedValueOnce({ status: 1, playUrls });
    const wrapper = await onlineWrapper();
    await buttonByText(wrapper, 'protocolLab.server.play')?.trigger('click');
    await nextTick();
    await nextTick();

    await wrapper.find('.media-player-stub').trigger('click'); // 触发 close
    await nextTick();
    const player = wrapper.findComponent({ name: 'MediaPlayer' });
    expect(player.props('open')).toBe(false);
  });
});
