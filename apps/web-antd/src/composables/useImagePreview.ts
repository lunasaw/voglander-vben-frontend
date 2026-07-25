import type { ImageApi } from '#/api/image';

import { onBeforeUnmount } from 'vue';

import {
  getImageAssetContentBlob,
  getImageAssetThumbnailBlob,
} from '#/api/image';

export type ImagePreviewVariant = 'content' | ImageApi.ThumbnailProfile;

type BlobLoader = (
  assetId: string,
  variant: ImagePreviewVariant,
  signal: AbortSignal,
) => Promise<Blob>;

interface PreviewEntry {
  assetId: string;
  controller?: AbortController;
  error?: Error;
  promise?: Promise<string>;
  refs: number;
  reject?: (reason?: unknown) => void;
  resolve?: (url: string) => void;
  state: 'error' | 'loading' | 'queued' | 'ready';
  url?: string;
  variant: ImagePreviewVariant;
}

function abortError() {
  return new DOMException('Image request was released', 'AbortError');
}

function previewKey(assetId: string, variant: ImagePreviewVariant) {
  return `${assetId}:${variant}`;
}

async function defaultBlobLoader(
  assetId: string,
  variant: ImagePreviewVariant,
  signal: AbortSignal,
) {
  return variant === 'content'
    ? getImageAssetContentBlob(assetId, signal)
    : getImageAssetThumbnailBlob(assetId, variant, signal);
}

export function createImagePreviewManager(
  loader: BlobLoader = defaultBlobLoader,
  maxConcurrent = 6,
) {
  const entries = new Map<string, PreviewEntry>();
  const queue: PreviewEntry[] = [];
  let active = 0;

  function removeQueued(entry: PreviewEntry) {
    const index = queue.indexOf(entry);
    if (index !== -1) queue.splice(index, 1);
  }

  function deleteEntry(entry: PreviewEntry) {
    entries.delete(previewKey(entry.assetId, entry.variant));
  }

  function pump() {
    while (active < Math.max(1, maxConcurrent) && queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      if (entry.refs === 0) {
        entry.reject?.(abortError());
        deleteEntry(entry);
        continue;
      }

      active++;
      entry.state = 'loading';
      entry.controller = new AbortController();
      void loader(entry.assetId, entry.variant, entry.controller.signal)
        .then((blob) => {
          if (entry.refs === 0) {
            entry.reject?.(abortError());
            deleteEntry(entry);
            return;
          }
          const url = URL.createObjectURL(blob);
          if (entry.refs === 0) {
            URL.revokeObjectURL(url);
            entry.reject?.(abortError());
            deleteEntry(entry);
            return;
          }
          entry.url = url;
          entry.state = 'ready';
          entry.resolve?.(url);
        })
        .catch((error: unknown) => {
          if (entry.refs === 0) {
            deleteEntry(entry);
          } else {
            entry.error = error as Error;
            entry.state = 'error';
          }
          entry.reject?.(error);
        })
        .finally(() => {
          active--;
          entry.controller = undefined;
          entry.promise = undefined;
          entry.resolve = undefined;
          entry.reject = undefined;
          pump();
        });
    }
  }

  function schedule(entry: PreviewEntry) {
    entry.error = undefined;
    entry.state = 'queued';
    entry.promise = new Promise<string>((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;
    });
    queue.push(entry);
    pump();
    return entry.promise;
  }

  function acquire(assetId: string, variant: ImagePreviewVariant = 'content') {
    const key = previewKey(assetId, variant);
    const current = entries.get(key);
    if (current) {
      current.refs++;
      if (current.url) return Promise.resolve(current.url);
      if (current.promise) return current.promise;
      return schedule(current);
    }

    const entry: PreviewEntry = {
      assetId,
      refs: 1,
      state: 'queued',
      variant,
    };
    entries.set(key, entry);
    return schedule(entry);
  }

  function release(assetId: string, variant: ImagePreviewVariant = 'content') {
    const entry = entries.get(previewKey(assetId, variant));
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;

    if (entry.state === 'queued') {
      removeQueued(entry);
      entry.reject?.(abortError());
      deleteEntry(entry);
      entry.promise = undefined;
    } else if (entry.state === 'loading') {
      entry.controller?.abort();
    } else {
      if (entry.url) URL.revokeObjectURL(entry.url);
      deleteEntry(entry);
    }
    pump();
  }

  function retry(assetId: string, variant: ImagePreviewVariant = 'content') {
    const entry = entries.get(previewKey(assetId, variant));
    if (!entry) return acquire(assetId, variant);
    if (entry.url) return Promise.resolve(entry.url);
    if (entry.promise) return entry.promise;
    return schedule(entry);
  }

  function dispose() {
    for (const entry of entries.values()) {
      removeQueued(entry);
      entry.refs = 0;
      entry.controller?.abort();
      entry.reject?.(abortError());
      if (entry.url) URL.revokeObjectURL(entry.url);
    }
    entries.clear();
    queue.length = 0;
  }

  return {
    acquire,
    dispose,
    entries,
    release,
    retry,
    stats: () => ({ active, queued: queue.length }),
  };
}

const sharedManager = createImagePreviewManager();

/** Authenticated Blob previews with shared concurrency and local ref cleanup. */
export function useImagePreview() {
  const localRefs = new Map<string, number>();

  function load(assetId: string, variant: ImagePreviewVariant = 'content') {
    const key = previewKey(assetId, variant);
    localRefs.set(key, (localRefs.get(key) ?? 0) + 1);
    return sharedManager.acquire(assetId, variant);
  }

  function release(assetId: string, variant: ImagePreviewVariant = 'content') {
    const key = previewKey(assetId, variant);
    const count = localRefs.get(key) ?? 0;
    if (count <= 0) return;
    if (count === 1) localRefs.delete(key);
    else localRefs.set(key, count - 1);
    sharedManager.release(assetId, variant);
  }

  onBeforeUnmount(() => {
    for (const [key, count] of localRefs) {
      const separator = key.lastIndexOf(':');
      const assetId = key.slice(0, separator);
      const variant = key.slice(separator + 1) as ImagePreviewVariant;
      for (let index = 0; index < count; index++) {
        sharedManager.release(assetId, variant);
      }
    }
    localRefs.clear();
  });

  return {
    entries: sharedManager.entries,
    load,
    release,
    retry: sharedManager.retry,
  };
}

export function disposeAllImagePreviews() {
  sharedManager.dispose();
}
