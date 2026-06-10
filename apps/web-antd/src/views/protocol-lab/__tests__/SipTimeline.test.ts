import type { LabEvent } from '../../../composables/useSseEvents';

import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import SipTimeline from '../components/SipTimeline.vue';

/**
 * SipTimeline.vue —— 阶梯式 SIP 事件时间线（左右两栏复用）。
 *
 * 规格依据：§4.4。以"设备"为参照系：out 渲染 ⬆（设备→平台），in 渲染 ⬇（平台→设备）；
 * 最新事件（seq 大）置顶；PTZ 摘要含方向+速度+hex。
 */

vi.mock('#/locales', () => ({ $t: (k: string) => k }));

// 轻量桩：Tag 透传默认插槽文本，Empty 透传 description，便于断言。
vi.mock('ant-design-vue', () => ({
  Empty: {
    name: 'Empty',
    props: ['description'],
    template: '<div class="empty">{{ description }}</div>',
  },
  Tag: {
    name: 'Tag',
    props: ['color'],
    template: '<span class="tag"><slot/></span>',
  },
}));

function ev(
  partial: Partial<LabEvent> & { seq: number; topic: string },
): LabEvent {
  return {
    data: {},
    dir: partial.topic.startsWith('clientcmd.') ? 'in' : 'out',
    ts: 1_700_000_000_000,
    ...partial,
  } as LabEvent;
}

describe('sipTimeline', () => {
  it('空事件渲染空态文案（emptyText 优先）', () => {
    const wrapper = mount(SipTimeline, {
      props: { events: [], emptyText: '自定义空态' },
    });
    expect(wrapper.find('.empty').text()).toBe('自定义空态');
  });

  it('未传 emptyText 时回退默认空态 key', () => {
    const wrapper = mount(SipTimeline, { props: { events: [] } });
    expect(wrapper.find('.empty').text()).toBe('protocolLab.timeline.empty');
  });

  it('按 seq 倒序渲染（最新置顶）', () => {
    // 用回退到 deviceId 摘要的 topic（online/keepalive/offline 不走特化摘要）
    const events = [
      ev({ topic: 'device.online', seq: 0, data: { deviceId: 'first' } }),
      ev({ topic: 'device.keepalive', seq: 1, data: { deviceId: 'second' } }),
      ev({ topic: 'device.offline', seq: 2, data: { deviceId: 'third' } }),
    ];
    const wrapper = mount(SipTimeline, { props: { events } });
    const items = wrapper.findAll('.timeline-item');
    expect(items).toHaveLength(3);
    // seq=2 的 third 在最前
    expect(items[0]?.text()).toContain('third');
    expect(items[2]?.text()).toContain('first');
  });

  it('方向箭头：in→⬇（dir-in），out→⬆（dir-out）', () => {
    const events = [
      ev({ topic: 'clientcmd.ptz', seq: 1, data: { parsed: {} } }),
      ev({ topic: 'device.register', seq: 0 }),
    ];
    const wrapper = mount(SipTimeline, { props: { events } });
    const items = wrapper.findAll('.timeline-item');
    // seq=1 的 clientcmd.ptz 在前
    expect(items[0]?.classes()).toContain('dir-in');
    expect(items[0]?.find('.arrow').text()).toBe('⬇');
    expect(items[1]?.classes()).toContain('dir-out');
    expect(items[1]?.find('.arrow').text()).toBe('⬆');
  });

  it('pTZ 摘要含方向+速度+hex（ptzCmd 优先作为 hex）', () => {
    const events = [
      ev({
        topic: 'clientcmd.ptz',
        seq: 0,
        data: {
          ptzCmd: 'A50F01',
          parsed: { direction: 'UP', speed: 128, hex: 'IGNORED' },
        },
      }),
    ];
    const wrapper = mount(SipTimeline, { props: { events } });
    const summary = wrapper.find('.summary').text();
    expect(summary).toContain('UP');
    expect(summary).toContain('speed=128');
    expect(summary).toContain('hex=A50F01');
  });

  it('device.register 摘要含 ip:port transport expire', () => {
    const events = [
      ev({
        topic: 'device.register',
        seq: 0,
        data: {
          remoteIp: '10.0.0.1',
          remotePort: 5060,
          transport: 'UDP',
          expire: 3600,
        },
      }),
    ];
    const wrapper = mount(SipTimeline, { props: { events } });
    const summary = wrapper.find('.summary').text();
    expect(summary).toContain('10.0.0.1:5060');
    expect(summary).toContain('UDP');
    expect(summary).toContain('expire=3600');
  });

  it('device.catalog 摘要含通道数', () => {
    const events = [
      ev({ topic: 'device.catalog', seq: 0, data: { channelCount: 8 } }),
    ];
    const wrapper = mount(SipTimeline, { props: { events } });
    expect(wrapper.find('.summary').text()).toContain('8');
  });

  it('register.fail 摘要含 statusCode', () => {
    const events = [
      ev({
        topic: 'clientcmd.register.fail',
        seq: 0,
        data: { statusCode: 401 },
      }),
    ];
    const wrapper = mount(SipTimeline, { props: { events } });
    expect(wrapper.find('.summary').text()).toContain('statusCode=401');
  });
});
