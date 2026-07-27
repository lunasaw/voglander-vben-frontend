import { describe, expect, it } from 'vitest';

import routes from '../routes/modules/image';

describe('image asset routes', () => {
  it('keeps the asset page instance when query state changes', () => {
    const assetRoutes = routes[0]?.children?.filter((route) =>
      ['ImageAssetDetail', 'ImageAssets'].includes(String(route.name)),
    );

    expect(assetRoutes).toHaveLength(2);
    expect(
      assetRoutes?.every((route) => route.meta?.fullPathKey === false),
    ).toBe(true);
  });
});
