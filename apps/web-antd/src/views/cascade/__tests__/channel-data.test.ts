import { describe, expect, it, vi } from 'vitest';

import {
  useChannelColumns,
  useChannelFormSchema,
  useChannelGridFormSchema,
} from '../channel/data';

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

/**
 * cascade/channel/data.ts —— 通道映射 Schema。
 *
 * 字段前后端一致：platformId/localDeviceId/localChannelId/cascadeChannelId/cascadeName。
 */
describe('cascade/channel/data', () => {
  describe('useChannelFormSchema', () => {
    it('包含通道映射全部字段', () => {
      const fields = useChannelFormSchema(false, []).map((s) => s.fieldName);
      for (const f of [
        'platformId',
        'localDeviceId',
        'localChannelId',
        'cascadeChannelId',
        'cascadeName',
      ]) {
        expect(fields).toContain(f);
      }
    });

    it('编辑模式下身份字段只读（platformId/localDeviceId/localChannelId）', () => {
      const schema = useChannelFormSchema(true, []);
      for (const f of ['platformId', 'localDeviceId', 'localChannelId']) {
        const field = schema.find((s) => s.fieldName === f);
        expect((field?.componentProps as any)?.disabled).toBe(true);
      }
    });
  });

  describe('useChannelColumns', () => {
    it('操作列含 edit/delete', () => {
      const cols = useChannelColumns(vi.fn()) ?? [];
      const opCol = cols.find((c: any) => c.field === 'operation');
      const codes = ((opCol as any).cellRender?.options ?? []).map(
        (o: any) => o.code,
      );
      expect(codes).toContain('edit');
      expect(codes).toContain('delete');
    });
  });

  describe('useChannelGridFormSchema', () => {
    it('含 platformId 筛选', () => {
      const fields = useChannelGridFormSchema([]).map((s) => s.fieldName);
      expect(fields).toContain('platformId');
    });
  });
});
