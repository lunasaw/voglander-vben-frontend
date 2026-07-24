import type { ImageApi } from '#/api/image';

export type SemanticTagColor =
  | 'default'
  | 'error'
  | 'processing'
  | 'success'
  | 'warning';

const ASSET_STATUS_COLORS: Record<string, SemanticTagColor> = {
  AVAILABLE: 'success',
  DELETED: 'default',
  DELETE_FAILED: 'error',
  DELETING: 'processing',
};

const COLLECTION_STATE_COLORS: Record<string, SemanticTagColor> = {
  CANCELLED: 'default',
  CANCELLING: 'processing',
  COMPLETED: 'success',
  FAILED: 'error',
  PARTIAL_COMPLETED: 'warning',
  PAUSED: 'warning',
  RUNNING: 'processing',
  SCHEDULED: 'processing',
};

export function assetStatusColor(status?: string): SemanticTagColor {
  return ASSET_STATUS_COLORS[status ?? ''] ?? 'default';
}

export function collectionStateColor(state?: string): SemanticTagColor {
  return COLLECTION_STATE_COLORS[state ?? ''] ?? 'default';
}

export function formatBytes(value?: number) {
  if (!Number.isFinite(value) || !value || value < 1024) {
    return `${Math.max(0, value ?? 0)} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let size = value;
  let index = -1;
  do {
    size /= 1024;
    index++;
  } while (size >= 1024 && index < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatDateTime(value?: number) {
  if (!Number.isFinite(value)) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value as number));
}

export function imageFormatLabel(format?: string) {
  return format && ['JPEG', 'PNG', 'WEBP'].includes(format)
    ? format
    : 'UNKNOWN';
}

export function collectionModeValue(collection: ImageApi.CollectionVO) {
  const mode = collection.collectionMode ?? collection.taskMode;
  if (mode === 'ONCE') return 'ONCE';
  if (['AT_TIME', 'FIXED_RATE', 'SCHEDULED'].includes(mode ?? '')) {
    return 'SCHEDULED';
  }
  return 'UNKNOWN';
}

export function assetStatusKey(status?: string) {
  return ASSET_STATUS_COLORS[status ?? '']
    ? `image.assets.status.${status}`
    : 'image.assets.status.unknown';
}

export function collectionStateKey(state?: string) {
  return COLLECTION_STATE_COLORS[state ?? '']
    ? `image.collections.status.${state}`
    : 'image.collections.status.unknown';
}

export function collectionModeKey(collection: ImageApi.CollectionVO) {
  return `image.collections.mode.${collectionModeValue(collection)}`;
}

export function safeDisplayText(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 160) : '-';
}

export function suggestedAssetFilename(asset: ImageApi.AssetVO) {
  const name = asset.assetName?.trim() || asset.assetId;
  const extension = imageFormatLabel(asset.imageFormat).toLowerCase();
  return extension === 'unknown' ? name : `${name}.${extension}`;
}

export function filenameFromContentDisposition(value?: string) {
  if (!value) return undefined;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded).replaceAll(/[\\/]/g, '_');
    } catch {
      return encoded.replaceAll(/[\\/]/g, '_');
    }
  }
  return /filename="?([^";]+)"?/i
    .exec(value)?.[1]
    ?.trim()
    .replaceAll(/[\\/]/g, '_');
}
