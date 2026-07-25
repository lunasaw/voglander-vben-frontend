import { onUnmounted, watch } from 'vue';

import { useSseEvents } from '#/composables/useSseEvents';

export const TASK_CENTER_SSE_TOPICS = [
  'business.task.state',
  'business.task.progress',
  'business.task.execution-state',
];

export interface TaskRefreshCoalescer {
  dispose: () => void;
  onReconnect: () => void;
  schedule: () => void;
}

export function createTaskRefreshCoalescer(
  refresh: () => void,
  delayMs = 300,
): TaskRefreshCoalescer {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule() {
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      refresh();
    }, delayMs);
  }

  function onReconnect() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    refresh();
  }

  function dispose() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  return { dispose, onReconnect, schedule };
}

/** Subscribe to task SSE hints while always refreshing from the database. */
export function useTaskCenterRefresh(refresh: () => void) {
  const coalescer = createTaskRefreshCoalescer(refresh);
  const sse = useSseEvents(() => TASK_CENTER_SSE_TOPICS);

  watch(sse.events, () => coalescer.schedule());
  watch(sse.status, (status, previous) => {
    if (status === 'open' && previous === 'error') {
      coalescer.onReconnect();
    }
  });
  onUnmounted(coalescer.dispose);

  return {
    events: sse.events,
    restart: sse.restart,
    status: sse.status,
  };
}
