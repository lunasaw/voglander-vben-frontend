import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CascadePlatformApi } from '#/api/cascade/platform';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

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
    // 第一行：平台ID和平台名称
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.platformId'),
        disabled: isEditMode, // 编辑模式下平台ID不可改
      },
      fieldName: 'platformId',
      label: $t('cascade.platform.field.platformId'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.platformName'),
      },
      fieldName: 'platformName',
      label: $t('cascade.platform.field.platformName'),
    },
    // 第二行：服务器IP和端口
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.serverIp'),
      },
      fieldName: 'serverIp',
      label: $t('cascade.platform.field.serverIp'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.serverPort'),
        min: 1,
        max: 65_535,
        precision: 0,
      },
      fieldName: 'serverPort',
      label: $t('cascade.platform.field.serverPort'),
      rules: 'required',
      defaultValue: isEditMode ? undefined : 5060,
    },
    // 第三行：服务器域名（占满整行）
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.serverDomain'),
      },
      fieldName: 'serverDomain',
      label: $t('cascade.platform.field.serverDomain'),
      formItemClass: 'col-span-2',
    },
    // 第四行：本地客户端ID和IP
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
        placeholder: $t('cascade.platform.placeholder.localClientIp'),
      },
      fieldName: 'localClientIp',
      label: $t('cascade.platform.field.localClientIp'),
    },
    // 第五行：本地客户端端口和传输协议
    {
      component: 'InputNumber',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.localClientPort'),
        min: 1,
        max: 65_535,
        precision: 0,
      },
      fieldName: 'localClientPort',
      label: $t('cascade.platform.field.localClientPort'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          {
            label: $t('cascade.platform.transport.udp'),
            value: 'UDP',
          },
          {
            label: $t('cascade.platform.transport.tcp'),
            value: 'TCP',
          },
        ],
      },
      fieldName: 'transport',
      label: $t('cascade.platform.field.transport'),
      defaultValue: isEditMode ? undefined : 'UDP',
    },
    // 第六行：认证用户名和密码
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
    // 第七行：注册有效期和心跳间隔
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
        placeholder: $t('cascade.platform.placeholder.platformName'),
      },
      fieldName: 'platformName',
      label: $t('cascade.platform.field.platformName'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('cascade.platform.placeholder.serverIp'),
      },
      fieldName: 'serverIp',
      label: $t('cascade.platform.field.serverIp'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          {
            label: $t('cascade.platform.enabled.enabled'),
            value: 1,
          },
          {
            label: $t('cascade.platform.enabled.disabled'),
            value: 0,
          },
        ],
      },
      fieldName: 'enabled',
      label: $t('cascade.platform.field.enabled'),
    },
  ];
}

/**
 * 表格列定义
 */
export function usePlatformColumns<T = CascadePlatformApi.CascadePlatformVO>(
  onActionClick: OnActionClickFn<T>,
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
      field: 'platformName',
      title: $t('cascade.platform.field.platformName'),
      width: 150,
      showOverflow: 'tooltip',
    },
    {
      field: 'serverIp',
      title: $t('cascade.platform.field.serverIp'),
      width: 140,
    },
    {
      field: 'serverPort',
      title: $t('cascade.platform.field.serverPort'),
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
        name: 'CellTag',
        options: [
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
      field: 'createTime',
      title: $t('cascade.platform.field.createTime'),
      width: 170,
      formatter: 'formatDateTime',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'platformName',
          nameTitle: $t('cascade.platform.field.platformName'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'enable',
            text: $t('cascade.platform.action.enable'),
            show: (row: any) =>
              row.enabled === 0 &&
              hasAccessByCodes(['Cascade:Platform:Status']),
          },
          {
            code: 'disable',
            text: $t('cascade.platform.action.disable'),
            show: (row: any) =>
              row.enabled === 1 &&
              hasAccessByCodes(['Cascade:Platform:Status']),
          },
          {
            code: 'edit',
            text: $t('common.edit'),
            show: () => hasAccessByCodes(['Cascade:Platform:Edit']),
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
      width: 240,
    },
  ];
}
