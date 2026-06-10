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
  labRegister: m.labRegister,
  labUnregister: m.labUnregister,
}));

vi.mock('ant-design-vue', () => ({
  Button: {
    name: 'Button',
    props: ['loading', 'type', 'danger'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\', $event)"><slot/></button>',
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

function mountPanel(cfg: null | ProtocolLabApi.LabConfig = config) {
  return mount(ClientPanel, {
    props: { config: cfg, received: [] },
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
