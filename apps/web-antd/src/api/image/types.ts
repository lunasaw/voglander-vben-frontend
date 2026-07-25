export const IMAGE_FORMAT_CODES = ['JPEG', 'PNG', 'WEBP'] as const;
export type ImageFormatCode = (typeof IMAGE_FORMAT_CODES)[number];
export type ImageAssetStatus =
  | 'AVAILABLE'
  | 'DELETE_FAILED'
  | 'DELETED'
  | 'DELETING';
export type ImageCollectionMode = 'ONCE' | 'SCHEDULED';
export type ImageAssetSourceType =
  | 'CAMERA_CAPTURE'
  | 'EXTERNAL_IMPORT'
  | 'USER_UPLOAD';

export namespace ImageApi {
  export type ThumbnailProfile = 'gallery' | 'table';

  export interface AssetQueryReq {
    assetId?: string;
    assetName?: string;
    status?: ImageAssetStatus;
    sourceType?: ImageAssetSourceType;
    sourceTaskId?: string;
    sourceExecutionId?: string;
    deviceId?: string;
    channelId?: string;
    capturedStart?: number;
    capturedEnd?: number;
  }

  export interface AssetSourceVO {
    sourceType?: ImageAssetSourceType;
    sourceSystem?: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
    sourceTaskId?: string;
    sourceExecutionId?: string;
    originalFilename?: string;
    sourceMetadata?: {
      [key: string]: unknown;
      channelId?: string;
      channelName?: string;
      deviceId?: string;
      deviceName?: string;
    };
  }

  export interface AssetVO {
    assetId: string;
    assetName?: string;
    status?: ImageAssetStatus;
    contentType?: string;
    imageFormat?: ImageFormatCode;
    fileSize?: number;
    width?: number;
    height?: number;
    checksum?: string;
    capturedAt?: number;
    ingestedAt?: number;
    originalFilename?: string;
    sourceEntityId?: string;
    sourceExecutionId?: string;
    sourceTaskId?: string;
    sourceType?: ImageAssetSourceType;
    source?: AssetSourceVO;
  }

  export interface AssetListResp {
    total: number;
    items: AssetVO[];
  }
  export interface AssetStatisticsVO {
    total?: number;
    available?: number;
    today?: number;
    deleteFailed?: number;
  }
  export interface AssetConstraintsVO {
    maxUploadBytes?: number;
    maxPixels?: number;
    formats?: string[];
  }

  export interface CollectionCreateReq {
    taskName: string;
    collectionMode: ImageCollectionMode;
    deviceId: string;
    channelId: string;
    scheduleStartTime?: number;
    scheduleEndTime?: number;
    intervalSeconds?: number;
    retentionPolicy?: string;
  }
  export interface CollectionCreateVO {
    executionId?: string;
    nextPlanTime?: number;
    plannedCount?: number;
    state?: string;
    taskId: string;
  }
  export interface CollectionQueryReq {
    taskName?: string;
    collectionMode?: string;
    state?: string;
    deviceId?: string;
    channelId?: string;
  }
  export interface CollectionVO {
    taskId: string;
    taskName?: string;
    taskMode?: string;
    collectionMode?: ImageCollectionMode;
    state?: string;
    scheduleStartTime?: number;
    scheduleEndTime?: number;
    intervalSeconds?: number;
    nextPlanTime?: number;
    plannedCount?: number;
    successCount?: number;
    failedCount?: number;
    missedCount?: number;
    cancelledCount?: number;
    progressCurrent?: number;
    progressMessage?: string;
    progressRevision?: number;
    progressTotal?: number;
    deviceId?: string;
    channelId?: string;
    deviceName?: string;
    channelName?: string;
    retentionPolicy?: string;
    capabilities?: string[];
    lastExecutionId?: string;
    resultRefType?: string;
    resultRefId?: string;
    resultSummary?: string;
    lastFailureCode?: string;
    lastFailureMessage?: string;
    createTime?: number;
    updateTime?: number;
    version?: number;
    scheduleVersion?: number;
  }
  export interface CollectionListResp {
    total: number;
    items: CollectionVO[];
  }
  export interface CollectionConstraints {
    minIntervalSeconds: number;
    maxPlannedCount: number;
    modes: string[];
    retentionPolicies: string[];
  }
  export interface RescheduleReq {
    expectedVersion: number;
    scheduleStartTime: number;
    scheduleEndTime: number;
    intervalSeconds: number;
    reason?: string;
  }
}
