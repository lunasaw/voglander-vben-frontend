import { onBeforeUnmount } from 'vue';

import { imageAssetContentUrl } from '#/api/image';

interface PreviewEntry {
  url?: string;
  refs: number;
  promise?: Promise<string>;
  error?: Error;
}

/** Blob preview lifecycle with a bounded six-request queue and exact URL revocation. */
export function useImagePreview(maxConcurrent = 6) {
  const entries = new Map<string, PreviewEntry>();
  const queue: Array<() => void> = [];
  let active = 0;
  function pump() {
    while (active < maxConcurrent && queue.length > 0) {
      active++;
      const next = queue.shift();
      if (next) next();
    }
  }
  function load(assetId: string): Promise<string> {
    const current = entries.get(assetId) ?? { refs: 0 };
    entries.set(assetId, current);
    current.refs++;
    if (current.url) return Promise.resolve(current.url);
    if (current.promise) return current.promise;
    current.promise = new Promise<string>((resolve, reject) => {
      queue.push(async () => {
        try {
          const response = await fetch(imageAssetContentUrl(assetId));
          if (!response.ok) throw new Error(`preview ${response.status}`);
          current.url = URL.createObjectURL(await response.blob());
          resolve(current.url);
        } catch (error) {
          current.error = error as Error;
          reject(error);
        } finally {
          active--;
          current.promise = undefined;
          pump();
        }
      });
      pump();
    });
    return current.promise;
  }
  function release(assetId: string) {
    const current = entries.get(assetId);
    if (!current) return;
    current.refs = Math.max(0, current.refs - 1);
    if (current.refs === 0 && current.url) {
      URL.revokeObjectURL(current.url);
      entries.delete(assetId);
    }
  }
  function retry(assetId: string) {
    const current = entries.get(assetId);
    if (current?.error) {
      entries.delete(assetId);
      return load(assetId);
    }
    return load(assetId);
  }
  onBeforeUnmount(() => {
    for (const [assetId, current] of entries) {
      if (current.url) URL.revokeObjectURL(current.url);
      entries.delete(assetId);
    }
  });
  return { load, release, retry, entries };
}
