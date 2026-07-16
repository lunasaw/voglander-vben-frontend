import type { ImageApi } from '#/api/image';

export function inclusivePlanCount(
  start?: number,
  end?: number,
  interval?: number,
) {
  if (
    start === undefined ||
    end === undefined ||
    interval === undefined ||
    interval <= 0 ||
    end < start
  )
    return 0;
  return Math.floor((end - start) / (interval * 1000)) + 1;
}
export function collectionActionAllowed(
  state: string | undefined,
  capability: string | undefined,
) {
  if (!capability) return false;
  if (capability === 'PAUSE')
    return state === 'RUNNING' || state === 'SCHEDULED';
  if (capability === 'CANCEL')
    return ['PAUSED', 'RUNNING', 'SCHEDULED'].includes(state ?? '');
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
  if (total && total > 0)
    return `${Math.min(Math.max(current ?? 0, 0), total)} / ${total}`;
  return current && current > 0 ? `${current}` : '-';
}

export function collectionQueryFromRoute(
  routeQuery: Record<string, unknown>,
): ImageApi.CollectionQueryReq {
  return {
    deviceId:
      typeof routeQuery.deviceId === 'string' ? routeQuery.deviceId : undefined,
    channelId:
      typeof routeQuery.channelId === 'string'
        ? routeQuery.channelId
        : undefined,
  };
}
