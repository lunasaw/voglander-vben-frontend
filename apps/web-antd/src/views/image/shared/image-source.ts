import type { ImageApi } from '#/api/image';

export interface ImageCameraSource {
  channelId?: string;
  channelName?: string;
  deviceId?: string;
  deviceName?: string;
}

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseImageCameraSource(
  source?: ImageApi.AssetSourceVO,
): ImageCameraSource {
  const metadata = source?.sourceMetadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return {
    channelId: optionalText(metadata.channelId),
    channelName: optionalText(metadata.channelName),
    deviceId: optionalText(metadata.deviceId),
    deviceName: optionalText(metadata.deviceName),
  };
}

export function imageCameraLabel(source?: ImageApi.AssetSourceVO) {
  const camera = parseImageCameraSource(source);
  const device = camera.deviceName ?? camera.deviceId;
  const channel = camera.channelName ?? camera.channelId;
  return [device, channel].filter(Boolean).join(' / ') || '-';
}
