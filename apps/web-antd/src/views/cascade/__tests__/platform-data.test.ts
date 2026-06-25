import { describe, expect, it, vi } from 'vitest';

import {
  usePlatformColumns,
  usePlatformFormSchema,
  usePlatformGridFormSchema,
} from '../platform/data';

// $t 桩：回显 key，便于断言 i18n 命名空间
vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

// useAccess 桩：放行全部权限（操作列 show 回调依赖）
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

/**
 * cascade/platform/data.ts —— 表单/表格/筛选 Schema。
 *
 * 字段以后端 CascadePlatformVO（tb_cascade_platform）为唯一事实来源：
 * platformIp/platformPort/platformDomain/localIp/localPort/charset/registerStatus，
 * **不得**出现旧错误字段 serverIp/serverPort/serverDomain/localClientIp/localClientPort/platformName。
 */
describe('cascade/platform/data', () => {
  describe('usePlatformFormSchema —— 新增/编辑表单字段', () => {
    it('包含后端真实字段，不含臆造字段', () => {
      const fields = usePlatformFormSchema(false).map((s) => s.fieldName);
      // 真实字段
      for (const f of [
        'platformId',
        'platformIp',
        'platformPort',
        'platformDomain',
        'localClientId',
        'localIp',
        'localPort',
        'charset',
        'transport',
      ]) {
        expect(fields).toContain(f);
      }
      // 臆造字段必须不存在
      for (const bad of [
        'serverIp',
        'serverPort',
        'serverDomain',
        'localClientIp',
        'localClientPort',
        'platformName',
      ]) {
        expect(fields).not.toContain(bad);
      }
    });

    it('编辑模式下 platformId 只读', () => {
      const schema = usePlatformFormSchema(true);
      const platformIdField = schema.find((s) => s.fieldName === 'platformId');
      expect((platformIdField?.componentProps as any)?.disabled).toBe(true);
    });

    it('必填字段带 required 规则', () => {
      const schema = usePlatformFormSchema(false);
      for (const f of [
        'platformId',
        'platformIp',
        'platformPort',
        'localClientId',
      ]) {
        expect(schema.find((s) => s.fieldName === f)?.rules).toBeTruthy();
      }
    });
  });

  describe('usePlatformColumns —— 表格列', () => {
    it('含 registerStatus 列且用 CellTag 渲染', () => {
      const cols = usePlatformColumns(vi.fn()) ?? [];
      const statusCol = cols.find((c: any) => c.field === 'registerStatus');
      expect(statusCol).toBeDefined();
      expect((statusCol as any).cellRender?.name).toBe('CellTag');
    });

    it('操作列含 subscribe（订阅详情）操作', () => {
      const cols = usePlatformColumns(vi.fn()) ?? [];
      const opCol = cols.find((c: any) => c.field === 'operation');
      const codes = ((opCol as any).cellRender?.options ?? []).map(
        (o: any) => o.code,
      );
      expect(codes).toContain('subscribe');
      expect(codes).toContain('enable');
      expect(codes).toContain('disable');
    });
  });

  describe('usePlatformGridFormSchema —— 筛选条件', () => {
    it('含 platformIp 与 registerStatus 筛选，不含臆造 serverIp', () => {
      const fields = usePlatformGridFormSchema().map((s) => s.fieldName);
      expect(fields).toContain('platformIp');
      expect(fields).toContain('registerStatus');
      expect(fields).not.toContain('serverIp');
    });
  });
});
