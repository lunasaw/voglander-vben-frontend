import type { ImageApi, ImageFormatCode } from '#/api/image';

export type UploadValidationCode = 'decode' | 'format' | 'pixels' | 'size';

export interface InspectedImageFile {
  format: ImageFormatCode;
  height: number;
  width: number;
}

const EXTENSION_FORMATS: Record<string, ImageFormatCode> = {
  jpeg: 'JPEG',
  jpg: 'JPEG',
  png: 'PNG',
  webp: 'WEBP',
};

const MIME_FORMATS: Record<string, ImageFormatCode> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
};

async function decodeDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ height: number; width: number }>(
      (resolve, reject) => {
        const image = new window.Image();
        image.addEventListener(
          'load',
          () =>
            resolve({
              height: image.naturalHeight,
              width: image.naturalWidth,
            }),
          { once: true },
        );
        image.addEventListener(
          'error',
          () => reject(new Error('Unable to decode image')),
          { once: true },
        );
        image.src = url;
      },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function inspectImageFile(
  file: File,
  constraints: ImageApi.AssetConstraintsVO,
): Promise<
  | (InspectedImageFile & { valid: true })
  | { code: UploadValidationCode; valid: false }
> {
  if (constraints.maxUploadBytes && file.size > constraints.maxUploadBytes) {
    return { code: 'size', valid: false };
  }

  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  const extensionFormat = EXTENSION_FORMATS[extension];
  const mimeFormat = MIME_FORMATS[file.type.toLowerCase()];
  const format = mimeFormat ?? extensionFormat;
  const allowed = new Set(
    (constraints.formats ?? []).map((value) => value.toUpperCase()),
  );
  if (
    !format ||
    !extensionFormat ||
    (Boolean(file.type) && !mimeFormat) ||
    (mimeFormat && mimeFormat !== extensionFormat) ||
    (allowed.size > 0 && !allowed.has(format))
  ) {
    return { code: 'format', valid: false };
  }

  let dimensions: { height: number; width: number };
  try {
    dimensions = await decodeDimensions(file);
  } catch {
    return { code: 'decode', valid: false };
  }
  if (
    !dimensions.width ||
    !dimensions.height ||
    (constraints.maxPixels &&
      dimensions.width * dimensions.height > constraints.maxPixels)
  ) {
    return { code: 'pixels', valid: false };
  }
  return { ...dimensions, format, valid: true };
}
