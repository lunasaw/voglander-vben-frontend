import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { StreamProxyApi } from '#/api/media/stream-proxy';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入应用名称',
      },
      fieldName: 'app',
      label: $t('media.streamProxy.app'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入流ID',
      },
      fieldName: 'stream',
      label: $t('media.streamProxy.stream'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入拉流地址',
      },
      fieldName: 'url',
      label: $t('media.streamProxy.url'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点ID',
      },
      fieldName: 'serverId',
      label: $t('media.streamProxy.serverId'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入虚拟主机',
      },
      fieldName: 'vhost',
      label: $t('media.streamProxy.vhost'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入代理描述',
        rows: 3,
      },
      fieldName: 'description',
      label: $t('media.streamProxy.description'),
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
      label: $t('media.streamProxy.status'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: -1,
        max: 999,
        placeholder: '请输入重试次数',
      },
      fieldName: 'retryCount',
      label: $t('media.streamProxy.retryCount'),
      defaultValue: -1,
    },
    {
      component: 'Select',
      componentProps: {
        placeholder: '请选择RTSP拉流方式',
        options: [
          { label: 'TCP', value: 0 },
          { label: 'UDP', value: 1 },
          { label: '组播', value: 2 },
        ],
      },
      fieldName: 'rtpType',
      label: $t('media.streamProxy.rtpType'),
      defaultValue: 0,
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 300,
        placeholder: '请输入超时时间',
      },
      fieldName: 'timeoutSec',
      label: $t('media.streamProxy.timeoutSec'),
      defaultValue: 10,
    },
    {
      component: 'Switch',
      fieldName: 'enableHls',
      label: $t('media.streamProxy.enableHls'),
      defaultValue: true,
    },
    {
      component: 'Switch',
      fieldName: 'enableHlsFmp4',
      label: $t('media.streamProxy.enableHlsFmp4'),
      defaultValue: false,
    },
    {
      component: 'Switch',
      fieldName: 'enableMp4',
      label: $t('media.streamProxy.enableMp4'),
      defaultValue: false,
    },
    {
      component: 'Switch',
      fieldName: 'enableRtsp',
      label: $t('media.streamProxy.enableRtsp'),
      defaultValue: true,
    },
    {
      component: 'Switch',
      fieldName: 'enableRtmp',
      label: $t('media.streamProxy.enableRtmp'),
      defaultValue: true,
    },
    {
      component: 'Switch',
      fieldName: 'enableTs',
      label: $t('media.streamProxy.enableTs'),
      defaultValue: false,
    },
    {
      component: 'Switch',
      fieldName: 'enableFmp4',
      label: $t('media.streamProxy.enableFmp4'),
      defaultValue: false,
    },
    {
      component: 'Switch',
      fieldName: 'enableAudio',
      label: $t('media.streamProxy.enableAudio'),
      defaultValue: true,
    },
  ];
}

export function useEditFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '应用名称不可修改',
      },
      fieldName: 'app',
      label: $t('media.streamProxy.app'),
    },
    {
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '流ID不可修改',
      },
      fieldName: 'stream',
      label: $t('media.streamProxy.stream'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入拉流地址',
      },
      fieldName: 'url',
      label: $t('media.streamProxy.url'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '节点ID不可修改',
      },
      fieldName: 'serverId',
      label: $t('media.streamProxy.serverId'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入代理描述',
        rows: 3,
      },
      fieldName: 'description',
      label: $t('media.streamProxy.description'),
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
      fieldName: 'status',
      label: $t('media.streamProxy.status'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入扩展字段',
        rows: 2,
      },
      fieldName: 'extend',
      label: $t('media.streamProxy.extend'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入应用名称',
      },
      fieldName: 'app',
      label: $t('media.streamProxy.app'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入流ID',
      },
      fieldName: 'stream',
      label: $t('media.streamProxy.stream'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入拉流地址',
      },
      fieldName: 'url',
      label: $t('media.streamProxy.url'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入节点ID',
      },
      fieldName: 'serverId',
      label: $t('media.streamProxy.serverId'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        placeholder: '请选择启用状态',
      },
      fieldName: 'status',
      label: $t('media.streamProxy.status'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('media.streamProxy.onlineStatus.online'), value: 1 },
          { label: $t('media.streamProxy.onlineStatus.offline'), value: 0 },
        ],
        placeholder: '请选择在线状态',
      },
      fieldName: 'onlineStatus',
      label: $t('media.streamProxy.onlineStatus.title'),
    },
  ];
}

export function useColumns<T = StreamProxyApi.StreamProxyVO>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();

  return [
    {
      field: 'id',
      title: $t('media.streamProxy.id'),
      width: 80,
    },
    {
      field: 'app',
      title: $t('media.streamProxy.app'),
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'stream',
      title: $t('media.streamProxy.stream'),
      width: 150,
      showOverflow: 'tooltip',
    },
    {
      field: 'url',
      title: $t('media.streamProxy.url'),
      width: 300,
      showOverflow: 'tooltip',
    },
    {
      field: 'serverId',
      title: $t('media.streamProxy.serverId'),
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'vhost',
      title: $t('media.streamProxy.vhost'),
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      cellRender: {
        attrs: {
          beforeChange: onStatusChange,
          disabled: () => !hasAccessByCodes(['Media:StreamProxy:Edit']),
        },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
        props: onStatusChange
          ? {
              checkedValue: 1,
              unCheckedValue: 0,
            }
          : undefined,
        options: onStatusChange
          ? undefined
          : [
              { label: $t('common.enabled'), value: 1, type: 'success' },
              { label: $t('common.disabled'), value: 0, type: 'error' },
            ],
      },
      field: 'status',
      title: $t('media.streamProxy.status'),
      width: 100,
      align: 'center',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          {
            label: $t('media.streamProxy.onlineStatus.online'),
            value: 1,
            type: 'success',
          },
          {
            label: $t('media.streamProxy.onlineStatus.offline'),
            value: 0,
            type: 'error',
          },
        ],
      },
      field: 'onlineStatus',
      title: $t('media.streamProxy.onlineStatus.title'),
      width: 100,
      align: 'center',
    },
    {
      field: 'description',
      title: $t('media.streamProxy.description'),
      width: 200,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: $t('media.streamProxy.createTime'),
      width: 180,
      formatter: 'formatDateTime',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'app',
          nameTitle: $t('media.streamProxy.app'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'edit',
            text: $t('common.edit'),
            show: () => hasAccessByCodes(['Media:StreamProxy:Edit']),
          },
          {
            code: 'delete',
            text: $t('common.delete'),
            show: () => hasAccessByCodes(['Media:StreamProxy:Delete']),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('media.streamProxy.operation'),
      width: 130,
    },
  ];
}
