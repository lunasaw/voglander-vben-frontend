import { describe, expect, it, vi } from 'vitest';

import {
  buildDevicePageBody,
  mergeDeviceEvents,
  useColumns,
  useGridFormSchema,
} from '../data';

/**
 * views/device/data.ts —— 设备列表页的纯函数与 Schema/列定义。
 *
 * 规格依据：GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md §4.2。
 *  - 筛选维度仅 deviceId/name/status/ip + 时间范围（§1.1：禁用 subType/protocol 作筛选条件）
 *  - 时间铁律：RangePicker [start,end] 提交前转 Unix 毫秒（keepaliveTimeStart/End）
 *  - SSE 增量：device.* 事件按 deviceId upsert 行的在线态 / 心跳 / 通道数
 */

// $t 桩：回显 key，便于断言 i18n 命名空间。
vi.mock('#/locales', () => ({ $t: (k: string) => k }));

// useAccess 桩（列定义里操作按钮可能引用权限）。
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

describe('buildDevicePageBody —— RangePicker → Unix 毫秒（§4.2 时间铁律）', () => {
  it('keepaliveTime [start,end] 转 keepaliveTimeStart/End 并删除原字段', () => {
    const start = new Date('2026-06-01T00:00:00').getTime();
    const end = new Date('2026-06-02T00:00:00').getTime();
    const body = buildDevicePageBody({
      deviceId: 'd1',
      keepaliveTime: [start, end],
    });
    expect(body.keepaliveTimeStart).toBe(start);
    expect(body.keepaliveTimeEnd).toBe(end);
    expect((body as any).keepaliveTime).toBeUndefined();
    expect(body.deviceId).toBe('d1');
  });

  it('registerTime [start,end] 转 registerTimeStart/End', () => {
    const start = new Date('2026-06-01T00:00:00').getTime();
    const end = new Date('2026-06-02T00:00:00').getTime();
    const body = buildDevicePageBody({ registerTime: [start, end] });
    expect(body.registerTimeStart).toBe(start);
    expect(body.registerTimeEnd).toBe(end);
    expect((body as any).registerTime).toBeUndefined();
  });

  it('无时间范围时原样透传其它条件', () => {
    const body = buildDevicePageBody({ deviceId: 'd1', status: 1, ip: '10.0' });
    expect(body).toEqual({ deviceId: 'd1', status: 1, ip: '10.0' });
  });

  it('空表单返回空对象（不含残留 undefined range 字段）', () => {
    expect(buildDevicePageBody({})).toEqual({});
  });

  it('range 数组长度不为 2 时忽略（不产生 NaN 边界）', () => {
    const body = buildDevicePageBody({ keepaliveTime: [123] as any });
    expect(body.keepaliveTimeStart).toBeUndefined();
    expect(body.keepaliveTimeEnd).toBeUndefined();
  });
});

describe('mergeDeviceEvents —— SSE 行增量 upsert（§4.2）', () => {
  const baseRows = [
    {
      id: 1,
      deviceId: 'd1',
      status: 0,
      statusName: 'device.status.offline',
      keepaliveTime: 100,
      channelCount: 0,
    },
    {
      id: 2,
      deviceId: 'd2',
      status: 1,
      statusName: 'device.status.online',
      keepaliveTime: 100,
      channelCount: 2,
    },
  ];

  function ev(topic: string, data: Record<string, any>, ts = 200) {
    return { topic, data, ts, seq: 0, dir: 'out' as const };
  }

  it('device.online 把对应行置在线（status=1 + statusName）', () => {
    const next = mergeDeviceEvents(baseRows, [
      ev('device.online', { deviceId: 'd1' }),
    ]);
    const d1 = next.find((r) => r.deviceId === 'd1');
    expect(d1?.status).toBe(1);
    expect(d1?.statusName).toBe('device.status.online');
  });

  it('device.offline 把对应行置离线（status=0）', () => {
    const next = mergeDeviceEvents(baseRows, [
      ev('device.offline', { deviceId: 'd2' }),
    ]);
    const d2 = next.find((r) => r.deviceId === 'd2');
    expect(d2?.status).toBe(0);
    expect(d2?.statusName).toBe('device.status.offline');
  });

  it('device.keepalive 刷新 keepaliveTime 为事件 ts 并置在线', () => {
    const next = mergeDeviceEvents(baseRows, [
      ev('device.keepalive', { deviceId: 'd1' }, 999),
    ]);
    const d1 = next.find((r) => r.deviceId === 'd1');
    expect(d1?.keepaliveTime).toBe(999);
    expect(d1?.status).toBe(1);
  });

  it('device.catalog 刷新 channelCount', () => {
    const next = mergeDeviceEvents(baseRows, [
      ev('device.catalog', { deviceId: 'd2', channelCount: 16 }),
    ]);
    expect(next.find((r) => r.deviceId === 'd2')?.channelCount).toBe(16);
  });

  it('未在当前页的 deviceId 事件被忽略（服务端分页，下次查询才出现）', () => {
    const next = mergeDeviceEvents(baseRows, [
      ev('device.online', { deviceId: 'unknown' }),
    ]);
    expect(next).toHaveLength(2);
    expect(next.some((r) => r.deviceId === 'unknown')).toBe(false);
  });

  it('无 deviceId 的事件被忽略，不抛异常', () => {
    expect(() =>
      mergeDeviceEvents(baseRows, [ev('session.bye', { callId: 'c1' })]),
    ).not.toThrow();
  });

  it('返回新数组引用（不原地改入参，便于 vxe reloadData 触发刷新）', () => {
    const next = mergeDeviceEvents(baseRows, [
      ev('device.online', { deviceId: 'd1' }),
    ]);
    expect(next).not.toBe(baseRows);
  });

  it('无事件时返回等价行集合', () => {
    const next = mergeDeviceEvents(baseRows, []);
    expect(next.map((r) => r.deviceId)).toEqual(['d1', 'd2']);
  });
});

describe('useGridFormSchema —— 筛选维度（§1.1：禁用 subType/protocol）', () => {
  const schema = useGridFormSchema();
  const fields = schema.map((s: any) => s.fieldName);

  it('含 deviceId/name/status/ip + 时间范围', () => {
    expect(fields).toEqual(
      expect.arrayContaining(['deviceId', 'name', 'status', 'ip']),
    );
    // 至少一个时间范围筛选
    expect(fields.some((f: string) => f.endsWith('Time'))).toBe(true);
  });

  it('严禁把派生展示字段 subType / protocol 作为筛选条件（§1.1 缺口 D）', () => {
    expect(fields).not.toContain('subType');
    expect(fields).not.toContain('protocol');
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

  it('含 channelCount 与 statusName 列（DoD 验收）', () => {
    expect(fields).toContain('channelCount');
    expect(fields).toContain('statusName');
  });

  it('含 deviceId/name/typeName/ip/keepaliveTime/registerTime 列', () => {
    expect(fields).toEqual(
      expect.arrayContaining([
        'deviceId',
        'name',
        'typeName',
        'ip',
        'keepaliveTime',
        'registerTime',
      ]),
    );
  });

  it('keepaliveTime/registerTime 列有 formatter（Unix 毫秒 → 本地时间）', () => {
    for (const f of ['keepaliveTime', 'registerTime']) {
      const col = cols.find((c) => c.field === f);
      expect(col.formatter, `${f} 缺 formatter`).toBeDefined();
    }
  });

  it('keepaliveTime formatter 空值回退 "-"，有值格式化为本地时间串', () => {
    const col = cols.find((c) => c.field === 'keepaliveTime');
    expect(col.formatter({ cellValue: undefined })).toBe('-');
    const out = col.formatter({
      cellValue: new Date('2026-06-01T08:00:00').getTime(),
    });
    expect(typeof out).toBe('string');
    expect(out).not.toBe('-');
  });

  it('末列是操作列（detail / live），fixed right', () => {
    const opCol = cols.at(-1);
    expect(opCol.fixed).toBe('right');
    const codes = opCol.cellRender.options.map((o: any) => o.code);
    expect(codes).toEqual(expect.arrayContaining(['detail', 'liveStart']));
  });
});
