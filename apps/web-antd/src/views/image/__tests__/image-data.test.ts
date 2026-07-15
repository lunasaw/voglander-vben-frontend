import { describe, expect, it } from 'vitest';

import {
  assetActionAllowed,
  assetQueryFromRoute,
  formatBytes,
  imageFormatLabel,
  mergeAssetQuery,
} from '../assets/data';
import {
  collectionActionAllowed,
  collectionActionAllowedWithPermission,
  collectionProgress,
  collectionQueryFromRoute,
  inclusivePlanCount,
} from '../collections/data';

describe('image view pure functions', () => {
  it('uses inclusive schedule count and rejects invalid ranges', () => {
    expect(inclusivePlanCount(0, 120_000, 60)).toBe(3);
    expect(inclusivePlanCount(120_000, 0, 60)).toBe(0);
  });
  it('formats size, merges deep-link query, and guards lifecycle actions', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(assetQueryFromRoute({ deviceId: 'd1', ignored: 1 })).toEqual({
      deviceId: 'd1',
      channelId: undefined,
    });
    expect(assetActionAllowed('AVAILABLE', 'delete')).toBe(true);
    expect(assetActionAllowed('DELETING', 'delete')).toBe(false);
    expect(collectionActionAllowed('PAUSED', 'RESCHEDULE')).toBe(true);
    expect(
      mergeAssetQuery({ assetName: 'a' }, { deviceId: 'd1', channelId: 'c1' }),
    ).toEqual({ assetName: 'a', deviceId: 'd1', channelId: 'c1' });
    expect(imageFormatLabel('GIF')).toBe('UNKNOWN');
    expect(collectionProgress(2, 5)).toBe('2 / 5');
    expect(
      collectionActionAllowedWithPermission(
        'RUNNING',
        'PAUSE',
        ['PAUSE'],
        true,
        true,
      ),
    ).toBe(true);
    expect(
      collectionActionAllowedWithPermission(
        'RUNNING',
        'PAUSE',
        ['PAUSE'],
        true,
        false,
      ),
    ).toBe(false);
    expect(
      collectionQueryFromRoute({ deviceId: 'd1', channelId: 'c1' }),
    ).toEqual({ deviceId: 'd1', channelId: 'c1' });
  });
});
