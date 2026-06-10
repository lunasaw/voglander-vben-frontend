import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSseEvents } from '../useSseEvents';

/**
 * useSseEvents.ts —— SSE 长连接封装（协议验证台的实时数据通道）。
 *
 * 规格依据：GB28181-PROTOCOL-LAB-FRONTEND-PLAN.md §2.2 / §4.1。
 * 核心不变量：
 *  - 方向推断：clientcmd.* → in（设备收到），其余 → out（设备上行）
 *  - 订阅 URL 用「前缀域」（device.register→device 去重），addEventListener 用「完整 topic」
 *  - 去重：(topic|ts|业务id) 命中即丢（D8 双投兜底）
 *  - 背压：事件数组上限 500；seen 集合超 5000 清空
 *  - 鉴权：URL 携带 ?token=；重连：error 后 3s 自动重连；手动 close 取消重连
 */

// useAppConfig 桩：固定 apiURL=/api（dev 形态）。
vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/api' }),
}));

// useAccessStore 桩：固定 token。
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessToken: 'tkn-123' }),
}));

/** 可控的 EventSource 替身：记录 URL/监听器，提供 emit/触发 error 的测试钩子。 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];

  closed = false;
  listeners: Record<string, ((e: any) => void)[]> = {};
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  static last(): FakeEventSource {
    return FakeEventSource.instances.at(-1) as FakeEventSource;
  }

  static reset() {
    FakeEventSource.instances = [];
  }

  addEventListener(type: string, cb: (e: any) => void) {
    (this.listeners[type] ||= []).push(cb);
  }

  close() {
    this.closed = true;
  }

  /** 触发某 topic 的所有监听器（data 为 SSE 文本帧）。 */
  emit(type: string, data?: string) {
    for (const cb of this.listeners[type] ?? []) {
      cb({ data });
    }
  }
}

/** 在组件上下文中挂载 composable，返回其 API + wrapper（用于 unmount）。 */
function mountSse(topics: () => string[]) {
  let api!: ReturnType<typeof useSseEvents>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useSseEvents(topics);
        return () => h('div');
      },
    }),
  );
  return { api, wrapper };
}

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useSseEvents —— 建连与 URL', () => {
  it('topics 为空时 onMounted 不建连（等 config 就绪）', () => {
    mountSse(() => []);
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('topics 非空时建连，URL 携带前缀域订阅 + token', () => {
    mountSse(() => ['device.register', 'clientcmd.ptz']);
    const es = FakeEventSource.last();
    // 前缀域去重：device.register→device，clientcmd.ptz→clientcmd
    expect(es.url).toContain('topics=device%2Cclientcmd');
    expect(es.url).toContain('token=tkn-123');
    expect(es.url).toContain('/api/api/v1/stream/events');
  });

  it('addEventListener 用完整 topic（后端 event 名=完整 topic）', () => {
    mountSse(() => ['device.register', 'clientcmd.ptz']);
    const es = FakeEventSource.last();
    expect(Object.keys(es.listeners)).toContain('device.register');
    expect(Object.keys(es.listeners)).toContain('clientcmd.ptz');
  });

  it('前缀域去重：多个同前缀 topic 只产生一个订阅域', () => {
    mountSse(() => [
      'device.register',
      'device.online',
      'device.offline',
      'session.bye',
    ]);
    const url = FakeEventSource.last().url;
    const param = decodeURIComponent(url.match(/topics=([^&]+)/)?.[1] ?? '');
    expect(param.split(',').sort()).toEqual(['device', 'session']);
  });
});

describe('useSseEvents —— 事件解析与方向推断', () => {
  it('clientcmd.* 推断为 in，device.* 推断为 out', () => {
    const { api } = mountSse(() => ['clientcmd.ptz', 'device.register']);
    const es = FakeEventSource.last();
    es.emit('clientcmd.ptz', JSON.stringify({ ts: 1, platformId: 'p1' }));
    es.emit('device.register', JSON.stringify({ ts: 2, deviceId: 'd1' }));
    expect(api.events.value.map((e) => [e.topic, e.dir])).toEqual([
      ['clientcmd.ptz', 'in'],
      ['device.register', 'out'],
    ]);
  });

  it('payload.ts 缺失时回落本地时刻（Date.now）', () => {
    const { api } = mountSse(() => ['device.register']);
    FakeEventSource.last().emit(
      'device.register',
      JSON.stringify({ deviceId: 'd1' }),
    );
    expect(api.events.value[0]?.ts).toBeGreaterThan(0);
  });

  it('非法 JSON 不崩溃，降级为 {raw}', () => {
    const { api } = mountSse(() => ['device.register']);
    FakeEventSource.last().emit('device.register', '<<not-json>>');
    expect(api.events.value).toHaveLength(1);
    expect(api.events.value[0]?.data.raw).toBe('<<not-json>>');
  });

  it('seq 单调递增，保证稳定排序', () => {
    const { api } = mountSse(() => ['device.register']);
    const es = FakeEventSource.last();
    es.emit('device.register', JSON.stringify({ ts: 1, deviceId: 'a' }));
    es.emit('device.register', JSON.stringify({ ts: 2, deviceId: 'b' }));
    expect(api.events.value[0]?.seq).toBe(0);
    expect(api.events.value[1]?.seq).toBe(1);
  });
});

describe('useSseEvents —— 去重（D8 双投兜底）', () => {
  it('相同 (topic|ts|id) 第二次丢弃', () => {
    const { api } = mountSse(() => ['device.register']);
    const es = FakeEventSource.last();
    const frame = JSON.stringify({ ts: 100, deviceId: 'd1' });
    es.emit('device.register', frame);
    es.emit('device.register', frame); // 双投
    expect(api.events.value).toHaveLength(1);
  });

  it('id 相同但 ts 不同视为不同事件（保留）', () => {
    const { api } = mountSse(() => ['device.keepalive']);
    const es = FakeEventSource.last();
    es.emit('device.keepalive', JSON.stringify({ ts: 1, deviceId: 'd1' }));
    es.emit('device.keepalive', JSON.stringify({ ts: 2, deviceId: 'd1' }));
    expect(api.events.value).toHaveLength(2);
  });

  it('去重键按 callId/deviceId/clientId/platformId/sn 优先级取业务标识', () => {
    const { api } = mountSse(() => ['clientcmd.invite']);
    const es = FakeEventSource.last();
    // 同 ts、callId 相同 → 去重
    es.emit('clientcmd.invite', JSON.stringify({ ts: 5, callId: 'c1' }));
    es.emit('clientcmd.invite', JSON.stringify({ ts: 5, callId: 'c1' }));
    expect(api.events.value).toHaveLength(1);
  });
});

describe('useSseEvents —— 背压上限', () => {
  it('事件数组超 500 截尾保留最近 500 条', () => {
    const { api } = mountSse(() => ['device.keepalive']);
    const es = FakeEventSource.last();
    for (let i = 0; i < 520; i++) {
      es.emit('device.keepalive', JSON.stringify({ ts: i, deviceId: `d${i}` }));
    }
    expect(api.events.value).toHaveLength(500);
    // 保留的是最近的（最后一条 ts=519）
    expect(api.events.value.at(-1)?.ts).toBe(519);
    expect(api.events.value[0]?.ts).toBe(20);
  });
});

describe('useSseEvents —— 重连与关闭', () => {
  it('error 后 3s 自动重连（新建 EventSource）', () => {
    vi.useFakeTimers();
    mountSse(() => ['device.register']);
    expect(FakeEventSource.instances).toHaveLength(1);

    FakeEventSource.last().emit('error');
    expect(FakeEventSource.last().closed).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(FakeEventSource.instances).toHaveLength(2); // 已重连
  });

  it('手动 close 后不再重连，状态转 closed', () => {
    vi.useFakeTimers();
    const { api } = mountSse(() => ['device.register']);
    api.close();
    expect(api.status.value).toBe('closed');

    // close 之后即便定时器推进也不应再建连
    vi.advanceTimersByTime(5000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('open 事件把状态置为 open', () => {
    const { api } = mountSse(() => ['device.register']);
    expect(api.status.value).toBe('connecting');
    FakeEventSource.last().emit('open');
    expect(api.status.value).toBe('open');
  });

  it('组件卸载自动 close（onUnmounted）', () => {
    const { wrapper } = mountSse(() => ['device.register']);
    const es = FakeEventSource.last();
    wrapper.unmount();
    expect(es.closed).toBe(true);
  });
});

describe('useSseEvents —— restart 与 clear', () => {
  it('restart 在 config 就绪后用完整 topics 建连', () => {
    let topics: string[] = [];
    const { api } = mountSse(() => topics);
    expect(FakeEventSource.instances).toHaveLength(0); // 初始空，未建连

    topics = ['device.register', 'clientcmd.ptz'];
    api.restart();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.last().url).toContain('topics=');
  });

  it('clear 清空事件与去重集合（清空后同键事件可再次进入）', () => {
    const { api } = mountSse(() => ['device.register']);
    const es = FakeEventSource.last();
    const frame = JSON.stringify({ ts: 1, deviceId: 'd1' });
    es.emit('device.register', frame);
    expect(api.events.value).toHaveLength(1);

    api.clear();
    expect(api.events.value).toHaveLength(0);

    es.emit('device.register', frame); // clear 后 seen 已重置，可再次进入
    expect(api.events.value).toHaveLength(1);
  });
});
