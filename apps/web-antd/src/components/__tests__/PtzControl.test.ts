import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import { PTZ_DIRECTIONS, PTZ_ZOOM } from '../ptz-control';
import PtzControl from '../PtzControl.vue';

/**
 * PtzControl.vue —— 从协议台 ServerPanel 提取的共享 PTZ 方向盘（F4）。
 *
 * 规格依据：GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md §4.4。
 *  - 渲染 3×3 八向方向盘 + STOP + 变倍（共 11 键，与 PTZ_DIRECTIONS/PTZ_ZOOM 一致）
 *  - 点击 emit('command', { deviceId, channelId, command, speed }) —— 携带完整下发上下文
 *  - disabled 时所有按钮禁用；speed 默认 128，可由 prop 覆盖
 *  - 按钮文案走 i18n：默认前缀 protocolLab.ptz.<key>，可由 labelPrefix 覆盖（设备页可换 device.ptz.*）
 *  - 协议台与设备页共用本组件，行为不得回归
 */

// $t 桩：回显 `${prefix}.${key}`，便于断言文案前缀拼装正确。
vi.mock('#/locales', () => ({ $t: (k: string) => k }));

vi.mock('ant-design-vue', () => ({
  Button: {
    name: 'Button',
    props: ['disabled', 'loading', 'size'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot/></button>',
  },
}));

function mountPtz(props: Record<string, any> = {}) {
  return mount(PtzControl, { props: { deviceId: 'd1', ...props } });
}

/** 找到可见文案精确等于 text 的按钮。 */
function buttonByText(wrapper: any, text: string) {
  return wrapper.findAll('button').find((b: any) => b.text() === text);
}

describe('ptzControl —— 渲染', () => {
  it('渲染全部 11 个 PTZ 按钮（8 向 + STOP + 2 变倍）', () => {
    const wrapper = mountPtz();
    expect(wrapper.findAll('button')).toHaveLength(
      PTZ_DIRECTIONS.length + PTZ_ZOOM.length,
    );
    expect(PTZ_DIRECTIONS.length + PTZ_ZOOM.length).toBe(11);
  });

  it('按钮文案默认走 protocolLab.ptz.<key>', () => {
    const wrapper = mountPtz();
    // 方向盘"上" → protocolLab.ptz.up
    expect(buttonByText(wrapper, 'protocolLab.ptz.up')).toBeTruthy();
    expect(buttonByText(wrapper, 'protocolLab.ptz.zoomIn')).toBeTruthy();
  });

  it('labelPrefix 可覆盖 i18n 前缀（设备页换 device.ptz.*）', () => {
    const wrapper = mountPtz({ labelPrefix: 'device.ptz' });
    expect(buttonByText(wrapper, 'device.ptz.up')).toBeTruthy();
    expect(buttonByText(wrapper, 'protocolLab.ptz.up')).toBeFalsy();
  });
});

describe('ptzControl —— 命令下发', () => {
  it('点击方向键 emit command 携带 deviceId/channelId/command/speed', async () => {
    const wrapper = mountPtz({ channelId: 'd101', speed: 64 });
    await buttonByText(wrapper, 'protocolLab.ptz.up')?.trigger('click');
    const emitted = wrapper.emitted('command');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0]).toEqual({
      deviceId: 'd1',
      channelId: 'd101',
      command: 'UP',
      speed: 64,
    });
  });

  it('speed 默认 128', async () => {
    const wrapper = mountPtz({ channelId: 'd101' });
    await buttonByText(wrapper, 'protocolLab.ptz.down')?.trigger('click');
    expect(wrapper.emitted('command')?.[0]?.[0]).toMatchObject({
      command: 'DOWN',
      speed: 128,
    });
  });

  it('变倍按钮 emit ZOOM_IN / ZOOM_OUT', async () => {
    const wrapper = mountPtz({ channelId: 'd101' });
    await buttonByText(wrapper, 'protocolLab.ptz.zoomIn')?.trigger('click');
    expect(wrapper.emitted('command')?.[0]?.[0]).toMatchObject({
      command: 'ZOOM_IN',
    });
  });

  it('channelId 缺省时 emit 不含 channelId 字段或为 undefined', async () => {
    const wrapper = mountPtz();
    await buttonByText(wrapper, 'protocolLab.ptz.stop')?.trigger('click');
    const payload = wrapper.emitted('command')?.[0]?.[0] as any;
    expect(payload.command).toBe('STOP');
    expect(payload.channelId).toBeUndefined();
  });
});

describe('ptzControl —— 禁用门控', () => {
  it('disabled=true 时所有按钮禁用', () => {
    const wrapper = mountPtz({ disabled: true });
    const allDisabled = wrapper
      .findAll('button')
      .every((b: any) => b.attributes('disabled') !== undefined);
    expect(allDisabled).toBe(true);
  });

  it('disabled=true 时点击不 emit command', async () => {
    const wrapper = mountPtz({ disabled: true });
    // 直接触发底层 button click（绕过 :disabled 的浏览器拦截）验证组件侧自身门控
    await wrapper.findAll('button')[1]?.trigger('click');
    expect(wrapper.emitted('command')).toBeFalsy();
  });

  it('默认（disabled=false）按钮不禁用', () => {
    const wrapper = mountPtz();
    const noneDisabled = wrapper
      .findAll('button')
      .every((b: any) => b.attributes('disabled') === undefined);
    expect(noneDisabled).toBe(true);
  });
});
