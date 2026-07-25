import type { AxiosResponse } from '@vben/request';

import type { ImageApi } from './types';

import { requestClient, requestWithErrorMeta } from '#/api/request';

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
  signal?: AbortSignal,
) {
  return requestClient.post<ImageApi.AssetListResp>(
    `/api/v1/images/getPage?page=${paging.page}&size=${paging.size}`,
    filters,
    { signal, suppressGlobalError: true },
  );
}
export async function getImageAsset(assetId: string, signal?: AbortSignal) {
  return requestClient.get<ImageApi.AssetVO>(
    `/api/v1/images/${encodeURIComponent(assetId)}`,
    { signal, suppressGlobalError: true },
  );
}
export async function uploadImageAsset(
  file: File,
  idempotencyKey: string,
  assetName?: string,
) {
  const body = new FormData();
  body.append('file', file);
  if (assetName) body.append('assetName', assetName);
  return requestWithErrorMeta<ImageApi.AssetVO>('/api/v1/images/uploads', {
    data: body,
    headers: { 'Idempotency-Key': idempotencyKey },
    method: 'POST',
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
export async function getImageAssetThumbnailBlob(
  assetId: string,
  profile: ImageApi.ThumbnailProfile,
  signal?: AbortSignal,
) {
  return requestClient.download<Blob>(
    `/api/v1/images/${encodeURIComponent(assetId)}/thumbnail`,
    {
      params: { profile },
      signal,
      suppressGlobalError: true,
    },
  );
}

export async function getImageAssetContentBlob(
  assetId: string,
  signal?: AbortSignal,
) {
  return requestClient.download<Blob>(
    `/api/v1/images/${encodeURIComponent(assetId)}/content`,
    { signal, suppressGlobalError: true },
  );
}

export async function downloadImageAssetBlob(
  assetId: string,
  signal?: AbortSignal,
) {
  const response = await requestClient.download<AxiosResponse<Blob>>(
    `/api/v1/images/${encodeURIComponent(assetId)}/download`,
    {
      responseReturn: 'raw',
      signal,
      suppressGlobalError: true,
    },
  );
  return {
    blob: response.data,
    contentDisposition: response.headers['content-disposition'] as
      | string
      | undefined,
    contentType: response.headers['content-type'] as string | undefined,
  };
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
  return requestWithErrorMeta<ImageApi.CollectionCreateVO>(
    '/api/v1/image-collection-tasks',
    {
      data: body,
      headers: { 'Idempotency-Key': idempotencyKey },
      method: 'POST',
    },
  );
}
export async function getImageCollectionPage(
  paging: { page: number; size: number },
  filters: ImageApi.CollectionQueryReq = {},
  signal?: AbortSignal,
) {
  return requestClient.post<ImageApi.CollectionListResp>(
    `/api/v1/image-collection-tasks/getPage?page=${paging.page}&size=${paging.size}`,
    filters,
    { signal, suppressGlobalError: true },
  );
}
export async function getImageCollection(taskId: string, signal?: AbortSignal) {
  return requestClient.get<ImageApi.CollectionVO>(
    `/api/v1/image-collection-tasks/${encodeURIComponent(taskId)}`,
    { signal, suppressGlobalError: true },
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
