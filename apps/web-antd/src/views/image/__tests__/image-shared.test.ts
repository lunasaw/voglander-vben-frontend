import type { ImageApi } from '#/api/image';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '#/api/request';

import { createAuthoritativeRefresh } from '../shared/authoritative-refresh';
import {
  stableFingerprint,
  useIdempotentSubmit,
} from '../shared/idempotent-submit';
import {
  availableCollectionActions,
  collectionActionAllowed,
} from '../shared/image-permissions';
import {
  collectionModeValue,
  filenameFromContentDisposition,
} from '../shared/image-presentation';
import { parseImageCameraSource } from '../shared/image-source';

afterEach(() => {
  vi.useRealTimers();
});

describe('image shared contracts', () => {
  it('parses collection source metadata once with safe fallbacks', () => {
    expect(
      parseImageCameraSource({
        sourceMetadata: {
          channelId: ' c1 ',
          channelName: 2 as unknown as string,
          deviceId: 'd1',
          deviceName: '',
        },
      }),
    ).toEqual({
      channelId: 'c1',
      channelName: undefined,
      deviceId: 'd1',
      deviceName: undefined,
    });
  });

  it('normalizes modes and safe download filenames', () => {
    expect(collectionModeValue({ taskId: '1', taskMode: 'FIXED_RATE' })).toBe(
      'SCHEDULED',
    );
    expect(
      filenameFromContentDisposition("attachment; filename*=UTF-8''a%20b.jpg"),
    ).toBe('a b.jpg');
  });

  it('enforces state, capability, dual permission, version and execution id', () => {
    const paused = {
      capabilities: ['PAUSE', 'RESCHEDULE', 'CANCEL'],
      state: 'PAUSED',
      taskId: 'task-1',
      version: 2,
    } satisfies ImageApi.CollectionVO;
    const permissions = { canControlImage: true, canControlTask: true };
    expect(availableCollectionActions(paused, permissions)).toEqual([
      'RESUME',
      'RESCHEDULE',
      'CANCEL',
    ]);
    expect(
      collectionActionAllowed(paused, 'RESUME', {
        ...permissions,
        canControlImage: false,
      }),
    ).toBe(false);
    expect(
      collectionActionAllowed(
        { ...paused, version: undefined },
        'RESUME',
        permissions,
      ),
    ).toBe(false);
  });

  it('keeps stable fingerprints independent of object key order', () => {
    expect(stableFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      stableFingerprint({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it('reuses a key for unknown results and rotates it after content changes', () => {
    const keys = ['key-1', 'key-2'];
    const submit = useIdempotentSubmit(() => keys.shift() as string);
    expect(submit.begin('same')).toBe('key-1');
    submit.fail(
      new ApiRequestError({
        httpStatus: 500,
        message: 'unknown',
        transport: 'response',
      }),
    );
    expect(submit.status.value).toBe('unknown-result');
    expect(submit.begin('same')).toBe('key-1');
    submit.contentChanged('changed');
    expect(submit.begin('changed')).toBe('key-2');
  });

  it('classifies only explicit deterministic business rejections as known', () => {
    const submit = useIdempotentSubmit(() => 'key');
    submit.begin('same');
    submit.fail(
      new ApiRequestError({
        businessCode: 'IMAGE_FORMAT_INVALID',
        httpStatus: 422,
        message: 'invalid',
        transport: 'response',
      }),
    );
    expect(submit.status.value).toBe('known-failure');
  });

  it.each([
    { httpStatus: 408, transport: 'response' as const },
    { httpStatus: 429, transport: 'response' as const },
    { httpStatus: 500, transport: 'response' as const },
    { transport: 'network' as const },
    { transport: 'timeout' as const },
  ])(
    'keeps the idempotency key after an unknown result: $transport/$httpStatus',
    (meta) => {
      const submit = useIdempotentSubmit(() => 'stable-key');
      submit.begin('same');
      submit.fail(
        new ApiRequestError({
          ...meta,
          businessCode: 'TRANSIENT_FAILURE',
          message: 'unknown',
        }),
      );
      expect(submit.status.value).toBe('unknown-result');
      expect(submit.begin('same')).toBe('stable-key');
    },
  );
});

describe('authoritative refresh', () => {
  it('coalesces sustained events without exceeding maxWait', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const merger = createAuthoritativeRefresh(refresh, {
      delay: 300,
      maxWait: 1500,
    });
    for (let index = 0; index < 6; index++) {
      merger.notify();
      await vi.advanceTimersByTimeAsync(250);
    }
    expect(refresh).toHaveBeenCalledOnce();
    merger.dispose();
  });

  it('runs one dirty follow-up after an in-flight refresh', async () => {
    vi.useFakeTimers();
    let resolveFirst: (() => void) | undefined;
    const refresh = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const merger = createAuthoritativeRefresh(refresh, { delay: 100 });
    merger.notify();
    await vi.advanceTimersByTimeAsync(100);
    merger.notify();
    merger.notify();
    expect(refresh).toHaveBeenCalledOnce();
    resolveFirst?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    expect(refresh).toHaveBeenCalledTimes(2);
    merger.dispose();
  });
});
