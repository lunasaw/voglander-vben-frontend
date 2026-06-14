import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceOperations from '../modules/device-operations.vue';

/**
 * device-operations.vue —— 设备操作面板（§4.3）。
 *
 * 规格依据：GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md §4.3 / §1.2 / §1.3。
 *  - 查询/录像/报警/广播按钮 → 调 api/device 对应函数，携带 deviceId
 *  - 配置下载 → downloadConfig(deviceId, configType)（configType 后端 @NotBlank）
 *  - PtzControl emit command → ptzControl(payload)（复用 /ptz，与协议台同源）
 *  - 点播 → liveStart({deviceId, channelId}) 拿 playUrls → 打开 MediaPlayer（复用 /live）
 *  - 权限双重防护：无权限时不调 API 且 message.error
 *  - 无设备（device=null）时命令禁用
 */

vi.mock('#/locales', () => ({ $t: (k: string) => k }));

const m = vi.hoisted(() => ({
  hasAccess: vi.fn(() => true),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  // api/device spies
  broadcast: vi.fn().mockResolvedValue(true),
  controlAlarm: vi.fn().mockResolvedValue(true),
  controlRecordStart: vi.fn().mockResolvedValue(true),
  controlRecordStop: vi.fn().mockResolvedValue(true),
  downloadConfig: vi.fn().mockResolvedValue(true),
  getDeviceChannelPage: vi.fn().mockResolvedValue({ total: 0, items: [] }),
  liveStart: vi.fn().mockResolvedValue(undefined),
  ptzControl: vi.fn().mockResolvedValue(true),
  queryAlarm: vi.fn().mockResolvedValue(true),
  queryCatalog: vi.fn().mockResolvedValue(true),
  queryDeviceInfo: vi.fn().mockResolvedValue(true),
  queryDeviceStatus: vi.fn().mockResolvedValue(true),
  queryMobilePosition: vi.fn().mockResolvedValue(true),
  queryPreset: vi.fn().mockResolvedValue(true),
  queryRecord: vi.fn().mockResolvedValue(true),
  toggleDeviceSubscription: vi.fn().mockResolvedValue(true),
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: m.hasAccess }),
}));

vi.mock('#/api/device', () => ({
  broadcast: m.broadcast,
  controlAlarm: m.controlAlarm,
  controlRecordStart: m.controlRecordStart,
  controlRecordStop: m.controlRecordStop,
  downloadConfig: m.downloadConfig,
  getDeviceChannelPage: m.getDeviceChannelPage,
  liveStart: m.liveStart,
  ptzControl: m.ptzControl,
  queryAlarm: m.queryAlarm,
  queryCatalog: m.queryCatalog,
  queryDeviceInfo: m.queryDeviceInfo,
  queryDeviceStatus: m.queryDeviceStatus,
  queryMobilePosition: m.queryMobilePosition,
  queryPreset: m.queryPreset,
  queryRecord: m.queryRecord,
  toggleDeviceSubscription: m.toggleDeviceSubscription,
}));

vi.mock('ant-design-vue', () => ({
  Button: {
    name: 'Button',
    props: ['disabled', 'loading', 'type', 'danger', 'size'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot/></button>',
  },
  Card: { name: 'Card', template: '<div class="card"><slot/></div>' },
  Descriptions: {
    name: 'Descriptions',
    template: '<div class="descriptions"><slot/></div>',
  },
  DescriptionsItem: {
    name: 'DescriptionsItem',
    template: '<div class="desc-item"><slot/></div>',
  },
  Divider: { name: 'Divider', template: '<hr/>' },
  message: { error: m.messageError, success: m.messageSuccess },
  Select: {
    name: 'Select',
    props: ['value', 'options'],
    emits: ['update:value'],
    template: '<select class="select"></select>',
  },
  Space: { name: 'Space', template: '<div class="space"><slot/></div>' },
  // 订阅开关：受控 :checked，点击 emit change(!checked)（模拟 ant Switch 切换）。
  Switch: {
    name: 'Switch',
    props: ['checked', 'loading', 'disabled', 'size'],
    emits: ['change'],
    template:
      '<button class="switch" :disabled="disabled" @click="$emit(\'change\', !checked)"></button>',
  },
}));

const device = {
  id: 1,
  deviceId: 'd1',
  name: 'cam',
  status: 1,
  statusName: '在线',
  channelCount: 4,
  keepaliveTime: 1000,
  subscription: { catalog: false, position: false, alarm: false },
};

function mountPanel(props: Record<string, any> = {}) {
  return mount(DeviceOperations, {
    props: { device, ...props },
    global: {
      stubs: {
        PtzControl: {
          name: 'PtzControl',
          props: ['deviceId', 'channelId', 'disabled', 'speed', 'labelPrefix'],
          emits: ['command'],
          template:
            '<div class="ptz-stub" @click="$emit(\'command\', { deviceId, channelId, command: \'UP\', speed: 128 })" />',
        },
        MediaPlayer: {
          name: 'MediaPlayer',
          props: ['open', 'playUrls', 'title', 'format'],
          emits: ['close'],
          template:
            '<div class="media-player-stub" :data-open="String(open)" @click="$emit(\'close\')" />',
        },
        SipTimeline: { template: '<div class="sip-timeline-stub" />' },
      },
    },
  });
}

function buttonByText(wrapper: any, text: string) {
  return wrapper.findAll('button').find((b: any) => b.text() === text);
}

beforeEach(() => {
  m.hasAccess.mockReset().mockReturnValue(true);
  m.messageError.mockReset();
  m.messageSuccess.mockReset();
  for (const k of [
    'broadcast',
    'controlAlarm',
    'controlRecordStart',
    'controlRecordStop',
    'downloadConfig',
    'getDeviceChannelPage',
    'liveStart',
    'ptzControl',
    'queryAlarm',
    'queryCatalog',
    'queryDeviceInfo',
    'queryDeviceStatus',
    'queryMobilePosition',
    'queryPreset',
    'queryRecord',
    'toggleDeviceSubscription',
  ] as const) {
    m[k].mockReset().mockResolvedValue(k === 'liveStart' ? undefined : true);
  }
  // 通道下拉默认空集（保持 channelId 回退 deviceId+'01'）。
  m.getDeviceChannelPage.mockResolvedValue({ total: 0, items: [] });
});

describe('deviceOperations —— 查询支链按钮（§1.2/§1.3）', () => {
  it('查目录 → queryCatalog(deviceId)', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.queryCatalog')?.trigger('click');
    expect(m.queryCatalog).toHaveBeenCalledWith('d1');
  });

  it('查设备信息 → queryDeviceInfo(deviceId)', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.queryInfo')?.trigger('click');
    expect(m.queryDeviceInfo).toHaveBeenCalledWith('d1');
  });

  it('查状态 → queryDeviceStatus(deviceId)', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.queryStatus')?.trigger('click');
    expect(m.queryDeviceStatus).toHaveBeenCalledWith('d1');
  });

  it('查预置位 → queryPreset(deviceId)（G2：仅查询，无下发）', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.queryPreset')?.trigger('click');
    expect(m.queryPreset).toHaveBeenCalledWith('d1');
  });

  it('查移动位置 → queryMobilePosition(deviceId)', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.queryMobilePosition')?.trigger(
      'click',
    );
    expect(m.queryMobilePosition).toHaveBeenCalledWith('d1');
  });
});

describe('deviceOperations —— 录像 / 报警 / 广播', () => {
  it('开始录像 → controlRecordStart(deviceId)', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.recordStart')?.trigger('click');
    expect(m.controlRecordStart).toHaveBeenCalledWith('d1');
  });

  it('停止录像 → controlRecordStop(deviceId)', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.recordStop')?.trigger('click');
    expect(m.controlRecordStop).toHaveBeenCalledWith('d1');
  });

  it('查报警 → queryAlarm({deviceId})', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.alarmQuery')?.trigger('click');
    expect(m.queryAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'd1' }),
    );
  });

  it('报警复位 → controlAlarm({deviceId})', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.alarmControl')?.trigger('click');
    expect(m.controlAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'd1' }),
    );
  });

  it('广播 → broadcast(deviceId)', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.broadcast')?.trigger('click');
    expect(m.broadcast).toHaveBeenCalledWith('d1');
  });
});

describe('deviceOperations —— 配置下载（configType 后端 @NotBlank）', () => {
  it('下载配置 → downloadConfig(deviceId, 默认 BASIC)', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.configDownload')?.trigger(
      'click',
    );
    expect(m.downloadConfig).toHaveBeenCalledWith('d1', 'BASIC');
  });
});

describe('deviceOperations —— 订阅开关（GB28181-2022 §9.11 SUBSCRIBE 真订阅）', () => {
  // 3 个 Switch 渲染序：catalog / position / alarm（与模板一致）。
  const SUB_ORDER = ['catalog', 'position', 'alarm'] as const;
  function switchAt(wrapper: any, kind: (typeof SUB_ORDER)[number]) {
    return wrapper.findAll('.switch').at(SUB_ORDER.indexOf(kind));
  }

  it('开目录订阅 → toggleDeviceSubscription(d1, CATALOG, true)', async () => {
    const wrapper = mountPanel();
    await switchAt(wrapper, 'catalog')?.trigger('click');
    expect(m.toggleDeviceSubscription).toHaveBeenCalledWith(
      'd1',
      'CATALOG',
      true,
    );
  });

  it('开位置订阅 → toggleDeviceSubscription(d1, MOBILE_POSITION, true)', async () => {
    const wrapper = mountPanel();
    await switchAt(wrapper, 'position')?.trigger('click');
    expect(m.toggleDeviceSubscription).toHaveBeenCalledWith(
      'd1',
      'MOBILE_POSITION',
      true,
    );
  });

  it('开告警订阅 → toggleDeviceSubscription(d1, ALARM, true)', async () => {
    const wrapper = mountPanel();
    await switchAt(wrapper, 'alarm')?.trigger('click');
    expect(m.toggleDeviceSubscription).toHaveBeenCalledWith(
      'd1',
      'ALARM',
      true,
    );
  });

  it('已开启的订阅再点 → 关闭（enabled=false）', async () => {
    const wrapper = mountPanel({
      device: {
        ...device,
        subscription: { catalog: true, position: false, alarm: false },
      },
    });
    await nextTick();
    await switchAt(wrapper, 'catalog')?.trigger('click');
    expect(m.toggleDeviceSubscription).toHaveBeenCalledWith(
      'd1',
      'CATALOG',
      false,
    );
  });

  it('成功后 message.success', async () => {
    const wrapper = mountPanel();
    await switchAt(wrapper, 'catalog')?.trigger('click');
    await nextTick();
    expect(m.messageSuccess).toHaveBeenCalled();
  });

  it('无权限时不调 API 且 message.error', async () => {
    m.hasAccess.mockReturnValue(false);
    const wrapper = mountPanel();
    await switchAt(wrapper, 'alarm')?.trigger('click');
    expect(m.toggleDeviceSubscription).not.toHaveBeenCalled();
    expect(m.messageError).toHaveBeenCalled();
  });

  it('device=null 时订阅开关禁用', () => {
    const wrapper = mountPanel({ device: null });
    expect(switchAt(wrapper, 'catalog')?.attributes('disabled')).toBeDefined();
  });
});

describe('deviceOperations —— PTZ 复用 /ptz（§1.3 同源）', () => {
  it('ptzControl emit command → ptzControl(payload 透传)', async () => {
    const wrapper = mountPanel();
    await wrapper.find('.ptz-stub').trigger('click');
    expect(m.ptzControl).toHaveBeenCalledWith({
      deviceId: 'd1',
      channelId: 'd101',
      command: 'UP',
      speed: 128,
    });
  });
});

describe('deviceOperations —— 点播复用 /live（§4.3 红线）', () => {
  const playUrls = { httpFlv: 'http://127.0.0.1:8082/rtp/s.live.flv' };

  it('点播默认不开播放器弹窗', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('.media-player-stub').attributes('data-open')).toBe(
      'false',
    );
  });

  it('点播 → liveStart({deviceId, channelId}) 拿 playUrls → 开播放器', async () => {
    m.liveStart.mockResolvedValueOnce({ status: 1, playUrls });
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.live')?.trigger('click');
    expect(m.liveStart).toHaveBeenCalledWith({
      deviceId: 'd1',
      channelId: 'd101',
    });
    await nextTick();
    await nextTick();
    const player = wrapper.findComponent({ name: 'MediaPlayer' });
    expect(player.props('open')).toBe(true);
    expect(player.props('playUrls')).toEqual(playUrls);
    expect(player.props('format')).toBe('httpFlv');
  });

  it('点播无 playUrls 时不开弹窗', async () => {
    m.liveStart.mockResolvedValueOnce({ status: 0, playUrls: null });
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.live')?.trigger('click');
    await nextTick();
    await nextTick();
    expect(wrapper.find('.media-player-stub').attributes('data-open')).toBe(
      'false',
    );
  });

  it('autoLive=true 时挂载即自动点播', async () => {
    m.liveStart.mockResolvedValueOnce({ status: 1, playUrls });
    mountPanel({ autoLive: true });
    await nextTick();
    expect(m.liveStart).toHaveBeenCalledWith({
      deviceId: 'd1',
      channelId: 'd101',
    });
  });
});

describe('deviceOperations —— 权限双重防护', () => {
  it('无权限时查目录不调 API 且 message.error', async () => {
    m.hasAccess.mockReturnValue(false);
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.queryCatalog')?.trigger('click');
    expect(m.queryCatalog).not.toHaveBeenCalled();
    expect(m.messageError).toHaveBeenCalled();
  });

  it('无权限时点播不调 liveStart', async () => {
    m.hasAccess.mockReturnValue(false);
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.live')?.trigger('click');
    expect(m.liveStart).not.toHaveBeenCalled();
  });
});

describe('deviceOperations —— 无设备门控', () => {
  it('device=null 时命令按钮禁用', () => {
    const wrapper = mountPanel({ device: null });
    const queryBtn = buttonByText(wrapper, 'device.action.queryCatalog');
    expect(queryBtn?.attributes('disabled')).toBeDefined();
  });

  it('device=null 时点击不调 API（即便绕过 disabled）', async () => {
    const wrapper = mountPanel({ device: null });
    const btn = buttonByText(wrapper, 'device.action.queryCatalog');
    await btn?.trigger('click');
    expect(m.queryCatalog).not.toHaveBeenCalled();
  });
});
