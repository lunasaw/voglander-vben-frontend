import type { ImageApi } from '#/api/image';

export function assetQueryFromRoute(
  routeQuery: Record<string, unknown>,
): ImageApi.AssetQueryReq {
  return {
    deviceId:
      typeof routeQuery.deviceId === 'string' ? routeQuery.deviceId : undefined,
    channelId:
      typeof routeQuery.channelId === 'string'
        ? routeQuery.channelId
        : undefined,
  };
}
export function mergeAssetQuery(
  filters: ImageApi.AssetQueryReq,
  routeQuery: Record<string, unknown>,
): ImageApi.AssetQueryReq {
  const deepLink = assetQueryFromRoute(routeQuery);
  return {
    ...filters,
    deviceId: filters.deviceId ?? deepLink.deviceId,
    channelId: filters.channelId ?? deepLink.channelId,
  };
}
export function formatBytes(value?: number) {
  if (!value || value < 1024) return `${value ?? 0} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value;
  let index = -1;
  do {
    size /= 1024;
    index++;
  } while (size >= 1024 && index < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}
export function assetStatusLabel(status?: string) {
  return status
    ? `image.assets.status.${status}`
    : 'image.assets.status.unknown';
}
export function assetActionAllowed(
  status: string | undefined,
  action: 'delete' | 'retryDelete',
) {
  return action === 'delete'
    ? status === 'AVAILABLE' || status === 'DELETE_FAILED'
    : status === 'DELETE_FAILED';
}
export function imageFormatLabel(format?: string) {
  return format && ['JPEG', 'PNG', 'WEBP'].includes(format)
    ? format
    : 'UNKNOWN';
}
