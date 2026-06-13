import { mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEVICE_COMMANDS } from '../device-commands';
import DeviceCommandPanel from '../DeviceCommandPanel.vue';

/**
 * DeviceCommandPanel.vue —— 共享设备命令面板（查询/配置/录像/报警/广播/重启）。
 *
 * 规格依据：GB28181-COMMAND-PANEL-SHARED-PLAN.md §5。
 *  - 纯展示：渲染全部命令按钮（= DEVICE_COMMANDS），按 section 分组（Divider）
 *  - 点击 emit('command', { code, configType? })——不调 API、不做权限/在线判断
 *  - configDownload 前置 configType 下拉，emit 时带出当前选值（默认 BASIC）
 *  - disabled 时所有按钮禁用且点击不 emit（与 PtzControl 一致的自身门控）
 *  - 文案前缀默认 device，可由 labelPrefix 覆盖
 *  - 协议台与设备页共用本组件 → 协议能力对等，不得回归
 */

vi.mock('#/locales', () => ({ $t: (k: string) => k }));

vi.mock('ant-design-vue', () => ({
  Button: {
    name: 'Button',
    props: ['disabled', 'danger', 'type'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot/></button>',
  },
  Divider: { name: 'Divider', template: '<hr class="divider"><slot/></hr>' },
  Select: {
    name: 'Select',
    props: ['value', 'options', 'disabled'],
    emits: ['update:value'],
    template:
      '<select class="select" :disabled="disabled" @change="$emit(\'update:value\', $event.target.value)"></select>',
  },
  Space: { name: 'Space', template: '<div class="space"><slot/></div>' },
}));

function mountPanel(props: Record<string, any> = {}) {
  return mount(DeviceCommandPanel, { props });
}

/** 找到可见文案精确等于 text 的按钮。 */
function buttonByText(wrapper: any, text: string) {
  return wrapper.findAll('button').find((b: any) => b.text() === text);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deviceCommandPanel —— 渲染', () => {
  it('渲染全部命令按钮（数量 = DEVICE_COMMANDS）', () => {
    const wrapper = mountPanel();
    expect(wrapper.findAll('button')).toHaveLength(DEVICE_COMMANDS.length);
  });

  it('按钮文案默认走 device.action.<code>', () => {
    const wrapper = mountPanel();
    expect(buttonByText(wrapper, 'device.action.queryCatalog')).toBeTruthy();
    expect(buttonByText(wrapper, 'device.action.alarmControl')).toBeTruthy();
    expect(buttonByText(wrapper, 'device.action.broadcast')).toBeTruthy();
    expect(buttonByText(wrapper, 'device.action.reboot')).toBeTruthy();
  });

  it('协议全集逐项可见（查询五项/配置/录像三项/报警两项/广播/重启）', () => {
    const wrapper = mountPanel();
    for (const cmd of DEVICE_COMMANDS) {
      expect(
        buttonByText(wrapper, `device.action.${cmd.code}`),
        `缺命令按钮 ${cmd.code}`,
      ).toBeTruthy();
    }
  });

  it('labelPrefix 可覆盖 i18n 前缀（验证台可换其它前缀）', () => {
    const wrapper = mountPanel({ labelPrefix: 'protocolLab' });
    expect(
      buttonByText(wrapper, 'protocolLab.action.queryCatalog'),
    ).toBeTruthy();
    expect(buttonByText(wrapper, 'device.action.queryCatalog')).toBeFalsy();
  });

  it('config 分组前置 configType 下拉', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('.select').exists()).toBe(true);
  });
});

describe('deviceCommandPanel —— 命令下发', () => {
  it('点查目录 emit command { code: queryCatalog }', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.queryCatalog')?.trigger('click');
    expect(wrapper.emitted('command')?.[0]?.[0]).toMatchObject({
      code: 'queryCatalog',
    });
  });

  it('点报警复位 emit command { code: alarmControl }', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.alarmControl')?.trigger('click');
    expect(wrapper.emitted('command')?.[0]?.[0]).toMatchObject({
      code: 'alarmControl',
    });
  });

  it('点广播 emit command { code: broadcast }', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.broadcast')?.trigger('click');
    expect(wrapper.emitted('command')?.[0]?.[0]).toMatchObject({
      code: 'broadcast',
    });
  });

  it('非配置命令不带 configType', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.queryStatus')?.trigger('click');
    const payload = wrapper.emitted('command')?.[0]?.[0] as any;
    expect(payload.configType).toBeUndefined();
  });
});

describe('deviceCommandPanel —— configType 透传', () => {
  it('配置下载默认带 configType=BASIC', async () => {
    const wrapper = mountPanel();
    await buttonByText(wrapper, 'device.action.configDownload')?.trigger(
      'click',
    );
    expect(wrapper.emitted('command')?.[0]?.[0]).toMatchObject({
      code: 'configDownload',
      configType: 'BASIC',
    });
  });

  it('切换下拉后配置下载带新 configType', async () => {
    const wrapper = mountPanel();
    // 经 Select 组件 emit update:value 驱动 v-model（stub 不渲染 option，故直接 emit）。
    wrapper.findComponent({ name: 'Select' }).vm.$emit('update:value', 'VIDEO');
    await wrapper.vm.$nextTick();
    await buttonByText(wrapper, 'device.action.configDownload')?.trigger(
      'click',
    );
    expect(wrapper.emitted('command')?.[0]?.[0]).toMatchObject({
      code: 'configDownload',
      configType: 'VIDEO',
    });
  });
});

describe('deviceCommandPanel —— 禁用门控', () => {
  it('disabled=true 时所有按钮禁用', () => {
    const wrapper = mountPanel({ disabled: true });
    const allDisabled = wrapper
      .findAll('button')
      .every((b: any) => b.attributes('disabled') !== undefined);
    expect(allDisabled).toBe(true);
  });

  it('disabled=true 时点击不 emit（绕过浏览器 disabled 拦截验证组件自身门控）', async () => {
    const wrapper = mountPanel({ disabled: true });
    await wrapper.findAll('button')[0]?.trigger('click');
    expect(wrapper.emitted('command')).toBeFalsy();
  });

  it('默认（disabled=false）按钮不禁用', () => {
    const wrapper = mountPanel();
    const noneDisabled = wrapper
      .findAll('button')
      .every((b: any) => b.attributes('disabled') === undefined);
    expect(noneDisabled).toBe(true);
  });
});
