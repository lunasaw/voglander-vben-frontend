import { onMounted, onUnmounted, ref, shallowRef } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

/**
 * 一条 Lab 事件（SSE 解析后归一化的结构）。
 *
 * 后端 `RedisBackedSseEventBus.publishLocal` 用 `event().name(topic)` 发送，
 * SSE `event:` 名 = 完整 topic（如 `device.register`/`clientcmd.ptz`），
 * `data` 是 `event.getData()` 的 JSON（即 payload 本体，不含 `{topic,data}` 外层包裹）。
 */
export interface LabEvent {
  /** 完整 topic，同时是分流键。 */
  topic: string;
  /** 后端 payload 本体（已 JSON.parse）。 */
  data: Record<string, any>;
  /** 后端时间戳（payload.ts，毫秒），缺失时回落本地接收时刻。 */
  ts: number;
  /** 前端单调递增序号，用于稳定排序 + 去重兜底。 */
  seq: number;
  /**
   * 相对"设备"的方向：
   * - `in`  平台 → 设备（设备"收到的指令"，左侧时间线，clientcmd.*）
   * - `out` 设备 → 平台（设备主动上报 / 平台感知，右侧时间线，device.* + session.* + alarm.*）
   */
  dir: 'in' | 'out';
}

/** SSE 连接状态。 */
export type SseStatus = 'closed' | 'connecting' | 'error' | 'open';

const CLIENTCMD_PREFIX = 'clientcmd.';

function directionOf(topic: string): 'in' | 'out' {
  // clientcmd.* 是平台下发到设备 UA 的指令，对设备而言是"收到"（in）。
  return topic.startsWith(CLIENTCMD_PREFIX) ? 'in' : 'out';
}

/**
 * 订阅后端 SSE 实时事件流。
 *
 * - 鉴权：EventSource 不支持自定义 header，token 走 URL `?token=`（与后端 `SseController` 一致）。
 * - URL：`${apiURL}/api/v1/stream/events`，`apiURL` 在 dev 下为 `/api`，由 vite 代理剥离首段后转发到 :8081
 *   （与 requestClient 完全同构，无需额外配置）。
 * - 订阅过滤用"前缀域"（`device,session,clientcmd,alarm`），但 `addEventListener` 必须用**完整 topic**
 *   （后端 event 名 = 完整 topic），故完整 topic 列表由 `/lab/client/config` 提供。
 * - 去重：规避单机 Redis 回环双投（D8），按 `(topic|ts|关键字段)` 去重。
 * - 重连：onerror 后 3s 自动重连。
 *
 * @param fullTopics 完整 topic 列表（来自后端 config.topics）；为空时只能等 config 就绪后调用 `restart`
 */
export function useSseEvents(fullTopics: () => string[]) {
  const events = shallowRef<LabEvent[]>([]);
  const status = ref<SseStatus>('closed');

  const seen = new Set<string>();
  let seq = 0;
  let es: EventSource | null = null;
  let reconnectTimer: null | ReturnType<typeof setTimeout> = null;
  let manuallyClosed = false;

  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

  /** 去重键：topic + ts + 业务标识（callId/deviceId/clientId/platformId/sn）。 */
  function dedupKey(topic: string, data: Record<string, any>): string {
    const id =
      data.callId ??
      data.deviceId ??
      data.clientId ??
      data.platformId ??
      data.sn ??
      '';
    return `${topic}|${data.ts ?? ''}|${id}`;
  }

  function pushEvent(topic: string, raw: string) {
    let data: Record<string, any>;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    const key = dedupKey(topic, data);
    if (seen.has(key)) {
      return; // D8 双投兜底
    }
    seen.add(key);
    // 控制 seen 体积，避免长连接内存增长
    if (seen.size > 5000) {
      seen.clear();
    }

    const ev: LabEvent = {
      topic,
      data,
      ts: typeof data.ts === 'number' ? data.ts : Date.now(),
      seq: seq++,
      dir: directionOf(topic),
    };
    // shallowRef：整体替换触发刷新；上限 500 条防止无限增长
    const next = [...events.value, ev];
    events.value = next.length > 500 ? next.slice(-500) : next;
  }

  /** 订阅 URL 用前缀域（device/session/clientcmd/alarm），减少订阅串长度。 */
  function subscribeTopicsParam(topics: string[]): string {
    const prefixes = new Set<string>();
    for (const t of topics) {
      const dot = t.indexOf('.');
      prefixes.add(dot > 0 ? t.slice(0, dot) : t);
    }
    return [...prefixes].join(',');
  }

  function connect() {
    const topics = fullTopics();
    if (topics.length === 0) {
      return; // 等 config 就绪后由 restart 触发
    }

    const accessStore = useAccessStore();
    const token = accessStore.accessToken ?? '';
    const topicsParam = subscribeTopicsParam(topics);
    const url = `${apiURL}/api/v1/stream/events?topics=${encodeURIComponent(
      topicsParam,
    )}&token=${encodeURIComponent(token)}`;

    status.value = 'connecting';
    es = new EventSource(url);

    es.addEventListener('open', () => {
      status.value = 'open';
    });

    // 后端 event 名 = 完整 topic，逐个 addEventListener 分流
    for (const topic of topics) {
      es.addEventListener(topic, (e) =>
        pushEvent(topic, (e as MessageEvent).data),
      );
    }

    es.addEventListener('error', () => {
      status.value = 'error';
      es?.close();
      es = null;
      if (!manuallyClosed) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    });
  }

  function close() {
    manuallyClosed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    es?.close();
    es = null;
    status.value = 'closed';
  }

  /** config 就绪后（拿到完整 topic 列表）重新建立连接。 */
  function restart() {
    manuallyClosed = false;
    es?.close();
    es = null;
    connect();
  }

  function clear() {
    events.value = [];
    seen.clear();
  }

  onMounted(connect);
  onUnmounted(close);

  return { events, status, restart, close, clear };
}
