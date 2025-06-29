import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api';

import { useAccess } from '@vben/access';
import { $t } from '#/locales';
import { getRoleList } from '#/api';
import { z } from '#/adapter/form';

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
      rules: z.string().email('请输入正确的邮箱').optional().or(z.literal('')),
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
      component: 'ApiSelect',
      componentProps: {
        // 角色接口转options格式
        afterFetch: (data: any) => {
          // 从 data.items 中提取数组数据
          const items = data?.items || [];
          return items.map((item: any) => ({
            label: item.name,
            value: item.id,
          }));
        },
        // 角色接口
        api: getRoleList,
        allowClear: true,
        // 自定义过滤函数，支持按角色名称搜索
        filterOption: (input: string, option: any) => {
          if (!input || input.length === 0) {
            return true;
          }
          const label = option.label || '';
          return label.toLowerCase().includes(input.toLowerCase());
        },
        // 支持多选
        mode: 'multiple',
        placeholder: '请选择角色',
        showSearch: true,
        // 搜索时的提示
        notFoundContent: '暂无数据',
        // 最多显示的选中项数量，超过后会显示省略
        maxTagCount: 5,
        // 搜索参数
        params: {},
        // 设置选择框宽度，确保与其他输入框保持一致
        style: { width: '100%' },
      },
      fieldName: 'roleIds',
      label: $t('system.role.name'),
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
      rules: z.string().email('请输入正确的邮箱').optional().or(z.literal('')),
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
      component: 'ApiSelect',
      componentProps: {
        // 角色接口转options格式
        afterFetch: (data: any) => {
          // 从 data.items 中提取数组数据
          const items = data?.items || [];
          return items.map((item: any) => ({
            label: item.name,
            value: item.id,
          }));
        },
        // 角色接口
        api: getRoleList,
        allowClear: true,
        // 自定义过滤函数，支持按角色名称搜索
        filterOption: (input: string, option: any) => {
          if (!input || input.length === 0) {
            return true;
          }
          const label = option.label || '';
          return label.toLowerCase().includes(input.toLowerCase());
        },
        // 支持多选
        mode: 'multiple',
        placeholder: '请选择角色',
        showSearch: true,
        // 搜索时的提示
        notFoundContent: '暂无数据',
        // 最多显示的选中项数量，超过后会显示省略
        maxTagCount: 3,
        // 搜索参数
        params: {},
        // 设置选择框宽度，确保与其他输入框保持一致
        style: { width: '100%' },
      },
      fieldName: 'roleIds',
      label: $t('system.role.name'),
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
  const { hasAccessByCodes } = useAccess();

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
      field: 'roles',
      title: $t('system.role.name'),
      width: 150,
      align: 'center',
      slots: { default: 'roles' },
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
        options: [
          {
            code: 'edit',
            text: $t('common.edit'),
            show: () => hasAccessByCodes(['System:User:Edit']),
          },
          'delete',
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.user.operation'),
      width: 130,
    },
  ];
}
