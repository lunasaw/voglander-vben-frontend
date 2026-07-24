import { onUnmounted, watch } from 'vue';

import { createAuthoritativeRefresh } from '#/views/image/shared/authoritative-refresh';

import { useSseEvents } from './useSseEvents';

/** Merges asset event hints and reconnects into authoritative page refreshes. */
export function useImageAssetRefresh(
  refresh: () => Promise<void> | void,
  delay = 250,
) {
  const sse = useSseEvents(() => [
    'image.asset.created',
    'image.asset.deleted',
    'image.asset.deleting',
  ]);
  const refresher = createAuthoritativeRefresh(refresh, {
    delay,
    maxWait: 1500,
  });
  let fallbackTimer: ReturnType<typeof setInterval> | undefined;
  let hadDisconnect = false;

  function stopFallback() {
    if (fallbackTimer) clearInterval(fallbackTimer);
    fallbackTimer = undefined;
  }

  function startFallback() {
    if (fallbackTimer || document.visibilityState !== 'visible') return;
    fallbackTimer = setInterval(() => refresher.notify(), 30_000);
  }

  const stopEvents = watch(sse.events, () => refresher.notify());
  const stopStatus = watch(sse.status, (status) => {
    if (status === 'error' || status === 'closed') {
      hadDisconnect = true;
      startFallback();
      return;
    }
    if (status === 'open') {
      stopFallback();
      if (hadDisconnect) {
        hadDisconnect = false;
        void refresher.flush();
      }
    }
  });

  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') {
      stopFallback();
      return;
    }
    if (sse.status.value !== 'open' || refresher.isDirty()) {
      void refresher.flush();
    }
    if (sse.status.value !== 'open') startFallback();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  onUnmounted(() => {
    stopEvents();
    stopStatus();
    stopFallback();
    refresher.dispose();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    sse.close();
  });

  return { ...sse, refresher };
}
