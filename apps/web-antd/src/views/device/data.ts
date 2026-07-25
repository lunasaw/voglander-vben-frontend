import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DeviceApi } from '#/api/device';
import type { LabEvent } from '#/composables/useSseEvents';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

/**
 * 设备列表页的 Schema / 列定义 + 纯函数（§4.2）。
 *
 * 纯函数（buildDevicePageBody / mergeDeviceEvents）抽出便于单测，
 * list.vue 只做组装与副作用（query / SSE 订阅 / 抽屉）。
 */

/** 格式化 Unix 毫秒为本地时间串，空值回退 "-"。 */
function formatMs(cellValue?: number): string {
  return cellValue ? new Date(cellValue).toLocaleString() : '-';
}

/**
 * 从设备扩展信息中解析厂商名。
 *
 * 后端 DeviceVO 无顶层厂商字段——厂商埋在 extendInfo.deviceInfo（设备信息应答
 * DeviceInfo 的 JSON 串，含 manufacturer/model/firmware）。该快照仅在设备应答
 * 「查设备信息」后才有，故大多数行可能为空 → 统一回退 "-"。
 */
export function resolveManufacturer(row: DeviceApi.DeviceVO): string {
  const raw = row.extendInfo?.deviceInfo;
  if (!raw) {
    return '-';
  }
  try {
    const info = JSON.parse(raw) as { manufacturer?: string };
    return info.manufacturer?.trim() || '-';
  } catch {
    return '-'; // deviceInfo 非合法 JSON，容错回退
  }
}

/**
 * 把查询表单值转为后端 DevicePageReq：
 * RangePicker 字段（keepaliveTime / registerTime）输出 [start,end]，
 * 转为 *TimeStart / *TimeEnd（Unix 毫秒）并删除原 range 字段（§4.2 时间铁律）。
 */
export function buildDevicePageBody(
  formValues: Record<string, any>,
): DeviceApi.DevicePageReq {
  const ranges: Array<[string, string, string]> = [
    ['keepaliveTime', 'keepaliveTimeStart', 'keepaliveTimeEnd'],
    ['registerTime', 'registerTimeStart', 'registerTimeEnd'],
  ];
  // 收集需要剔除的 RangePicker 原字段，重建 body 时排除（避免动态 delete）。
  const rangeFields = new Set(ranges.map(([field]) => field));
  const body: Record<string, any> = {};
  for (const [key, value] of Object.entries(formValues)) {
    if (!rangeFields.has(key)) {
      body[key] = value;
    }
  }
  for (const [rangeField, startField, endField] of ranges) {
    const range = formValues[rangeField];
    if (Array.isArray(range) && range.length === 2) {
      body[startField] = +new Date(range[0]);
      body[endField] = +new Date(range[1]);
    }
  }
  return body as DeviceApi.DevicePageReq;
}

/**
 * 按 SSE device.* 事件对当前页行做 upsert（在线态 / 心跳 / 通道数）。
 *
 * 服务端分页：只更新当前页已有的 deviceId，新设备等下次 query 才出现。
 * 返回新数组（不原地改），便于 vxe reloadData 触发刷新。
 */
export function mergeDeviceEvents<T extends DeviceApi.DeviceVO>(
  rows: T[],
  events: LabEvent[],
): T[] {
  if (events.length === 0) {
    return [...rows];
  }
  const byId = new Map(rows.map((r) => [r.deviceId, { ...r }]));
  for (const ev of events) {
    const id = ev.data?.deviceId;
    if (!id) {
      continue;
    }
    const row = byId.get(id);
    if (!row) {
      continue; // 不在当前页，忽略
    }
    switch (ev.topic) {
      case 'device.catalog': {
        row.channelCount = ev.data?.channelCount;
        break;
      }
      case 'device.keepalive': {
        row.keepaliveTime = ev.ts;
        row.status = 1;
        row.statusName = $t('device.status.online');
        break;
      }
      case 'device.offline': {
        row.status = 0;
        row.statusName = $t('device.status.offline');
        break;
      }
      case 'device.online':
      case 'device.register': {
        row.status = 1;
        row.statusName = $t('device.status.online');
        break;
      }
      // 其它 topic 不改行
    }
  }
  return rows.map((r) => byId.get(r.deviceId) ?? r);
}

/** 协议类型选项（DeviceAgreementEnum：1=GB28181 IPC / 2=NVR / 3=ONVIF）。 */
const DEVICE_TYPE_OPTIONS = [
  { label: 'GB28181 IPC', value: 1 },
  { label: 'GB28181 NVR', value: 2 },
  { label: 'ONVIF IPC', value: 3 },
];

/**
 * 设备编辑表单字段（§4.2 编辑支链）。
 *
 * deviceId 为唯一索引，编辑时只读（仅展示，不可改）；id 走隐藏字段透传。
 * 其余字段（name/ip/port/type/serverIp/status）对应 PUT /device/update 可更新项。
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      dependencies: {
        show: () => false,
        triggerFields: ['id'],
      },
      fieldName: 'id',
      label: 'id',
    },
    {
      component: 'Input',
      componentProps: { disabled: true },
      fieldName: 'deviceId',
      label: $t('device.field.deviceId'),
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('device.field.name'),
    },
    {
      component: 'Select',
      componentProps: { options: DEVICE_TYPE_OPTIONS },
      fieldName: 'type',
      label: $t('device.field.type'),
    },
    {
      component: 'Input',
      fieldName: 'ip',
      label: $t('device.field.ip'),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 65_535, min: 0, precision: 0 },
      fieldName: 'port',
      label: $t('device.field.port'),
    },
    {
      component: 'Input',
      fieldName: 'serverIp',
      label: $t('device.field.serverIp'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('device.status.online'), value: 1 },
          { label: $t('device.status.offline'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('device.field.status'),
    },
  ];
}

/** 顶部筛选条件（§1.1：仅 type 维度，禁用派生字段 subType/protocol）。 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'deviceId',
      label: $t('device.field.deviceId'),
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('device.field.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('device.status.online'), value: 1 },
          { label: $t('device.status.offline'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('device.field.status'),
    },
    {
      component: 'Input',
      fieldName: 'ip',
      label: $t('device.field.ip'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        showTime: true,
      },
      fieldName: 'keepaliveTime',
      label: $t('device.field.keepaliveTime'),
    },
  ];
}

/** 列定义（含 channelCount / statusName，操作列 detail / edit / delete）。 */
export function useColumns<T = DeviceApi.DeviceVO>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();

  return [
    {
      type: 'checkbox',
      width: 48,
      align: 'center',
      fixed: 'left',
    },
    {
      field: 'deviceId',
      title: $t('device.field.deviceId'),
      width: 220,
      className: 'device-cell-mono',
    },
    {
      field: 'name',
      title: $t('device.field.name'),
      minWidth: 140,
      className: 'device-cell-name',
    },
    {
      field: 'statusName',
      title: $t('device.field.status'),
      width: 90,
      align: 'center',
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'success',
            label: $t('device.status.online'),
            value: '在线',
          },
          { color: 'error', label: $t('device.status.offline'), value: '离线' },
        ],
      },
    },
    {
      field: 'typeName',
      title: $t('device.field.type'),
      width: 120,
    },
    {
      field: 'manufacturer',
      title: $t('device.field.manufacturer'),
      width: 120,
      // 厂商来自 extendInfo.deviceInfo JSON（设备应答快照），用 formatter 现解析。
      formatter: ({ row }: { row: DeviceApi.DeviceVO }) =>
        resolveManufacturer(row),
    },
    {
      field: 'ip',
      title: $t('device.field.ip'),
      width: 130,
      className: 'device-cell-mono',
    },
    {
      field: 'channelCount',
      title: $t('device.field.channelCount'),
      width: 90,
      align: 'center',
      className: 'device-cell-count',
      slots: { default: 'channelCount' }, // list.vue 提供具名插槽（可点击钻取通道列表）
    },
    {
      field: 'keepaliveTime',
      title: $t('device.field.keepaliveTime'),
      width: 170,
      formatter: ({ cellValue }: { cellValue?: number }) => formatMs(cellValue),
    },
    {
      field: 'registerTime',
      title: $t('device.field.registerTime'),
      width: 170,
      formatter: ({ cellValue }: { cellValue?: number }) => formatMs(cellValue),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('device.field.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'detail',
            text: $t('device.action.detail'),
            show: () => hasAccessByCodes(['Device:Device:Query']),
          },
          {
            code: 'edit',
            text: $t('device.action.edit'),
            show: () => hasAccessByCodes(['Device:Device:Edit']),
          },
          {
            code: 'delete',
            danger: true,
            text: $t('device.action.delete'),
            show: () => hasAccessByCodes(['Device:Device:Delete']),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('device.field.operation'),
      width: 200,
    },
  ];
}
