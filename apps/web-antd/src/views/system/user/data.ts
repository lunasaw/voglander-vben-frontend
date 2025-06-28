import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入用户名',
      },
      fieldName: 'username',
      label: $t('system.user.username'),
      rules: 'required',
    },
    {
      component: 'InputPassword',
      componentProps: {
        placeholder: '请输入密码',
      },
      fieldName: 'password',
      label: $t('system.user.password'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入昵称',
      },
      fieldName: 'nickname',
      label: $t('system.user.nickname'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入邮箱',
        type: 'email',
      },
      fieldName: 'email',
      label: $t('system.user.email'),
      rules: 'email',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入手机号',
      },
      fieldName: 'phone',
      label: $t('system.user.phone'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入头像URL',
      },
      fieldName: 'avatar',
      label: $t('system.user.avatar'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.user.status'),
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
        placeholder: '用户名不可修改',
      },
      fieldName: 'username',
      label: $t('system.user.username'),
    },
    {
      component: 'InputPassword',
      componentProps: {
        placeholder: '留空则不修改密码',
      },
      fieldName: 'password',
      label: $t('system.user.password'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入昵称',
      },
      fieldName: 'nickname',
      label: $t('system.user.nickname'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入邮箱',
        type: 'email',
      },
      fieldName: 'email',
      label: $t('system.user.email'),
      rules: 'email',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入手机号',
      },
      fieldName: 'phone',
      label: $t('system.user.phone'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入头像URL',
      },
      fieldName: 'avatar',
      label: $t('system.user.avatar'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.user.status'),
      rules: 'required',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入用户名',
      },
      fieldName: 'username',
      label: $t('system.user.username'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入昵称',
      },
      fieldName: 'nickname',
      label: $t('system.user.nickname'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入邮箱',
      },
      fieldName: 'email',
      label: $t('system.user.email'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入手机号',
      },
      fieldName: 'phone',
      label: $t('system.user.phone'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        placeholder: '请选择状态',
      },
      fieldName: 'status',
      label: $t('system.user.status'),
    },
  ];
}

export function useColumns<T = SystemUserApi.UserVO>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'id',
      title: $t('system.user.id'),
      width: 80,
    },
    {
      field: 'username',
      title: $t('system.user.username'),
      width: 120,
    },
    {
      field: 'nickname',
      title: $t('system.user.nickname'),
      width: 120,
    },
    {
      field: 'email',
      title: $t('system.user.email'),
      width: 180,
    },
    {
      field: 'phone',
      title: $t('system.user.phone'),
      width: 130,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.user.status'),
      width: 100,
    },
    {
      field: 'createTime',
      title: $t('system.user.createTime'),
      width: 180,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'username',
          nameTitle: $t('system.user.username'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.user.operation'),
      width: 130,
    },
  ];
}
