import type { ImageApi } from './types';

import { requestClient } from '#/api/request';

export async function getImageAssetConstraints() {
  return requestClient.get<ImageApi.AssetConstraintsVO>(
    '/api/v1/images/constraints',
  );
}
export async function getImageAssetStatistics() {
  return requestClient.get<ImageApi.AssetStatisticsVO>(
    '/api/v1/images/statistics',
  );
}
export async function getImageAssetPage(
  paging: { page: number; size: number },
  filters: ImageApi.AssetQueryReq = {},
) {
  return requestClient.post<ImageApi.AssetListResp>(
    `/api/v1/images/getPage?page=${paging.page}&size=${paging.size}`,
    filters,
  );
}
export async function getImageAsset(assetId: string) {
  return requestClient.get<ImageApi.AssetVO>(`/api/v1/images/${assetId}`);
}
export async function uploadImageAsset(
  file: File,
  idempotencyKey: string,
  assetName?: string,
) {
  const body = new FormData();
  body.append('file', file);
  if (assetName) body.append('assetName', assetName);
  return requestClient.post<ImageApi.AssetVO>('/api/v1/images/uploads', body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
export async function deleteImageAsset(assetId: string) {
  return requestClient.delete<boolean>(`/api/v1/images/${assetId}`);
}
export async function retryDeleteImageAsset(assetId: string) {
  return requestClient.post<boolean>(
    `/api/v1/images/${assetId}/delete:retry`,
    {},
  );
}
export function imageAssetContentUrl(assetId: string) {
  return `/api/v1/images/${assetId}/content`;
}
export function imageAssetDownloadUrl(assetId: string) {
  return `/api/v1/images/${assetId}/download`;
}

export async function getImageCollectionConstraints() {
  return requestClient.get<ImageApi.CollectionConstraints>(
    '/api/v1/image-collection-tasks/constraints',
  );
}
export async function createImageCollection(
  body: ImageApi.CollectionCreateReq,
  idempotencyKey: string,
) {
  return requestClient.post<{ taskId: string }>(
    '/api/v1/image-collection-tasks',
    body,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
}
export async function getImageCollectionPage(
  paging: { page: number; size: number },
  filters: ImageApi.CollectionQueryReq = {},
) {
  return requestClient.post<ImageApi.CollectionListResp>(
    `/api/v1/image-collection-tasks/getPage?page=${paging.page}&size=${paging.size}`,
    filters,
  );
}
export async function getImageCollection(taskId: string) {
  return requestClient.get<ImageApi.CollectionVO>(
    `/api/v1/image-collection-tasks/${taskId}`,
  );
}
export async function rescheduleImageCollection(
  taskId: string,
  body: ImageApi.RescheduleReq,
) {
  return requestClient.post<ImageApi.CollectionVO>(
    `/api/v1/image-collection-tasks/${taskId}:reschedule`,
    body,
  );
}
