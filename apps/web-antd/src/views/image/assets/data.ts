import type { Dayjs } from 'dayjs';

import type { VbenFormSchema } from '#/adapter/form';
import type {
  ImageApi,
  ImageAssetSourceType,
  ImageAssetStatus,
} from '#/api/image';

import { $t } from '#/locales';
import {
  assetStatusKey,
  formatBytes,
  imageFormatLabel,
} from '#/views/image/shared/image-presentation';

export { formatBytes, imageFormatLabel };

export const ASSET_STATUSES: ImageAssetStatus[] = [
  'AVAILABLE',
  'DELETING',
  'DELETE_FAILED',
  'DELETED',
];

export const ASSET_SOURCE_TYPES: ImageAssetSourceType[] = [
  'USER_UPLOAD',
  'CAMERA_CAPTURE',
  'EXTERNAL_IMPORT',
];

export interface AssetQueryFormValues {
  assetId?: string;
  assetName?: string;
  capturedRange?: [Dayjs, Dayjs];
  channelId?: string;
  deviceId?: string;
  sourceTaskId?: string;
  sourceType?: ImageAssetSourceType;
  status?: ImageAssetStatus;
}

function routeText(value: unknown, maxLength = 160) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && text.length <= maxLength ? text : undefined;
}

function routeTimestamp(value: unknown) {
  const text = routeText(value, 20);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function assetQueryFromRoute(
  routeQuery: Record<string, unknown>,
): ImageApi.AssetQueryReq {
  const status = routeText(routeQuery.status);
  const sourceType = routeText(routeQuery.sourceType);
  return {
    assetId: routeText(routeQuery.filterAssetId),
    assetName: routeText(routeQuery.assetName),
    capturedEnd: routeTimestamp(routeQuery.capturedEnd),
    capturedStart: routeTimestamp(routeQuery.capturedStart),
    channelId: routeText(routeQuery.channelId),
    deviceId: routeText(routeQuery.deviceId),
    sourceTaskId: routeText(routeQuery.sourceTaskId),
    sourceType: ASSET_SOURCE_TYPES.includes(sourceType as ImageAssetSourceType)
      ? (sourceType as ImageAssetSourceType)
      : undefined,
    status: ASSET_STATUSES.includes(status as ImageAssetStatus)
      ? (status as ImageAssetStatus)
      : undefined,
  };
}

export function assetDetailIdFromRoute(
  routeQuery: Record<string, unknown>,
  routeParam?: unknown,
) {
  return routeText(routeParam) ?? routeText(routeQuery.assetId);
}

export function assetQueryToRoute(filters: ImageApi.AssetQueryReq) {
  return Object.fromEntries(
    Object.entries({
      assetName: filters.assetName,
      capturedEnd: filters.capturedEnd?.toString(),
      capturedStart: filters.capturedStart?.toString(),
      channelId: filters.channelId,
      deviceId: filters.deviceId,
      filterAssetId: filters.assetId,
      sourceTaskId: filters.sourceTaskId,
      sourceType: filters.sourceType,
      status: filters.status,
    }).filter(([, value]) => value !== undefined && value !== ''),
  );
}

export function mergeAssetQuery(
  filters: ImageApi.AssetQueryReq,
  routeQuery: Record<string, unknown>,
): ImageApi.AssetQueryReq {
  const context = assetQueryFromRoute(routeQuery);
  return {
    ...filters,
    channelId: filters.channelId ?? context.channelId,
    deviceId: filters.deviceId ?? context.deviceId,
  };
}

export function assetFormValuesToQuery(
  values: AssetQueryFormValues,
): ImageApi.AssetQueryReq {
  const range = values.capturedRange;
  return {
    assetId: routeText(values.assetId),
    assetName: routeText(values.assetName),
    capturedEnd: range?.[1]?.valueOf(),
    capturedStart: range?.[0]?.valueOf(),
    channelId: routeText(values.channelId),
    deviceId: routeText(values.deviceId),
    sourceTaskId: routeText(values.sourceTaskId),
    sourceType: values.sourceType,
    status: values.status,
  };
}

export function useAssetQuerySchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'assetName',
      label: $t('image.assets.field.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: ASSET_STATUSES.map((value) => ({
          label: $t(assetStatusKey(value)),
          value,
        })),
      },
      fieldName: 'status',
      label: $t('image.assets.field.status'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: ASSET_SOURCE_TYPES.map((value) => ({
          label: $t(`image.assets.source.${value}`),
          value,
        })),
      },
      fieldName: 'sourceType',
      label: $t('image.assets.field.source'),
    },
    {
      component: 'Input',
      fieldName: 'deviceId',
      label: $t('image.assets.field.deviceId'),
    },
    {
      component: 'Input',
      fieldName: 'channelId',
      label: $t('image.assets.field.channelId'),
    },
    {
      component: 'Input',
      fieldName: 'assetId',
      label: $t('image.assets.field.assetId'),
    },
    {
      component: 'Input',
      fieldName: 'sourceTaskId',
      label: $t('image.assets.field.sourceTaskId'),
    },
    {
      component: 'RangePicker',
      componentProps: { showTime: true },
      fieldName: 'capturedRange',
      label: $t('image.assets.field.capturedAt'),
    },
  ];
}

export function assetStatusLabel(status?: string) {
  return assetStatusKey(status);
}

export function assetActionAllowed(
  status: string | undefined,
  action: 'delete' | 'retryDelete',
) {
  return action === 'delete'
    ? status === 'AVAILABLE' || status === 'DELETE_FAILED'
    : status === 'DELETE_FAILED';
}
