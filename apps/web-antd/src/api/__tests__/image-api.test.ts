import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createImageCollection,
  deleteImageAsset,
  downloadImageAssetBlob,
  getImageAssetContentBlob,
  getImageAssetPage,
  getImageAssetThumbnailBlob,
  uploadImageAsset,
} from '../image';

const getMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();
const downloadMock = vi.fn();
const requestWithErrorMetaMock = vi.fn();
vi.mock('#/api/request', () => ({
  requestWithErrorMeta: (...args: any[]) => requestWithErrorMetaMock(...args),
  requestClient: {
    delete: (...args: any[]) => deleteMock(...args),
    download: (...args: any[]) => downloadMock(...args),
    get: (...args: any[]) => getMock(...args),
    post: (...args: any[]) => postMock(...args),
  },
}));
beforeEach(() => {
  deleteMock.mockReset();
  downloadMock.mockReset();
  getMock.mockReset();
  postMock.mockReset();
  requestWithErrorMetaMock.mockReset();
});

describe('image API contract', () => {
  it('资产分页 mirrors backend method/path/body/query', async () => {
    await getImageAssetPage(
      { page: 2, size: 24 },
      { status: 'AVAILABLE', deviceId: 'd1' },
    );
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/images/getPage?page=2&size=24',
      { status: 'AVAILABLE', deviceId: 'd1' },
      { signal: undefined, suppressGlobalError: true },
    );
  });
  it('upload creates multipart body and a fresh idempotency header', async () => {
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await uploadImageAsset(file, 'idem-1', 'Photo');
    const call = requestWithErrorMetaMock.mock.calls[0];
    expect(call).toBeDefined();
    const [path, options] = call ?? [];
    expect(path).toBe('/api/v1/images/uploads');
    expect(options.data).toBeInstanceOf(FormData);
    expect((options.data as FormData).get('file')).toBe(file);
    expect(options.headers['Content-Type']).toBe('multipart/form-data');
    expect(options.headers['Idempotency-Key']).toBe('idem-1');
    expect(options.method).toBe('POST');
  });
  it('collection create and delete use stable colon/action paths', async () => {
    await createImageCollection(
      {
        taskName: 'one',
        collectionMode: 'ONCE',
        deviceId: 'd1',
        channelId: 'c1',
      },
      'idem-2',
    );
    await deleteImageAsset('img_1');
    const createCall = requestWithErrorMetaMock.mock.calls[0];
    expect(createCall?.[0]).toBe('/api/v1/image-collection-tasks');
    expect(createCall?.[1]?.headers['Idempotency-Key']).toBe('idem-2');
    expect(deleteMock).toHaveBeenCalledWith('/api/v1/images/img_1');
  });

  it('private image variants use authenticated download requests', async () => {
    const blob = new Blob(['image'], { type: 'image/jpeg' });
    downloadMock
      .mockResolvedValueOnce(blob)
      .mockResolvedValueOnce(blob)
      .mockResolvedValueOnce({
        data: blob,
        headers: {
          'content-disposition': 'attachment; filename="photo.jpg"',
          'content-type': 'image/jpeg',
        },
      });

    await expect(getImageAssetThumbnailBlob('img/1', 'gallery')).resolves.toBe(
      blob,
    );
    await expect(getImageAssetContentBlob('img/1')).resolves.toBe(blob);
    await expect(downloadImageAssetBlob('img/1')).resolves.toEqual({
      blob,
      contentDisposition: 'attachment; filename="photo.jpg"',
      contentType: 'image/jpeg',
    });
    expect(downloadMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/images/img%2F1/thumbnail',
      {
        params: { profile: 'gallery' },
        signal: undefined,
        suppressGlobalError: true,
      },
    );
    expect(downloadMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/images/img%2F1/content',
      { signal: undefined, suppressGlobalError: true },
    );
    expect(downloadMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/images/img%2F1/download',
      {
        responseReturn: 'raw',
        signal: undefined,
        suppressGlobalError: true,
      },
    );
  });
});
