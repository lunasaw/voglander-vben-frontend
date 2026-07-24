import type { ImageApi } from '#/api/image';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inspectImageFile } from '../assets/upload-validation';

const constraints: ImageApi.AssetConstraintsVO = {
  formats: ['JPEG', 'PNG', 'WEBP'],
  maxPixels: 2_000_000,
  maxUploadBytes: 1024,
};

class DecodableImage {
  naturalHeight = 600;
  naturalWidth = 800;

  get src() {
    return '';
  }

  set src(_value: string) {
    queueMicrotask(() => this.dispatch('load'));
  }

  private listeners: Partial<Record<'error' | 'load', () => void>> = {};

  addEventListener(type: 'error' | 'load', listener: () => void) {
    this.listeners[type] = listener;
  }

  protected dispatch(type: 'error' | 'load') {
    this.listeners[type]?.();
  }
}

describe('image upload validation', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', DecodableImage);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:upload');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('accepts a decoded image when extension, MIME and constraints agree', async () => {
    const file = new File(['image'], 'camera.jpeg', { type: 'image/jpeg' });

    await expect(inspectImageFile(file, constraints)).resolves.toEqual({
      format: 'JPEG',
      height: 600,
      valid: true,
      width: 800,
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:upload');
  });

  it('rejects size and MIME/extension mismatches before decoding', async () => {
    const tooLarge = new File([new Uint8Array(1025)], 'camera.jpg', {
      type: 'image/jpeg',
    });
    const wrongMime = new File(['image'], 'camera.jpg', {
      type: 'text/plain',
    });
    const mismatched = new File(['image'], 'camera.png', {
      type: 'image/jpeg',
    });

    await expect(inspectImageFile(tooLarge, constraints)).resolves.toEqual({
      code: 'size',
      valid: false,
    });
    await expect(inspectImageFile(wrongMime, constraints)).resolves.toEqual({
      code: 'format',
      valid: false,
    });
    await expect(inspectImageFile(mismatched, constraints)).resolves.toEqual({
      code: 'format',
      valid: false,
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects decoded pixel overflow and corrupt image data', async () => {
    class OversizedImage extends DecodableImage {
      override naturalHeight = 2000;
      override naturalWidth = 2000;
    }
    vi.stubGlobal('Image', OversizedImage);
    const image = new File(['image'], 'camera.webp', { type: 'image/webp' });
    await expect(inspectImageFile(image, constraints)).resolves.toEqual({
      code: 'pixels',
      valid: false,
    });

    class CorruptImage extends DecodableImage {
      override get src() {
        return '';
      }

      override set src(_value: string) {
        queueMicrotask(() => this.dispatch('error'));
      }
    }
    vi.stubGlobal('Image', CorruptImage);
    await expect(inspectImageFile(image, constraints)).resolves.toEqual({
      code: 'decode',
      valid: false,
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
