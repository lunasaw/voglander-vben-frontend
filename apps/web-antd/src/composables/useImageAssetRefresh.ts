import { onUnmounted, watch } from 'vue';

import { useSseEvents } from './useSseEvents';

/** Debounces asset SSE notifications and asks the current page for authoritative data. */
export function useImageAssetRefresh(
  refresh: () => Promise<void> | void,
  delay = 250,
) {
  const sse = useSseEvents(() => [
    'image.asset.created',
    'image.asset.deleted',
    'image.asset.deleting',
  ]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopEvents = watch(sse.events, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void refresh(), delay);
  });
  const stopStatus = watch(sse.status, (status, previous) => {
    if (status === 'open' && previous === 'error') void refresh();
  });
  onUnmounted(() => {
    if (timer) clearTimeout(timer);
    sse.close();
  });
  onUnmounted(() => {
    stopEvents();
    stopStatus();
  });
  return sse;
}
