import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CascadeChannelApi } from '#/api/cascade/channel';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

/**
 * 通道映射表单 Schema（新增/编辑）
 */
export function useChannelFormSchema(
  isEditMode = false,
  platformOptions: Array<{ label: string; value: string }> = [],
): VbenFormSchema[] {
  return [
    // 隐藏字段：主键ID（编辑模式透传）
    {
      component: 'Input',
      dependencies: {
        show: () => false,
        triggerFields: ['id'],
      },
      fieldName: 'id',
      label: 'id',
    },
    // 第一行：上级平台
    {
      component: 'Select',
      componentProps: {
        placeholder: $t('cascade.channel.placeholder.platformId'),
        options: platformOptions,
        disabled: isEditMode, // 编辑模式下平台ID不可改
      },
      fieldName: 'platformId',
      label: $t('cascade.channel.field.platformId'),
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    // 第二行：本地设备ID和本地通道ID
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.channel.placeholder.localDeviceId'),
        disabled: isEditMode, // 编辑模式下本地设备ID不可改
      },
      fieldName: 'localDeviceId',
      label: $t('cascade.channel.field.localDeviceId'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.channel.placeholder.localChannelId'),
        disabled: isEditMode, // 编辑模式下本地通道ID不可改
      },
      fieldName: 'localChannelId',
      label: $t('cascade.channel.field.localChannelId'),
      rules: 'required',
    },
    // 第三行：级联通道ID（占满整行）
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.channel.placeholder.cascadeChannelId'),
      },
      fieldName: 'cascadeChannelId',
      label: $t('cascade.channel.field.cascadeChannelId'),
      rules: 'required',
      formItemClass: 'col-span-2',
      help: $t('cascade.channel.help.cascadeChannelId'),
    },
    // 第四行：级联名称（占满整行）
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.channel.placeholder.cascadeName'),
      },
      fieldName: 'cascadeName',
      label: $t('cascade.channel.field.cascadeName'),
      formItemClass: 'col-span-2',
    },
  ];
}

/**
 * 顶部筛选条件 Schema
 */
export function useChannelGridFormSchema(
  platformOptions: Array<{ label: string; value: string }> = [],
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        placeholder: $t('cascade.channel.placeholder.platformId'),
        options: platformOptions,
      },
      fieldName: 'platformId',
      label: $t('cascade.channel.field.platformId'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.channel.placeholder.localDeviceId'),
      },
      fieldName: 'localDeviceId',
      label: $t('cascade.channel.field.localDeviceId'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.channel.placeholder.localChannelId'),
      },
      fieldName: 'localChannelId',
      label: $t('cascade.channel.field.localChannelId'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.channel.placeholder.cascadeChannelId'),
      },
      fieldName: 'cascadeChannelId',
      label: $t('cascade.channel.field.cascadeChannelId'),
    },
  ];
}

/**
 * 表格列定义
 */
export function useChannelColumns<T = CascadeChannelApi.CascadeChannelVO>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();

  return [
    {
      field: 'platformId',
      title: $t('cascade.channel.field.platformId'),
      width: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'localDeviceId',
      title: $t('cascade.channel.field.localDeviceId'),
      width: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'localChannelId',
      title: $t('cascade.channel.field.localChannelId'),
      width: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'cascadeChannelId',
      title: $t('cascade.channel.field.cascadeChannelId'),
      width: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'cascadeName',
      title: $t('cascade.channel.field.cascadeName'),
      width: 150,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: $t('cascade.channel.field.createTime'),
      width: 170,
      formatter: 'formatDateTime',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'cascadeName',
          nameTitle: $t('cascade.channel.field.cascadeName'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'edit',
            text: $t('common.edit'),
            show: () => hasAccessByCodes(['Cascade:Channel:Edit']),
          },
          {
            code: 'delete',
            danger: true,
            text: $t('common.delete'),
            show: () => hasAccessByCodes(['Cascade:Channel:Delete']),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('cascade.channel.field.operation'),
      width: 180,
    },
  ];
}
