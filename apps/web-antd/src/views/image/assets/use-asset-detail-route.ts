import type { WatchSource } from 'vue';

import { watch } from 'vue';

export function watchAssetDetailRoute(
  detailId: WatchSource<string | undefined>,
  sync: (assetId?: string) => void,
) {
  return watch(detailId, sync, { flush: 'post' });
}
