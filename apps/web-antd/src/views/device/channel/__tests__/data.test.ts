import { describe, expect, it, vi } from 'vitest';

import {
  buildChannelPageBody,
  useColumns,
  useFormSchema,
  useGridFormSchema,
} from '../data';

/**
 * views/device/channel/data.ts —— 通道列表页的纯函数与 Schema/列定义。
 *
 * 规格依据：GB28181-DEVICE-CHANNEL-SUBSCRIBE-FRONTEND-PLAN.md §4.2。
 *  - 筛选维度仅 channelId/name/status（§1.1 QueryReq 真实字段）+ 路由注入的 deviceId
 *  - buildChannelPageBody：透传表单值并强制注入 deviceId
 *  - 列：channelId(mono) / name / statusName(CellTag) / createTime(formatter) / 操作(liveStart)
 */

// $t 桩：回显 key，便于断言 i18n 命名空间。
vi.mock('#/locales', () => ({ $t: (k: string) => k }));

// useAccess 桩（列定义里操作按钮引用权限码）。
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

describe('buildChannelPageBody —— 强制注入 deviceId（§4.2）', () => {
  it('透传 channelId/name/status，并注入 deviceId', () => {
    const body = buildChannelPageBody(
      { channelId: 'c1', name: 'cam', status: 1 },
      'd1',
    );
    expect(body).toEqual({
      channelId: 'c1',
      name: 'cam',
      status: 1,
      deviceId: 'd1',
    });
  });

  it('空表单也注入 deviceId', () => {
    expect(buildChannelPageBody({}, 'd9')).toEqual({ deviceId: 'd9' });
  });

  it('表单内若携带 deviceId 会被路由 deviceId 覆盖（钻取语义优先）', () => {
    const body = buildChannelPageBody({ deviceId: 'wrong' }, 'd1');
    expect(body.deviceId).toBe('d1');
  });
});

describe('useGridFormSchema —— ���选维度（§1.1：仅 channelId/name/status）', () => {
  const schema = useGridFormSchema();
  const fields = schema.map((s: any) => s.fieldName);

  it('含 channelId/name/status', () => {
    expect(fields).toEqual(
      expect.arrayContaining(['channelId', 'name', 'status']),
    );
  });

  it('严禁把 VO 派生字段（ip/port/deviceId）作为筛选条件（§1.1 红线）', () => {
    expect(fields).not.toContain('ip');
    expect(fields).not.toContain('port');
    // deviceId 由路由注入，不作为可见筛选项
    expect(fields).not.toContain('deviceId');
  });

  it('status 是带在线/离线选项的下拉（value 1/0）', () => {
    const statusField = schema.find(
      (s: any) => s.fieldName === 'status',
    ) as any;
    expect(statusField.component).toBe('Select');
    const values = statusField.componentProps.options.map((o: any) => o.value);
    expect(values.toSorted()).toEqual([0, 1]);
  });
});

describe('useColumns —— 列定义', () => {
  const cols = useColumns(() => {}) as any[];
  const fields = cols.map((c) => c.field).filter(Boolean);

  it('含 channelId/name/statusName/createTime 列', () => {
    expect(fields).toEqual(
      expect.arrayContaining(['channelId', 'name', 'statusName', 'createTime']),
    );
  });

  it('channelId 列用等宽 className（mono 读数）', () => {
    const col = cols.find((c) => c.field === 'channelId');
    expect(String(col.className)).toContain('mono');
  });

  it('statusName 列用 CellTag 渲染在线/离线', () => {
    const col = cols.find((c) => c.field === 'statusName');
    expect(col.cellRender.name).toBe('CellTag');
    const values = col.cellRender.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['在线', '离线']));
  });

  it('createTime 列有 formatter（Unix 毫秒 → 本地时间），空值回退 "-"', () => {
    const col = cols.find((c) => c.field === 'createTime');
    expect(col.formatter).toBeDefined();
    expect(col.formatter({ cellValue: undefined })).toBe('-');
    const out = col.formatter({
      cellValue: new Date('2026-06-01T08:00:00').getTime(),
    });
    expect(typeof out).toBe('string');
    expect(out).not.toBe('-');
  });

  it('末列是操作列（liveStart+edit+delete），fixed right', () => {
    const opCol = cols.at(-1);
    expect(opCol.fixed).toBe('right');
    const codes = opCol.cellRender.options.map((o: any) => o.code);
    expect(codes).toEqual(
      expect.arrayContaining(['liveStart', 'edit', 'delete']),
    );
  });

  it('首列是复选框（支持勾选批量删除）', () => {
    expect(cols[0].type).toBe('checkbox');
  });

  it('edit/delete 操作按权限码 Device:Channel:* 受控', () => {
    const opCol = cols.at(-1);
    const opts = opCol.cellRender.options;
    // show 是函数（hasAccessByCodes 桩恒 true），断言存在即可——权限码字符串由 SQL 测试侧守。
    for (const code of ['edit', 'delete']) {
      const o = opts.find((x: any) => x.code === code);
      expect(typeof o.show).toBe('function');
      expect(o.show()).toBe(true);
    }
  });

  it('delete 操作标红（danger）以内置 Popconfirm 二次确认', () => {
    const opCol = cols.at(-1);
    const del = opCol.cellRender.options.find((o: any) => o.code === 'delete');
    expect(del.danger).toBe(true);
  });
});

describe('useFormSchema —— 编辑表单字段（仅 name/status 可编辑，身份字段只读）', () => {
  const schema = useFormSchema();
  const byField = (f: string) =>
    schema.find((s: any) => s.fieldName === f) as any;

  it('含 deviceId/channelId/name/status 四字段', () => {
    const fields = schema.map((s: any) => s.fieldName);
    expect(fields).toEqual(['deviceId', 'channelId', 'name', 'status']);
  });

  it('deviceId/channelId 为只读（disabled）身份字段', () => {
    expect(byField('deviceId').componentProps.disabled).toBe(true);
    expect(byField('channelId').componentProps.disabled).toBe(true);
  });

  it('name 为可编辑 Input（无 disabled）', () => {
    const name = byField('name');
    expect(name.component).toBe('Input');
    expect(name.componentProps?.disabled).toBeUndefined();
  });

  it('status 为在线/离线 Select 且必填', () => {
    const status = byField('status');
    expect(status.component).toBe('Select');
    expect(status.rules).toBe('selectRequired');
    const values = status.componentProps.options.map((o: any) => o.value);
    expect(values.toSorted()).toEqual([0, 1]);
  });
});
