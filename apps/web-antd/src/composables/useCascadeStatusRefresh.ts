import { onMounted, onUnmounted, watch } from 'vue';

import { useSseEvents } from '#/composables/useSseEvents';

/**
 * 级联平台注册状态实时刷新。
 *
 * - **SSE 推送**：订阅 `cascade.register`（后端 `CascadeClientRegisterListener` 在注册成功/失败时推送），
 *   收到后回调 `onStatusChange(platformId, registerStatus)` 让调用方更新表格行。
 * - **轮询兜底**：页面可见时每 `pollMs`（默认 15s）触发一次 `onPoll`，覆盖 SSE 漏投/断连场景。
 *
 * @param onStatusChange SSE 收到状态变更时回调（platformId + 0离线/1在线/2注册中/3失败）
 * @param onPoll 轮询兜底回调（通常为 gridApi.query），可选
 * @param pollMs 轮询间隔（毫秒），默认 15000；传 0 关闭轮询
 */
export function useCascadeStatusRefresh(
  onStatusChange: (platformId: string, registerStatus: number) => void,
  onPoll?: () => void,
  pollMs = 15_000,
) {
  const { events } = useSseEvents(() => ['cascade.register']);

  // events 为 shallowRef 整体替换，watch 取最新一条应用
  watch(events, (list) => {
    const last = list[list.length - 1];
    if (
      last?.topic === 'cascade.register' &&
      typeof last.data?.platformId === 'string' &&
      typeof last.data?.registerStatus === 'number'
    ) {
      onStatusChange(last.data.platformId, last.data.registerStatus);
    }
  });

  let pollTimer: null | ReturnType<typeof setInterval> = null;

  onMounted(() => {
    if (onPoll && pollMs > 0) {
      pollTimer = setInterval(() => {
        // 仅在页面可见时轮询，避免后台标签页无谓请求
        if (document.visibilityState === 'visible') {
          onPoll();
        }
      }, pollMs);
    }
  });

  onUnmounted(() => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });
}
