import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MediaNodeApi } from '#/api/media/medianode';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

/**
 * 判断节点是否在线
 * @param keepalive 最后活跃时间（字符串或数字）
 * @returns 是否在线
 */
export function isNodeOnline(keepalive?: number | string): boolean {
  if (!keepalive) return false;

  // 如果是数字，直接使用；如果是字符串，转换为数字
  const keepaliveTime =
    typeof keepalive === 'number' ? keepalive : new Date(keepalive).getTime();
  const currentTime = Date.now();
  const diffMinutes = (currentTime - keepaliveTime) / (1000 * 60);

  return diffMinutes < 5;
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点ID',
      },
      fieldName: 'serverId',
      label: $t('media.node.serverId'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点名称',
      },
      fieldName: 'name',
      label: $t('media.node.name'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点地址',
      },
      fieldName: 'host',
      label: $t('media.node.host'),
      rules: 'required',
    },
    {
      component: 'InputPassword',
      componentProps: {
        placeholder: '请输入API密钥',
      },
      fieldName: 'secret',
      label: $t('media.node.secret'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 1000,
        placeholder: '请输入节点权重',
      },
      fieldName: 'weight',
      label: $t('media.node.weight'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入节点描述',
        rows: 3,
      },
      fieldName: 'description',
      label: $t('media.node.description'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入扩展字段',
        rows: 2,
      },
      fieldName: 'extend',
      label: $t('media.node.extend'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: true },
          { label: $t('common.disabled'), value: false },
        ],
        optionType: 'button',
      },
      defaultValue: true,
      fieldName: 'enabled',
      label: $t('media.node.enabled'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: true },
          { label: $t('common.disabled'), value: false },
        ],
        optionType: 'button',
      },
      defaultValue: false,
      fieldName: 'hookEnabled',
      label: $t('media.node.hookEnabled'),
      rules: 'required',
    },
  ];
}

export function useEditFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '节点ID不可修改',
      },
      fieldName: 'serverId',
      label: $t('media.node.serverId'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点名称',
      },
      fieldName: 'name',
      label: $t('media.node.name'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点地址',
      },
      fieldName: 'host',
      label: $t('media.node.host'),
      rules: 'required',
    },
    {
      component: 'InputPassword',
      componentProps: {
        placeholder: '请输入API密钥',
      },
      fieldName: 'secret',
      label: $t('media.node.secret'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 1000,
        placeholder: '请输入节点权重',
      },
      fieldName: 'weight',
      label: $t('media.node.weight'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入节点描述',
        rows: 3,
      },
      fieldName: 'description',
      label: $t('media.node.description'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入扩展字段',
        rows: 2,
      },
      fieldName: 'extend',
      label: $t('media.node.extend'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: true },
          { label: $t('common.disabled'), value: false },
        ],
        optionType: 'button',
      },
      defaultValue: true,
      fieldName: 'enabled',
      label: $t('media.node.enabled'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: true },
          { label: $t('common.disabled'), value: false },
        ],
        optionType: 'button',
      },
      defaultValue: false,
      fieldName: 'hookEnabled',
      label: $t('media.node.hookEnabled'),
      rules: 'required',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点ID',
      },
      fieldName: 'serverId',
      label: $t('media.node.serverId'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点名称',
      },
      fieldName: 'name',
      label: $t('media.node.name'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点地址',
      },
      fieldName: 'host',
      label: $t('media.node.host'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: true },
          { label: $t('common.disabled'), value: false },
        ],
        placeholder: '请选择启用状态',
      },
      fieldName: 'enabled',
      label: $t('media.node.enabled'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('media.node.statusOnline'), value: 1 },
          { label: $t('media.node.statusOffline'), value: 0 },
        ],
        placeholder: '请选择节点状态',
      },
      fieldName: 'status',
      label: $t('media.node.status'),
    },
  ];
}

export function useColumns<T = MediaNodeApi.MediaNodeVO>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
  onEnabledChange?: (
    newEnabled: boolean,
    row: T,
  ) => PromiseLike<boolean | undefined>,
  onHookEnabledChange?: (
    newHookEnabled: boolean,
    row: T,
  ) => PromiseLike<boolean | undefined>,
  onServerIdClick?: (row: T) => void,
): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();

  return [
    {
      field: 'id',
      title: $t('media.node.id'),
      width: 80,
    },
    {
      field: 'serverId',
      title: $t('media.node.serverId'),
      width: 120,
      slots: onServerIdClick ? { default: 'serverId' } : undefined,
    },
    {
      field: 'name',
      title: $t('media.node.name'),
      width: 150,
    },
    {
      field: 'host',
      title: $t('media.node.host'),
      width: 200,
    },
    {
      field: 'weight',
      title: $t('media.node.weight'),
      width: 80,
      align: 'center',
    },
    {
      cellRender: {
        attrs: {
          beforeChange: onEnabledChange,
          disabled: () => !hasAccessByCodes(['Media:Node:Edit']),
        },
        name: onEnabledChange ? 'CellSwitch' : 'CellTag',
        props: onEnabledChange
          ? {
              checkedValue: true,
              unCheckedValue: false,
            }
          : undefined,
        options: onEnabledChange
          ? undefined
          : [
              { label: $t('common.enabled'), value: true, type: 'success' },
              { label: $t('common.disabled'), value: false, type: 'error' },
            ],
      },
      field: 'enabled',
      title: $t('media.node.enabled'),
      width: 100,
      align: 'center',
    },
    {
      cellRender: {
        attrs: {
          beforeChange: onHookEnabledChange,
          disabled: () => !hasAccessByCodes(['Media:Node:Edit']),
        },
        name: onHookEnabledChange ? 'CellSwitch' : 'CellTag',
        props: onHookEnabledChange
          ? {
              checkedValue: true,
              unCheckedValue: false,
            }
          : undefined,
        options: onHookEnabledChange
          ? undefined
          : [
              { label: $t('common.enabled'), value: true, type: 'success' },
              { label: $t('common.disabled'), value: false, type: 'error' },
            ],
      },
      field: 'hookEnabled',
      title: $t('media.node.hookEnabled'),
      width: 100,
      align: 'center',
    },
    {
      field: 'onlineStatus', // 使用虚拟字段名
      title: $t('media.node.status'),
      width: 100,
      align: 'center',
      slots: { default: 'onlineStatus' }, // 使用模板插槽
    },
    {
      field: 'description',
      title: $t('media.node.description'),
      width: 200,
      showOverflow: 'tooltip',
    },
    {
      field: 'keepalive',
      title: $t('media.node.keepalive'),
      width: 180,
      formatter: 'formatDateTime',
    },
    {
      field: 'createTime',
      title: $t('media.node.createTime'),
      width: 180,
      formatter: 'formatDateTime',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('media.node.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'edit',
            text: $t('common.edit'),
            show: () => hasAccessByCodes(['Media:Node:Edit']),
          },
          {
            code: 'delete',
            text: $t('common.delete'),
            show: () => hasAccessByCodes(['Media:Node:Delete']),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('media.node.operation'),
      width: 130,
    },
  ];
}
