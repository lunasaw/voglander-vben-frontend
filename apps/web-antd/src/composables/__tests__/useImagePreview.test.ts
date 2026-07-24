import { afterEach, describe, expect, it, vi } from 'vitest';

import { createImagePreviewManager } from '../useImagePreview';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('image preview manager', () => {
  it('reuses each asset/variant URL and revokes it at final release', async () => {
    const loader = vi
      .fn()
      .mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const preview = createImagePreviewManager(loader);

    const first = await preview.acquire('img_1', 'gallery');
    const second = await preview.acquire('img_1', 'gallery');

    expect(first).toBe(second);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    preview.release('img_1', 'gallery');
    expect(revoke).not.toHaveBeenCalled();
    preview.release('img_1', 'gallery');
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('uses the variant as part of the cache key', async () => {
    const loader = vi
      .fn()
      .mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:gallery')
      .mockReturnValueOnce('blob:table');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const preview = createImagePreviewManager(loader);

    await preview.acquire('img_1', 'gallery');
    await preview.acquire('img_1', 'table');

    expect(loader).toHaveBeenCalledTimes(2);
    preview.dispose();
  });

  it('never starts more than six concurrent requests', async () => {
    const resolvers: Array<(blob: Blob) => void> = [];
    const loader = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:item');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const preview = createImagePreviewManager(loader, 6);
    const requests = Array.from({ length: 8 }, (_, index) =>
      preview.acquire(`img_${index}`, 'gallery'),
    );

    expect(loader).toHaveBeenCalledTimes(6);
    expect(preview.stats()).toEqual({ active: 6, queued: 2 });
    resolvers[0]?.(new Blob(['x']));
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(7));
    for (const resolve of resolvers.slice(1, 7)) resolve(new Blob(['x']));
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(8));
    resolvers[7]?.(new Blob(['x']));
    await Promise.all(requests);
    preview.dispose();
  });

  it('aborts an in-flight request when its last reference is released', async () => {
    let observedSignal: AbortSignal | undefined;
    const loader = vi.fn(
      (_assetId: string, _variant: string, signal: AbortSignal) => {
        observedSignal = signal;
        return new Promise<Blob>((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('', 'AbortError')),
          );
        });
      },
    );
    const preview = createImagePreviewManager(loader);
    const request = preview.acquire('img_1', 'content');

    preview.release('img_1', 'content');

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(observedSignal?.aborted).toBe(true);
    expect(preview.entries.size).toBe(0);
  });

  it('does not create an Object URL if a disposed loader resolves late', async () => {
    let resolve!: (blob: Blob) => void;
    const loader = vi.fn(
      () =>
        new Promise<Blob>((done) => {
          resolve = done;
        }),
    );
    const create = vi.spyOn(URL, 'createObjectURL');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const preview = createImagePreviewManager(loader);
    const request = preview.acquire('img_1', 'content');

    preview.dispose();
    resolve(new Blob(['late']));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    expect(create).not.toHaveBeenCalled();
    expect(preview.entries.size).toBe(0);
  });
});
