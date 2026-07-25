import { describe, expect, it } from 'vitest';

import {
  assetActionAllowed,
  assetDetailIdFromRoute,
  assetQueryFromRoute,
  assetQueryToRoute,
  formatBytes,
  imageFormatLabel,
  mergeAssetQuery,
} from '../assets/data';
import {
  collectionActionAllowed,
  collectionActionAllowedWithPermission,
  collectionProgress,
  collectionQueryFromRoute,
  collectionQueryToRoute,
  collectionTaskIdFromRoute,
  inclusivePlanCount,
} from '../collection/data';

describe('image view pure functions', () => {
  it('uses inclusive schedule count and rejects invalid ranges', () => {
    expect(inclusivePlanCount(0, 120_000, 60)).toBe(3);
    expect(inclusivePlanCount(120_000, 0, 60)).toBe(0);
    expect(inclusivePlanCount(0, 120_000, 1.5)).toBe(0);
    expect(inclusivePlanCount(Number.NaN, 120_000, 60)).toBe(0);
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

  it('sanitizes asset route filters and keeps detail and list IDs separate', () => {
    const overlong = 'x'.repeat(161);
    expect(
      assetQueryFromRoute({
        assetId: 'detail-only',
        capturedEnd: '-1',
        capturedStart: '123',
        filterAssetId: '  asset-filter  ',
        sourceType: 'UNSUPPORTED',
        status: ['AVAILABLE'],
      }),
    ).toMatchObject({
      assetId: 'asset-filter',
      capturedEnd: undefined,
      capturedStart: 123,
      sourceType: undefined,
      status: undefined,
    });
    expect(assetDetailIdFromRoute({ assetId: ' query-id ' }, ' path-id ')).toBe(
      'path-id',
    );
    expect(assetDetailIdFromRoute({ assetId: overlong })).toBeUndefined();
    expect(assetDetailIdFromRoute({ assetId: ['asset-1'] })).toBeUndefined();
  });

  it('serializes only stable asset query fields', () => {
    expect(
      assetQueryToRoute({
        assetId: 'asset-filter',
        capturedEnd: 200,
        capturedStart: 100,
        deviceId: 'device-1',
        sourceExecutionId: 'not-routable',
        status: 'AVAILABLE',
      }),
    ).toEqual({
      capturedEnd: '200',
      capturedStart: '100',
      deviceId: 'device-1',
      filterAssetId: 'asset-filter',
      status: 'AVAILABLE',
    });
  });

  it('sanitizes and serializes collection route state including task deep links', () => {
    const overlong = 't'.repeat(161);
    expect(
      collectionQueryFromRoute({
        collectionMode: 'FIXED_RATE',
        deviceId: ['device-1'],
        state: 'UNKNOWN',
        taskId: 'detail-only',
        taskName: '  nightly capture  ',
      }),
    ).toMatchObject({
      collectionMode: undefined,
      deviceId: undefined,
      state: undefined,
      taskName: 'nightly capture',
    });
    expect(collectionTaskIdFromRoute({ taskId: ' task-1 ' })).toBe('task-1');
    expect(collectionTaskIdFromRoute({ taskId: overlong })).toBeUndefined();
    expect(collectionTaskIdFromRoute({ taskId: 1 })).toBeUndefined();
    expect(
      collectionQueryToRoute({
        channelId: 'channel-1',
        collectionMode: 'ONCE',
        state: 'RUNNING',
        taskName: '',
      }),
    ).toEqual({
      channelId: 'channel-1',
      collectionMode: 'ONCE',
      state: 'RUNNING',
    });
  });
});
