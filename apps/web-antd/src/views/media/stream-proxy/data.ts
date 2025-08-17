import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { StreamProxyApi } from '#/api/media/stream-proxy';

import { useAccess } from '@vben/access';

import { $t } from '#/locales';

export function useFormSchema(isEditMode = false): VbenFormSchema[] {
  // 编辑模式时不使用默认值，创建模式时使用默认值
  const getDefaultValue = (defaultVal: any) =>
    isEditMode ? undefined : defaultVal;

  return [
    // 第一行：应用名称和流ID
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入应用名称，如：live',
      },
      fieldName: 'app',
      label: $t('media.streamProxy.app'),
      rules: 'required',
      help: '应用名称用于组织和管理不同类型的流',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入流ID，如：test_stream',
      },
      fieldName: 'stream',
      label: $t('media.streamProxy.stream'),
      rules: 'required',
      help: '唯一标识此拉流代理的流ID',
    },

    // 第二行：拉流地址（占满整行）
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入拉流地址，如：rtsp://example.com/stream',
      },
      fieldName: 'url',
      label: $t('media.streamProxy.url'),
      rules: 'required',
      help: '支持 RTSP、RTMP、HTTP 等协议的流媒体地址',
      formItemClass: 'col-span-2',
    },

    // 第三行：拉流类型选择（占满整行）
    {
      component: 'Select',
      componentProps: {
        placeholder: '请选择拉流类型',
        options: [
          { label: 'RTSP', value: 'rtsp' },
          { label: 'RTMP', value: 'rtmp' },
          { label: 'HLS', value: 'hls' },
        ],
      },
      fieldName: 'streamProxyExtendReq.schema',
      label: $t('media.streamProxy.schema'),
      rules: 'required',
      defaultValue: getDefaultValue('rtsp'),
      formItemClass: 'col-span-2',
      help: '指定拉流的协议类型，影响流媒体处理方式',
    },

    // 第四行：节点选择和虚拟主机
    {
      component: 'NodeSelector',
      componentProps: {
        placeholder: '请选择在线节点',
        showContainer: false,
        class: 'w-full',
      },
      fieldName: 'serverId',
      label: $t('media.streamProxy.serverId'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入虚拟主机',
      },
      fieldName: 'streamProxyExtendReq.vhost',
      label: $t('media.streamProxy.vhost'),
      rules: 'required',
      defaultValue: getDefaultValue('__defaultVhost__'),
    },

    // 第五行：状态选择（占满整行）
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
      defaultValue: getDefaultValue(1),
      fieldName: 'status',
      label: $t('media.streamProxy.status'),
      rules: 'required',
      formItemClass: 'col-span-2',
    },

    // 第六行：描述（占满整行）
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入代理描述',
        rows: isEditMode ? 5 : 3,
      },
      fieldName: 'description',
      label: $t('media.streamProxy.description'),
      rules: 'required',
      formItemClass: 'col-span-2',
    },

    // 扩展配置区域 - 可展开收缩
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      defaultValue: getDefaultValue(false),
      fieldName: 'showAdvanced',
      label: $t('media.streamProxy.advancedSettings'),
      formItemClass: 'col-span-2',
    },

    // RTSP配置和重试次数
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
      fieldName: 'streamProxyExtendReq.rtpType',
      label: $t('media.streamProxy.rtpType'),
      defaultValue: getDefaultValue(0),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: -1,
        max: 999,
        placeholder: '请输入重试次数',
      },
      fieldName: 'streamProxyExtendReq.retryCount',
      label: $t('media.streamProxy.retryCount'),
      defaultValue: getDefaultValue(-1),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },

    // 超时时间（占满整行）
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 300,
        placeholder: '请输入超时时间',
      },
      fieldName: 'streamProxyExtendReq.timeoutSec',
      label: $t('media.streamProxy.timeoutSec'),
      defaultValue: getDefaultValue(10),
      formItemClass: 'col-span-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },

    // 协议支持配置 - 两列布局
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.enableHls',
      label: $t('media.streamProxy.enableHls'),
      defaultValue: getDefaultValue(true),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.enableHlsFmp4',
      label: $t('media.streamProxy.enableHlsFmp4'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.enableMp4',
      label: $t('media.streamProxy.enableMp4'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.enableRtsp',
      label: $t('media.streamProxy.enableRtsp'),
      defaultValue: getDefaultValue(true),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.enableRtmp',
      label: $t('media.streamProxy.enableRtmp'),
      defaultValue: getDefaultValue(true),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.enableTs',
      label: $t('media.streamProxy.enableTs'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.enableFmp4',
      label: $t('media.streamProxy.enableFmp4'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.enableAudio',
      label: $t('media.streamProxy.enableAudio'),
      defaultValue: getDefaultValue(true),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.addMuteAudio',
      label: $t('media.streamProxy.addMuteAudio'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.hlsDemand',
      label: $t('media.streamProxy.hlsDemand'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.rtspDemand',
      label: $t('media.streamProxy.rtspDemand'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.rtmpDemand',
      label: $t('media.streamProxy.rtmpDemand'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.tsDemand',
      label: $t('media.streamProxy.tsDemand'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.fmp4Demand',
      label: $t('media.streamProxy.fmp4Demand'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.autoClose',
      label: $t('media.streamProxy.autoClose'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入MP4保存路径',
      },
      fieldName: 'streamProxyExtendReq.mp4SavePath',
      label: $t('media.streamProxy.mp4SavePath'),
      formItemClass: 'col-span-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 3600,
        placeholder: '请输入MP4切片大小',
      },
      fieldName: 'streamProxyExtendReq.mp4MaxSecond',
      label: $t('media.streamProxy.mp4MaxSecond'),
      defaultValue: getDefaultValue(300),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'streamProxyExtendReq.mp4AsPlayer',
      label: $t('media.streamProxy.mp4AsPlayer'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入HLS保存路径',
      },
      fieldName: 'streamProxyExtendReq.hlsSavePath',
      label: $t('media.streamProxy.hlsSavePath'),
      formItemClass: 'col-span-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'Select',
      componentProps: {
        placeholder: '请选择时间戳模式',
        options: [
          { label: '绝对时间戳', value: 0 },
          { label: '系统时间戳', value: 1 },
          { label: '相对时间戳', value: 2 },
        ],
      },
      fieldName: 'streamProxyExtendReq.modifyStamp',
      label: $t('media.streamProxy.modifyStamp'),
      defaultValue: getDefaultValue(0),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
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
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: 'RTSP', value: 'rtsp' },
          { label: 'RTMP', value: 'rtmp' },
          { label: 'HLS', value: 'hls' },
        ],
        placeholder: '请选择拉流类型',
      },
      fieldName: 'schema',
      label: $t('media.streamProxy.schema'),
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
      cellRender: {
        name: 'CellTag',
        options: [
          { label: 'RTSP', value: 'rtsp', type: 'primary' },
          { label: 'RTMP', value: 'rtmp', type: 'success' },
          { label: 'HLS', value: 'hls', type: 'warning' },
        ],
      },
      field: 'schema',
      title: $t('media.streamProxy.schema'),
      width: 100,
      align: 'center',
      formatter: ({ row }) => {
        // 优先从extendObj中获取schema，如果没有则使用直接字段，默认为rtsp
        return row.extendObj?.schema || row.schema || 'rtsp';
      },
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
      formatter: ({ row }) => {
        // 优先从extendObj中获取vhost，如果没有则使用直接字段
        return row.extendObj?.vhost || row.vhost || '__defaultVhost__';
      },
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
            code: 'play',
            text: $t('media.streamProxy.play'),
            show: () => hasAccessByCodes(['Media:StreamProxy:Play']),
          },
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
      width: 220,
    },
  ];
}
