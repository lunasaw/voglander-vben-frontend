import type { ImageApi } from '#/api/image';

export type CollectionControlAction =
  | 'CANCEL'
  | 'MANUAL_RETRY'
  | 'PAUSE'
  | 'RESCHEDULE'
  | 'RESUME';

export interface ImageCollectionPermissions {
  canControlImage: boolean;
  canControlTask: boolean;
}

function hasControlPermissions(permissions: ImageCollectionPermissions) {
  return permissions.canControlImage && permissions.canControlTask;
}

export function collectionActionAllowed(
  task: ImageApi.CollectionVO,
  action: CollectionControlAction,
  permissions: ImageCollectionPermissions,
) {
  if (!hasControlPermissions(permissions)) return false;
  const capabilities = task.capabilities ?? [];
  switch (action) {
    case 'CANCEL': {
      return (
        ['PAUSED', 'RUNNING', 'SCHEDULED'].includes(task.state ?? '') &&
        capabilities.includes('CANCEL') &&
        task.version !== undefined
      );
    }
    case 'MANUAL_RETRY': {
      return (
        task.state === 'FAILED' &&
        capabilities.includes('MANUAL_RETRY') &&
        Boolean(task.lastExecutionId)
      );
    }
    case 'PAUSE': {
      return (
        ['RUNNING', 'SCHEDULED'].includes(task.state ?? '') &&
        capabilities.includes('PAUSE') &&
        task.version !== undefined
      );
    }
    case 'RESCHEDULE': {
      return (
        task.state === 'PAUSED' &&
        capabilities.includes('RESCHEDULE') &&
        task.version !== undefined
      );
    }
    case 'RESUME': {
      return (
        task.state === 'PAUSED' &&
        capabilities.includes('PAUSE') &&
        task.version !== undefined
      );
    }
  }
}

export function availableCollectionActions(
  task: ImageApi.CollectionVO,
  permissions: ImageCollectionPermissions,
) {
  const candidates: CollectionControlAction[] = [
    task.state === 'PAUSED' ? 'RESUME' : 'PAUSE',
    'RESCHEDULE',
    'MANUAL_RETRY',
    'CANCEL',
  ];
  return candidates.filter((action) =>
    collectionActionAllowed(task, action, permissions),
  );
}
