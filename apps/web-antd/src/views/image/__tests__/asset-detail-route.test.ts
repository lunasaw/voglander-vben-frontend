import { nextTick, ref, watch } from 'vue';

import { describe, expect, it } from 'vitest';

import { watchAssetDetailRoute } from '../assets/use-asset-detail-route';

describe('asset detail route lifecycle', () => {
  it('synchronizes drawer state after pre-render route work', async () => {
    const detailId = ref<string>();
    const order: string[] = [];
    const stopPre = watch(detailId, (assetId) => {
      order.push(`pre:${assetId ?? 'closed'}`);
    });
    const stopDetail = watchAssetDetailRoute(detailId, (assetId) => {
      order.push(`detail:${assetId ?? 'closed'}`);
    });

    detailId.value = 'asset-1';
    expect(order).toEqual([]);
    await nextTick();
    expect(order).toEqual(['pre:asset-1', 'detail:asset-1']);

    order.length = 0;
    detailId.value = undefined;
    await nextTick();
    expect(order).toEqual(['pre:closed', 'detail:closed']);

    stopPre();
    stopDetail();
  });
});
