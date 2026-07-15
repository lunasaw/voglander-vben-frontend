import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createImageCollection,
  deleteImageAsset,
  getImageAssetPage,
  uploadImageAsset,
} from '../image';

const getMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('#/api/request', () => ({
  requestClient: {
    get: (...args: any[]) => getMock(...args),
    post: (...args: any[]) => postMock(...args),
    delete: (...args: any[]) => deleteMock(...args),
  },
}));
beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  deleteMock.mockReset();
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
    );
  });
  it('upload creates multipart body and a fresh idempotency header', async () => {
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await uploadImageAsset(file, 'idem-1', 'Photo');
    const call = postMock.mock.calls[0];
    expect(call).toBeDefined();
    const [path, body, options] = call ?? [];
    expect(path).toBe('/api/v1/images/uploads');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(options.headers['Idempotency-Key']).toBe('idem-1');
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
    const createCall = postMock.mock.calls[0];
    expect(createCall?.[0]).toBe('/api/v1/image-collection-tasks');
    expect(createCall?.[2]?.headers['Idempotency-Key']).toBe('idem-2');
    expect(deleteMock).toHaveBeenCalledWith('/api/v1/images/img_1');
  });
});
