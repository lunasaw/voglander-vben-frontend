import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DeviceApi } from '#/api/device';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

/**
 * 通道列表页（钻取页）的 Schema / 列定义 + 纯函数（§4.2）。
 *
 * 纯函数（buildChannelPageBody）抽出便于单测；list.vue 只做组装与副作用
 * （读 route.params.deviceId / query / 点播弹窗）。筛选维度严格对齐
 * DeviceChannelQueryReq 真实字段（channelId/name/status），deviceId 由路由注入。
 */

/** 格式化 Unix 毫秒为本地时间串，空值回退 "-"。 */
function formatMs(cellValue?: number): string {
  return cellValue ? new Date(cellValue).toLocaleString() : '-';
}

/**
 * 通道筛选 body：透传表单 channelId/name/status，强制注入路由 deviceId。
 * deviceId 钻取语义优先——表单内若误带 deviceId 也以路由值覆盖。
 */
export function buildChannelPageBody(
  formValues: Record<string, any>,
  deviceId: string,
): DeviceApi.DeviceChannelQueryReq {
  return { ...formValues, deviceId };
}

/**
 * 编辑表单字段（通道更新）。
 * deviceId / channelId 是身份字段（后端按主键 id 更新，二者不可改）——只读展示；
 * 仅 name / status 可编辑。id 由 channel-form.vue 回填、隐藏不渲染。
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { disabled: true },
      fieldName: 'deviceId',
      label: $t('device.field.deviceId'),
    },
    {
      component: 'Input',
      componentProps: { disabled: true },
      fieldName: 'channelId',
      label: $t('device.field.channelId'),
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('device.field.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: false,
        options: [
          { label: $t('device.status.online'), value: 1 },
          { label: $t('device.status.offline'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('device.field.status'),
      rules: 'selectRequired',
    },
  ];
}

/** 顶部筛选：name / channelId / status（名称前置——通道按名称检索最常用）。 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('device.field.name'),
    },
    {
      component: 'Input',
      fieldName: 'channelId',
      label: $t('device.field.channelId'),
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
  ];
}

/** 列：复选框 / name / channelId(mono) / statusName(CellTag) / createTime / 操作(liveStart+edit+delete)。 */
export function useColumns<T = DeviceApi.DeviceChannelVO>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();

  return [
    { type: 'checkbox', width: 44, fixed: 'left' },
    {
      field: 'name',
      title: $t('device.field.name'),
      minWidth: 180,
      className: 'device-cell-name',
    },
    {
      field: 'channelId',
      title: $t('device.field.channelId'),
      minWidth: 220,
      className: 'device-cell-mono',
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
      field: 'createTime',
      title: $t('device.field.createTime'),
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
            code: 'liveStart',
            text: $t('device.action.live'),
            show: () => hasAccessByCodes(['Device:Cmd:Live']),
          },
          {
            code: 'edit',
            text: $t('device.action.edit'),
            show: () => hasAccessByCodes(['Device:Channel:Edit']),
          },
          {
            code: 'delete',
            danger: true,
            text: $t('device.action.delete'),
            show: () => hasAccessByCodes(['Device:Channel:Delete']),
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
