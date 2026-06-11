import type { ProtocolLabApi } from '#/api/protocol-lab';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ClientPanel from '../components/ClientPanel.vue';

/**
 * ClientPanel.vue —— 左侧设备 UA 控制台。
 *
 * 规格依据：§0/§4。
 *  - 身份卡展示 clientId / ip:port / 目标平台
 *  - 操作按钮接线到对应 lab API（注册带 expires=3600、上报目录带 channelCount）
 *  - 自动心跳开关：成功用后端回包状态，失败回滚开关
 */

vi.mock('#/locales', () => ({ $t: (k: string) => k }));

// vi.hoisted 持有 spy，规避 vi.mock 工厂提升导致的 TDZ。
const m = vi.hoisted(() => ({
  labKeepalive: vi.fn().mockResolvedValue(undefined),
  labKeepaliveAuto: vi.fn(),
  labPushAlarm: vi.fn().mockResolvedValue(undefined),
  labPushCatalog: vi.fn().mockResolvedValue(undefined),
  labPushDeviceInfo: vi.fn().mockResolvedValue(undefined),
  labPushStart: vi.fn().mockResolvedValue({ state: 'RUNNING' }),
  labPushStatus: vi.fn().mockResolvedValue({ state: 'IDLE' }),
  labPushStop: vi.fn().mockResolvedValue({ state: 'IDLE' }),
  labRegister: vi.fn().mockResolvedValue(undefined),
  labUnregister: vi.fn().mockResolvedValue(undefined),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
}));

vi.mock('#/api/protocol-lab', () => ({
  labKeepalive: m.labKeepalive,
  labKeepaliveAuto: m.labKeepaliveAuto,
  labPushAlarm: m.labPushAlarm,
  labPushCatalog: m.labPushCatalog,
  labPushDeviceInfo: m.labPushDeviceInfo,
  labPushStart: m.labPushStart,
  labPushStatus: m.labPushStatus,
  labPushStop: m.labPushStop,
  labRegister: m.labRegister,
  labUnregister: m.labUnregister,
}));

vi.mock('ant-design-vue', () => ({
  Button: {
    name: 'Button',
    props: ['loading', 'type', 'danger', 'disabled'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot/></button>',
  },
  Card: { name: 'Card', template: '<div class="card"><slot/></div>' },
  Checkbox: {
    name: 'Checkbox',
    props: ['checked'],
    emits: ['update:checked'],
    template:
      '<label class="checkbox" :data-checked="checked" @click="$emit(\'update:checked\', !checked)"><slot/></label>',
  },
  Divider: { name: 'Divider', template: '<hr/>' },
  Input: {
    name: 'Input',
    props: ['value'],
    emits: ['update:value'],
    template: '<input class="text" :value="value" />',
  },
  InputNumber: {
    name: 'InputNumber',
    props: ['value'],
    emits: ['update:value'],
    template: '<input class="num" :value="value" />',
  },
  InputPassword: {
    name: 'InputPassword',
    props: ['value'],
    emits: ['update:value'],
    template: '<input class="pwd" :value="value" />',
  },
  message: { error: m.messageError, success: m.messageSuccess },
  Select: {
    name: 'Select',
    props: ['value'],
    emits: ['update:value'],
    template: '<div class="select"><slot/></div>',
  },
  SelectOption: {
    name: 'SelectOption',
    props: ['value'],
    template: '<div class="select-option"><slot/></div>',
  },
  Space: { name: 'Space', template: '<div class="space"><slot/></div>' },
  Switch: {
    name: 'Switch',
    props: ['checked', 'loading'],
    emits: ['change'],
    template:
      '<button class="switch" :data-checked="checked" @click="$emit(\'change\', !checked)" />',
  },
  Tag: {
    name: 'Tag',
    props: ['color'],
    template: '<span class="tag"><slot/></span>',
  },
}));

const config: ProtocolLabApi.LabConfig = {
  clientId: '34020000001320000001',
  clientIp: '192.168.1.10',
  clientPort: 5061,
  serverId: '34020000002000000001',
  serverIp: '192.168.1.1',
  serverPort: 5060,
  serverDomain: '3402000000',
  transport: 'UDP',
  targetCustomized: false,
  topics: ['clientcmd.ptz'],
};

function mountPanel(
  cfg: null | ProtocolLabApi.LabConfig = config,
  received: any[] = [],
) {
  return mount(ClientPanel, {
    props: { config: cfg, received },
    global: {
      stubs: { SipTimeline: { template: '<div class="sip-timeline-stub" />' } },
    },
  });
}

function buttonByText(wrapper: any, text: string) {
  const btn = wrapper.findAll('button').find((b: any) => b.text() === text);
  if (!btn) {
    throw new Error(`button not found: ${text}`);
  }
  return btn;
}

beforeEach(() => {
  m.labRegister.mockClear().mockResolvedValue(undefined);
  m.labUnregister.mockClear().mockResolvedValue(undefined);
  m.labKeepalive.mockClear().mockResolvedValue(undefined);
  m.labKeepaliveAuto.mockReset();
  m.labPushCatalog.mockClear().mockResolvedValue(undefined);
  m.labPushDeviceInfo.mockClear().mockResolvedValue(undefined);
  m.labPushAlarm.mockClear().mockResolvedValue(undefined);
  m.labPushStart.mockClear().mockResolvedValue({ state: 'RUNNING' });
  m.labPushStatus.mockClear().mockResolvedValue({ state: 'IDLE' });
  m.labPushStop.mockClear().mockResolvedValue({ state: 'IDLE' });
  m.messageSuccess.mockClear();
  m.messageError.mockClear();
});

describe('clientPanel —— 身份卡', () => {
  it('展示 clientId 与 ip:port', () => {
    const wrapper = mountPanel();
    const text = wrapper.text();
    expect(text).toContain('34020000001320000001');
    expect(text).toContain('192.168.1.10:5061');
    expect(text).toContain('192.168.1.1:5060');
  });

  it('config 为空时身份字段回退 "-"', () => {
    const wrapper = mountPanel(null);
    expect(wrapper.find('.id-val').text()).toContain('-');
  });
});

describe('clientPanel —— 操作按钮接线', () => {
  it('注册按钮调用 labRegister({expires:3600})', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'protocolLab.client.register').trigger('click');
    expect(m.labRegister).toHaveBeenCalledWith({ expires: 3600 });
  });

  it('注销按钮调用 labUnregister()', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'protocolLab.client.unregister').trigger(
      'click',
    );
    expect(m.labUnregister).toHaveBeenCalled();
  });

  it('心跳按钮调用 labKeepalive()', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'protocolLab.client.keepalive').trigger(
      'click',
    );
    expect(m.labKeepalive).toHaveBeenCalled();
  });

  it('上报目录携带 channelCount（默认 4）', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'protocolLab.client.pushCatalog').trigger(
      'click',
    );
    expect(m.labPushCatalog).toHaveBeenCalledWith({ channelCount: 4 });
  });

  it('上报设备信息调用 labPushDeviceInfo()', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'protocolLab.client.pushDeviceInfo').trigger(
      'click',
    );
    expect(m.labPushDeviceInfo).toHaveBeenCalled();
  });

  it('上报告警携带 alarmType/priority', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'protocolLab.client.pushAlarm').trigger(
      'click',
    );
    expect(m.labPushAlarm).toHaveBeenCalledWith({ alarmType: 1, priority: 1 });
  });

  it('下发成功提示 message.success', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'protocolLab.client.register').trigger('click');
    await nextTick();
    expect(m.messageSuccess).toHaveBeenCalled();
  });
});

describe('clientPanel —— 自动心跳开关', () => {
  it('开启成功后采用后端回包状态', async () => {
    m.labKeepaliveAuto.mockResolvedValue({ enabled: true, intervalSec: 60 });
    const wrapper = mountPanel();
    await wrapper.find('.switch').trigger('click'); // 触发 change(true)
    await nextTick();
    expect(m.labKeepaliveAuto).toHaveBeenCalledWith({
      enabled: true,
      intervalSec: 30,
    });
    // 回包 intervalSec=60 写回开关已开
    expect(wrapper.find('.switch').attributes('data-checked')).toBe('true');
  });

  it('开启失败时回滚开关（保持关闭）', async () => {
    m.labKeepaliveAuto.mockRejectedValue(new Error('boom'));
    const wrapper = mountPanel();
    await wrapper.find('.switch').trigger('click');
    await nextTick();
    await nextTick();
    expect(wrapper.find('.switch').attributes('data-checked')).toBe('false');
  });
});

describe('clientPanel —— 自定义注册表单（§6 F1）', () => {
  /** 找到「自定义注册信息」折叠开关（唯一 .checkbox）。 */
  function toggle(wrapper: any) {
    return wrapper.find('.checkbox');
  }

  it('默认折叠：注册仍走自环（仅带 expires=3600）', async () => {
    const wrapper = mountPanel();
    expect(wrapper.find('.register-form').exists()).toBe(false);
    await buttonByText(wrapper, 'protocolLab.client.register').trigger('click');
    expect(m.labRegister).toHaveBeenCalledWith({ expires: 3600 });
  });

  it('展开后渲染目标 + 身份表单字段', async () => {
    const wrapper = mountPanel();
    await toggle(wrapper).trigger('click');
    await nextTick();
    expect(wrapper.find('.register-form').exists()).toBe(true);
    // 目标 5 项（serverId/ip/port/domain/transport）+ 身份 2 项（clientId/password）
    expect(wrapper.findAll('.register-item').length).toBe(7);
  });

  it('config 就绪后预填目标默认值', async () => {
    const wrapper = mountPanel();
    await toggle(wrapper).trigger('click');
    await nextTick();
    // serverId 输入框预填 config.serverId
    const [serverIdInput] = wrapper.findAll('input.text');
    expect((serverIdInput?.element as HTMLInputElement)?.value).toBe(
      '34020000002000000001',
    );
  });

  it('展开但 serverId 为空：拦截并提示，不调 labRegister', async () => {
    const wrapper = mountPanel(null); // 无 config → 不预填
    await toggle(wrapper).trigger('click');
    await nextTick();
    await buttonByText(wrapper, 'protocolLab.client.register').trigger('click');
    expect(m.labRegister).not.toHaveBeenCalled();
    expect(m.messageError).toHaveBeenCalledWith(
      'protocolLab.register.serverIdRequired',
    );
  });

  it('展开并填齐目标：带 target 字段调用 labRegister', async () => {
    const wrapper = mountPanel();
    await toggle(wrapper).trigger('click');
    await nextTick();
    // 预填了 config 的 serverId/serverIp，直接注册即带覆盖
    await buttonByText(wrapper, 'protocolLab.client.register').trigger('click');
    expect(m.labRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        expires: 3600,
        serverId: '34020000002000000001',
        serverIp: '192.168.1.1',
        serverPort: 5060,
        transport: 'UDP',
      }),
    );
  });

  it('targetCustomized=true 时身份卡显示「自定义」徽标', () => {
    const wrapper = mountPanel({ ...config, targetCustomized: true });
    expect(wrapper.find('.tag').text()).toContain(
      'protocolLab.register.customized',
    );
  });

  it('targetCustomized=false 时显示「自环」徽标', () => {
    const wrapper = mountPanel({ ...config, targetCustomized: false });
    expect(wrapper.find('.tag').text()).toContain(
      'protocolLab.register.selfLoop',
    );
  });
});

describe('clientPanel —— 模拟推流（1.0.7 §2/§4）', () => {
  /** 带 push 字段的 config（自动推流关闭，便于验手动窗口）。 */
  const pushConfig: ProtocolLabApi.LabConfig = {
    ...config,
    pushAuto: false,
    ffmpegPath: '/usr/local/bin/ffmpeg',
    mediaFile: '/Movies/demo.mp4',
    topics: ['clientcmd.invite', 'clientcmd.push.started'],
  };

  /** 构造一条 SSE 事件（仅 topic 触发 watcher 即可）。 */
  function ev(topic: string) {
    return { topic, data: {}, ts: Date.now(), seq: 0, dir: 'in' as const };
  }

  it('config 就绪后预填 ffmpeg / 文件路径输入框', async () => {
    const wrapper = mountPanel(pushConfig);
    await nextTick();
    // 折叠的注册表单不渲染，剩下的 input.text 即推流两输入框
    const texts = wrapper.findAll('input.text');
    const values = texts.map((t: any) => (t.element as HTMLInputElement).value);
    expect(values).toContain('/usr/local/bin/ffmpeg');
    expect(values).toContain('/Movies/demo.mp4');
  });

  it('挂载即拉一次 push 状态（labPushStatus 被调用）', async () => {
    mountPanel(pushConfig);
    await nextTick();
    expect(m.labPushStatus).toHaveBeenCalled();
  });

  it('无 INVITE 且 auto=false 时「模拟推流」按钮 disabled', async () => {
    const wrapper = mountPanel(pushConfig);
    await nextTick();
    const btn = buttonByText(wrapper, 'protocolLab.push.start');
    expect((btn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('auto=true 时「模拟推流」按钮可点（随时补推）', async () => {
    const wrapper = mountPanel({ ...pushConfig, pushAuto: true });
    await nextTick();
    const btn = buttonByText(wrapper, 'protocolLab.push.start');
    expect((btn.element as HTMLButtonElement).disabled).toBe(false);
  });

  it('收到 clientcmd.invite（手动模式）启动 8s 倒计时并放开按钮', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mountPanel(pushConfig);
      await nextTick();
      await wrapper.setProps({ received: [ev('clientcmd.invite')] });
      await nextTick();
      // ���计时条出现，按钮可点
      expect(wrapper.find('.push-countdown').exists()).toBe(true);
      const btn = buttonByText(wrapper, 'protocolLab.push.start');
      expect((btn.element as HTMLButtonElement).disabled).toBe(false);
      // 走完 8s 倒计时归零
      vi.advanceTimersByTime(8000);
      await nextTick();
      expect(wrapper.find('.push-countdown').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('点「模拟推流」调 labPushStart 携带 trim 后路径', async () => {
    const wrapper = mountPanel({ ...pushConfig, pushAuto: true });
    await nextTick();
    await buttonByText(wrapper, 'protocolLab.push.start').trigger('click');
    expect(m.labPushStart).toHaveBeenCalledWith({
      ffmpegPath: '/usr/local/bin/ffmpeg',
      mediaFile: '/Movies/demo.mp4',
    });
  });

  it('state=RUNNING 时「停止推流」可点并调 labPushStop', async () => {
    m.labPushStatus.mockResolvedValue({
      state: 'RUNNING',
      mediaIp: '127.0.0.1',
    });
    const wrapper = mountPanel(pushConfig);
    await nextTick();
    await nextTick(); // 等 refreshPushStatus 的 await 落地
    const stop = buttonByText(wrapper, 'protocolLab.push.stop');
    expect((stop.element as HTMLButtonElement).disabled).toBe(false);
    await stop.trigger('click');
    expect(m.labPushStop).toHaveBeenCalled();
  });

  it('收到 clientcmd.push.started 触发状态校准（再拉 status）', async () => {
    const wrapper = mountPanel(pushConfig);
    await nextTick();
    m.labPushStatus.mockClear();
    await wrapper.setProps({ received: [ev('clientcmd.push.started')] });
    await nextTick();
    expect(m.labPushStatus).toHaveBeenCalled();
  });

  it('卸载时清理轮询 / 倒计时定时器（不抛错）', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mountPanel(pushConfig);
      await nextTick();
      await wrapper.setProps({ received: [ev('clientcmd.invite')] });
      await nextTick();
      wrapper.unmount();
      // 卸载后推进时间不应再触发任何定时回调报错
      expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
