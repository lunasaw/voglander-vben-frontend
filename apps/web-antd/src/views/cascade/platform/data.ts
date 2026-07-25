import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CascadePlatformApi } from '#/api/cascade/platform';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

/** 注册状态 Tag 选项（在线绿/离线灰/注册中蓝/失败红）。 */
const REGISTER_STATUS_OPTIONS = [
  {
    label: $t('cascade.platform.registerStatus.offline'),
    value: 0,
    type: 'default',
  },
  {
    label: $t('cascade.platform.registerStatus.online'),
    value: 1,
    type: 'success',
  },
  {
    label: $t('cascade.platform.registerStatus.registering'),
    value: 2,
    type: 'processing',
  },
  {
    label: $t('cascade.platform.registerStatus.failed'),
    value: 3,
    type: 'error',
  },
];

/**
 * 平台管理表单 Schema（新增/编辑）
 */
export function usePlatformFormSchema(isEditMode = false): VbenFormSchema[] {
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
    // 平台ID（编辑不可改）
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.platformId'),
        disabled: isEditMode,
      },
      fieldName: 'platformId',
      label: $t('cascade.platform.field.platformId'),
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    // 上级平台 IP 和端口
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.platformIp'),
      },
      fieldName: 'platformIp',
      label: $t('cascade.platform.field.platformIp'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.platformPort'),
        min: 1,
        max: 65_535,
        precision: 0,
      },
      fieldName: 'platformPort',
      label: $t('cascade.platform.field.platformPort'),
      rules: 'required',
      defaultValue: isEditMode ? undefined : 5060,
    },
    // 上级平台域（占满整行）
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.platformDomain'),
      },
      fieldName: 'platformDomain',
      label: $t('cascade.platform.field.platformDomain'),
      formItemClass: 'col-span-2',
    },
    // 本端客户端ID 和 本端 IP
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.localClientId'),
      },
      fieldName: 'localClientId',
      label: $t('cascade.platform.field.localClientId'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.localIp'),
      },
      fieldName: 'localIp',
      label: $t('cascade.platform.field.localIp'),
    },
    // 本端端口 和 传输协议
    {
      component: 'InputNumber',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.localPort'),
        min: 1,
        max: 65_535,
        precision: 0,
      },
      fieldName: 'localPort',
      label: $t('cascade.platform.field.localPort'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('cascade.platform.transport.udp'), value: 'UDP' },
          { label: $t('cascade.platform.transport.tcp'), value: 'TCP' },
        ],
      },
      fieldName: 'transport',
      label: $t('cascade.platform.field.transport'),
      defaultValue: isEditMode ? undefined : 'UDP',
    },
    // 认证用户名 和 密码
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.username'),
      },
      fieldName: 'username',
      label: $t('cascade.platform.field.username'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.password'),
        type: 'password',
      },
      fieldName: 'password',
      label: $t('cascade.platform.field.password'),
    },
    // 注册有效期 和 心跳间隔
    {
      component: 'InputNumber',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.registerExpires'),
        min: 60,
        max: 7200,
        precision: 0,
      },
      fieldName: 'registerExpires',
      label: $t('cascade.platform.field.registerExpires'),
      defaultValue: isEditMode ? undefined : 3600,
    },
    {
      component: 'InputNumber',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.keepaliveInterval'),
        min: 10,
        max: 300,
        precision: 0,
      },
      fieldName: 'keepaliveInterval',
      label: $t('cascade.platform.field.keepaliveInterval'),
      defaultValue: isEditMode ? undefined : 60,
    },
    // 编码（占满整行）
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: 'GB2312', value: 'GB2312' },
          // eslint-disable-next-line unicorn/text-encoding-identifier-case -- GB28181 charset 业务值，须与协议/后端一致
          { label: 'UTF-8', value: 'UTF-8' },
        ],
      },
      fieldName: 'charset',
      label: $t('cascade.platform.field.charset'),
      formItemClass: 'col-span-2',
    },
  ];
}

/**
 * 顶部筛选条件 Schema
 */
export function usePlatformGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.platformId'),
      },
      fieldName: 'platformId',
      label: $t('cascade.platform.field.platformId'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.platformIp'),
      },
      fieldName: 'platformIp',
      label: $t('cascade.platform.field.platformIp'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('cascade.platform.enabled.enabled'), value: 1 },
          { label: $t('cascade.platform.enabled.disabled'), value: 0 },
        ],
      },
      fieldName: 'enabled',
      label: $t('cascade.platform.field.enabled'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: REGISTER_STATUS_OPTIONS.map((o) => ({
          label: o.label,
          value: o.value,
        })),
      },
      fieldName: 'registerStatus',
      label: $t('cascade.platform.field.registerStatus'),
    },
  ];
}

/**
 * 表格列定义
 */
export function usePlatformColumns<T = CascadePlatformApi.CascadePlatformVO>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();

  return [
    {
      field: 'platformId',
      title: $t('cascade.platform.field.platformId'),
      width: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'platformIp',
      title: $t('cascade.platform.field.platformIp'),
      width: 140,
    },
    {
      field: 'platformPort',
      title: $t('cascade.platform.field.platformPort'),
      width: 100,
      align: 'center',
    },
    {
      field: 'localClientId',
      title: $t('cascade.platform.field.localClientId'),
      width: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'transport',
      title: $t('cascade.platform.field.transport'),
      width: 100,
      align: 'center',
      cellRender: {
        name: 'CellTag',
        options: [
          {
            label: $t('cascade.platform.transport.udp'),
            value: 'UDP',
            type: 'primary',
          },
          {
            label: $t('cascade.platform.transport.tcp'),
            value: 'TCP',
            type: 'success',
          },
        ],
      },
    },
    {
      field: 'enabled',
      title: $t('cascade.platform.field.enabled'),
      width: 100,
      align: 'center',
      cellRender: {
        attrs: {
          beforeChange: onStatusChange,
          disabled: () => !hasAccessByCodes(['Cascade:Platform:Status']),
        },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
        props: onStatusChange
          ? { checkedValue: 1, unCheckedValue: 0 }
          : undefined,
        options: onStatusChange
          ? undefined
          : [
              {
                label: $t('cascade.platform.enabled.enabled'),
                value: 1,
                type: 'success',
              },
              {
                label: $t('cascade.platform.enabled.disabled'),
                value: 0,
                type: 'error',
              },
            ],
      },
    },
    {
      field: 'registerStatus',
      title: $t('cascade.platform.field.registerStatus'),
      width: 110,
      align: 'center',
      cellRender: {
        name: 'CellTag',
        options: REGISTER_STATUS_OPTIONS,
      },
    },
    {
      field: 'createTime',
      title: $t('cascade.platform.field.createTime'),
      width: 170,
      formatter: 'formatDateTime',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'platformId',
          nameTitle: $t('cascade.platform.field.platformId'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'edit',
            text: $t('common.edit'),
            show: () => hasAccessByCodes(['Cascade:Platform:Edit']),
          },
          {
            code: 'subscribe',
            text: $t('cascade.subscribe.action.view'),
            show: () => hasAccessByCodes(['Cascade:Platform:List']),
          },
          {
            code: 'delete',
            danger: true,
            text: $t('common.delete'),
            show: () => hasAccessByCodes(['Cascade:Platform:Delete']),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('cascade.platform.field.operation'),
      width: 220,
    },
  ];
}
