import type { VbenFormSchema } from '#/adapter/form';
import type { ImageApi, ImageCollectionMode } from '#/api/image';

import { $t } from '#/locales';
import {
  collectionModeKey,
  collectionStateKey,
} from '#/views/image/shared/image-presentation';

export const COLLECTION_STATES = [
  'SCHEDULED',
  'RUNNING',
  'PAUSED',
  'CANCELLING',
  'COMPLETED',
  'PARTIAL_COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export const COLLECTION_MODES: ImageCollectionMode[] = ['ONCE', 'SCHEDULED'];

function routeText(value: unknown, maxLength = 160) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && text.length <= maxLength ? text : undefined;
}

export function collectionQueryFromRoute(
  routeQuery: Record<string, unknown>,
): ImageApi.CollectionQueryReq {
  const state = routeText(routeQuery.state);
  const collectionMode = routeText(routeQuery.collectionMode);
  return {
    channelId: routeText(routeQuery.channelId),
    collectionMode: COLLECTION_MODES.includes(
      collectionMode as ImageCollectionMode,
    )
      ? collectionMode
      : undefined,
    deviceId: routeText(routeQuery.deviceId),
    state: COLLECTION_STATES.includes(
      state as (typeof COLLECTION_STATES)[number],
    )
      ? state
      : undefined,
    taskName: routeText(routeQuery.taskName),
  };
}

export function collectionTaskIdFromRoute(routeQuery: Record<string, unknown>) {
  return routeText(routeQuery.taskId);
}

export function collectionQueryToRoute(filters: ImageApi.CollectionQueryReq) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([key, value]) =>
        [
          'channelId',
          'collectionMode',
          'deviceId',
          'state',
          'taskName',
        ].includes(key) &&
        value !== undefined &&
        value !== '',
    ),
  );
}

export function collectionFormValuesToQuery(
  values: Record<string, unknown>,
): ImageApi.CollectionQueryReq {
  return {
    channelId: routeText(values.channelId),
    collectionMode: COLLECTION_MODES.includes(
      values.collectionMode as ImageCollectionMode,
    )
      ? (values.collectionMode as ImageCollectionMode)
      : undefined,
    deviceId: routeText(values.deviceId),
    state: COLLECTION_STATES.includes(
      values.state as (typeof COLLECTION_STATES)[number],
    )
      ? (values.state as string)
      : undefined,
    taskName: routeText(values.taskName),
  };
}

export function useCollectionGridFormSchema(
  context: Pick<ImageApi.CollectionQueryReq, 'channelId' | 'deviceId'> = {},
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'taskName',
      label: $t('image.collections.field.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: COLLECTION_STATES.map((value) => ({
          label: $t(collectionStateKey(value)),
          value,
        })),
      },
      fieldName: 'state',
      label: $t('image.collections.field.state'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: COLLECTION_MODES.map((value) => ({
          label: $t(collectionModeKey({ collectionMode: value, taskId: '' })),
          value,
        })),
      },
      fieldName: 'collectionMode',
      label: $t('image.collections.field.mode'),
    },
    {
      component: 'Input',
      defaultValue: context.deviceId,
      fieldName: 'deviceId',
      label: $t('image.collections.field.deviceId'),
    },
    {
      component: 'Input',
      defaultValue: context.channelId,
      fieldName: 'channelId',
      label: $t('image.collections.field.channelId'),
    },
  ];
}

export function inclusivePlanCount(
  start?: number,
  end?: number,
  interval?: number,
) {
  if (
    start === undefined ||
    end === undefined ||
    interval === undefined ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isInteger(interval) ||
    interval <= 0 ||
    end < start
  ) {
    return 0;
  }
  return Math.floor((end - start) / (interval * 1000)) + 1;
}

export function collectionActionAllowed(
  state: string | undefined,
  capability: string | undefined,
) {
  if (!capability) return false;
  if (capability === 'PAUSE') {
    return ['PAUSED', 'RUNNING', 'SCHEDULED'].includes(state ?? '');
  }
  if (capability === 'CANCEL') {
    return ['PAUSED', 'RUNNING', 'SCHEDULED'].includes(state ?? '');
  }
  if (capability === 'MANUAL_RETRY') return state === 'FAILED';
  return state === 'PAUSED' && capability === 'RESCHEDULE';
}

export function collectionActionAllowedWithPermission(
  state: string | undefined,
  capability: string | undefined,
  capabilities: string[] | undefined,
  hasImagePermission: boolean,
  hasTaskPermission: boolean,
) {
  if (!hasImagePermission || !hasTaskPermission) return false;
  if (!capabilities?.includes(capability ?? '')) return false;
  return collectionActionAllowed(state, capability);
}

export function collectionProgress(current?: number, total?: number) {
  if (total && total > 0) {
    return `${Math.min(Math.max(current ?? 0, 0), total)} / ${total}`;
  }
  return current && current > 0 ? `${current}` : '-';
}

export function normalizedCollectionFingerprint(
  request: ImageApi.CollectionCreateReq,
) {
  return {
    channelId: request.channelId,
    collectionMode: request.collectionMode,
    deviceId: request.deviceId,
    intervalSeconds: request.intervalSeconds,
    retentionPolicy: request.retentionPolicy,
    scheduleEndTime: request.scheduleEndTime,
    scheduleStartTime: request.scheduleStartTime,
    taskName: request.taskName.trim(),
  };
}
