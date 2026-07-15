export const IMAGE_FORMAT_CODES = ['JPEG', 'PNG', 'WEBP'] as const;
export type ImageFormatCode = (typeof IMAGE_FORMAT_CODES)[number];
export type ImageAssetStatus =
  | 'AVAILABLE'
  | 'DELETE_FAILED'
  | 'DELETED'
  | 'DELETING';
export type ImageCollectionMode = 'ONCE' | 'SCHEDULED';

export namespace ImageApi {
  export interface AssetQueryReq {
    assetId?: string;
    assetName?: string;
    status?: ImageAssetStatus;
    sourceType?: string;
    sourceTaskId?: string;
    sourceExecutionId?: string;
    deviceId?: string;
    channelId?: string;
    capturedStart?: number;
    capturedEnd?: number;
  }

  export interface AssetSourceVO {
    sourceType?: string;
    sourceSystem?: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
    sourceTaskId?: string;
    sourceExecutionId?: string;
    originalFilename?: string;
    sourceMetadata?: Record<string, unknown>;
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
    capturedTime?: number;
    ingestedTime?: number;
    ownerType?: string;
    ownerId?: string;
    retentionPolicy?: string;
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
    state?: string;
    scheduleStartTime?: number;
    scheduleEndTime?: number;
    intervalSeconds?: number;
    nextPlanTime?: number;
    plannedCount?: number;
    successCount?: number;
    failedCount?: number;
    missedCount?: number;
    progressCurrent?: number;
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
    version?: number;
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
    expectedVersion?: number;
    scheduleStartTime: number;
    scheduleEndTime: number;
    intervalSeconds: number;
    reason?: string;
  }
}
