import { describe, expect, it, vi } from 'vitest';

import { useImagePreview } from '../useImagePreview';

describe('useImagePreview', () => {
  it('reuses URL by reference and revokes exactly once at final release', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => new Blob(['x'], { type: 'image/jpeg' }),
      }),
    );
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const preview = useImagePreview();
    const first = await preview.load('img_1');
    const second = await preview.load('img_1');
    expect(first).toBe(second);
    expect(create).toHaveBeenCalledTimes(1);
    preview.release('img_1');
    expect(revoke).not.toHaveBeenCalled();
    preview.release('img_1');
    expect(revoke).toHaveBeenCalledWith('blob:one');
    create.mockRestore();
    revoke.mockRestore();
  });
});
