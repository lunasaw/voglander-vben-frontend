import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PushProxyApi } from '#/api/media/push-proxy';

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
      label: $t('media.pushProxy.app'),
      rules: 'required',
      help: '应用名称用于组织和管理不同类型的流',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入流ID，如：test_stream',
      },
      fieldName: 'stream',
      label: $t('media.pushProxy.stream'),
      rules: 'required',
      help: '唯一标识此推流代理的流ID',
    },

    // 第二行：推流地址（占满整行）
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入推流地址，如：rtmp://push.example.com/live/test',
      },
      fieldName: 'dstUrl',
      label: $t('media.pushProxy.dstUrl'),
      rules: 'required',
      help: '支持 RTMP、RTSP、HTTP 等协议的推流目标地址',
      formItemClass: 'col-span-2',
    },

    // 第三行：节点选择和推流协议
    {
      component: 'NodeSelector',
      componentProps: {
        placeholder: '请选择在线节点',
        showContainer: false,
        class: 'w-full',
      },
      fieldName: 'serverId',
      label: $t('media.pushProxy.serverId'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        placeholder: '请选择推流协议',
        options: [
          { label: 'RTMP', value: 'rtmp' },
          { label: 'RTSP', value: 'rtsp' },
          { label: 'HTTP', value: 'http' },
          { label: 'HTTPS', value: 'https' },
        ],
      },
      fieldName: 'schema',
      label: $t('media.pushProxy.schema'),
      defaultValue: getDefaultValue('rtmp'),
    },

    // 第四行：状态选择（占满整行）
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
      label: $t('media.pushProxy.status'),
      rules: 'required',
      formItemClass: 'col-span-2',
    },

    // 第五行：描述（占满整行）
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入代理描述',
        rows: isEditMode ? 5 : 3,
      },
      fieldName: 'description',
      label: $t('media.pushProxy.description'),
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
      label: $t('media.pushProxy.advancedSettings'),
      formItemClass: 'col-span-2',
    },

    // 虚拟主机和重试次数
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入虚拟主机',
      },
      fieldName: 'vhost',
      label: $t('media.pushProxy.vhost'),
      defaultValue: getDefaultValue('__defaultVhost__'),
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
      fieldName: 'retryCount',
      label: $t('media.pushProxy.retryCount'),
      defaultValue: getDefaultValue(-1),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },

    // RTSP配置
    {
      component: 'Select',
      componentProps: {
        placeholder: '请选择RTSP推流方式',
        options: [
          { label: 'TCP', value: 0 },
          { label: 'UDP', value: 1 },
        ],
      },
      fieldName: 'rtpType',
      label: $t('media.pushProxy.rtpType'),
      defaultValue: getDefaultValue(0),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 300,
        placeholder: '请输入超时时间',
      },
      fieldName: 'timeoutSec',
      label: $t('media.pushProxy.timeoutSec'),
      defaultValue: getDefaultValue(10),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },

    // 自动重连配置
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'autoReconnect',
      label: $t('media.pushProxy.autoReconnect'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 300,
        placeholder: '请输入重试间隔',
      },
      fieldName: 'retryInterval',
      label: $t('media.pushProxy.retryInterval'),
      defaultValue: getDefaultValue(5),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },

    // 监控配置
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'enableMonitor',
      label: $t('media.pushProxy.enableMonitor'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0.1,
        max: 1,
        step: 0.1,
        placeholder: '请输入质量阈值',
      },
      fieldName: 'qualityThreshold',
      label: $t('media.pushProxy.qualityThreshold'),
      defaultValue: getDefaultValue(0.8),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },

    // 码率控制
    {
      component: 'InputNumber',
      componentProps: {
        min: 100,
        max: 50_000,
        placeholder: '请输入最大码率',
      },
      fieldName: 'maxBitrate',
      label: $t('media.pushProxy.maxBitrate'),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 100,
        max: 10_000,
        placeholder: '请输入最小码率',
      },
      fieldName: 'minBitrate',
      label: $t('media.pushProxy.minBitrate'),
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },

    // 认证配置
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'enableAuth',
      label: $t('media.pushProxy.enableAuth'),
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
        placeholder: '请输入认证用户名',
      },
      fieldName: 'authUser',
      label: $t('media.pushProxy.authUser'),
      rules: 'required',
      dependencies: {
        show: (values) => !!values.showAdvanced && !!values.enableAuth,
        triggerFields: ['showAdvanced', 'enableAuth'],
      },
    },

    {
      component: 'InputPassword',
      componentProps: {
        placeholder: '请输入认证密码',
      },
      fieldName: 'authPassword',
      label: $t('media.pushProxy.authPassword'),
      rules: 'required',
      formItemClass: 'col-span-2',
      dependencies: {
        show: (values) => !!values.showAdvanced && !!values.enableAuth,
        triggerFields: ['showAdvanced', 'enableAuth'],
      },
    },

    // 自动停止配置
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'autoStop',
      label: $t('media.pushProxy.autoStop'),
      defaultValue: getDefaultValue(false),
      labelClass: 'whitespace-normal break-words text-sm flex-1',
      formItemClass: 'flex items-center justify-between py-2',
      dependencies: {
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 30,
        max: 3600,
        placeholder: '请输入自动停止延时',
      },
      fieldName: 'autoStopDelay',
      label: $t('media.pushProxy.autoStopDelay'),
      defaultValue: getDefaultValue(300),
      dependencies: {
        show: (values) => !!values.showAdvanced && !!values.autoStop,
        triggerFields: ['showAdvanced', 'autoStop'],
      },
    },

    // 优先级和加密
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 10,
        placeholder: '请输入推流优先级',
      },
      fieldName: 'priority',
      label: $t('media.pushProxy.priority'),
      defaultValue: getDefaultValue(1),
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
      fieldName: 'enableEncrypt',
      label: $t('media.pushProxy.enableEncrypt'),
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
        placeholder: '请输入加密密钥',
      },
      fieldName: 'encryptKey',
      label: $t('media.pushProxy.encryptKey'),
      formItemClass: 'col-span-2',
      dependencies: {
        show: (values) => !!values.showAdvanced && !!values.enableEncrypt,
        triggerFields: ['showAdvanced', 'enableEncrypt'],
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
      label: $t('media.pushProxy.app'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入流ID',
      },
      fieldName: 'stream',
      label: $t('media.pushProxy.stream'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入推流地址',
      },
      fieldName: 'dstUrl',
      label: $t('media.pushProxy.dstUrl'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: 'RTMP', value: 'rtmp' },
          { label: 'RTSP', value: 'rtsp' },
          { label: 'HTTP', value: 'http' },
          { label: 'HTTPS', value: 'https' },
        ],
        placeholder: '请选择推流协议',
      },
      fieldName: 'schema',
      label: $t('media.pushProxy.schema'),
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
      label: $t('media.pushProxy.status'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('media.pushProxy.onlineStatus.online'), value: 1 },
          { label: $t('media.pushProxy.onlineStatus.offline'), value: 0 },
        ],
        placeholder: '请选择在线状态',
      },
      fieldName: 'onlineStatus',
      label: $t('media.pushProxy.onlineStatus.title'),
    },
  ];
}

export function useColumns<T = PushProxyApi.PushProxyVO>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();

  return [
    {
      field: 'id',
      title: $t('media.pushProxy.id'),
      width: 80,
    },
    {
      field: 'app',
      title: $t('media.pushProxy.app'),
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'stream',
      title: $t('media.pushProxy.stream'),
      width: 150,
      showOverflow: 'tooltip',
    },
    {
      field: 'dstUrl',
      title: $t('media.pushProxy.dstUrl'),
      width: 300,
      showOverflow: 'tooltip',
    },
    {
      field: 'schema',
      title: $t('media.pushProxy.schema'),
      width: 100,
      showOverflow: 'tooltip',
    },
    {
      field: 'serverId',
      title: $t('media.pushProxy.serverId'),
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      cellRender: {
        attrs: {
          beforeChange: onStatusChange,
          disabled: () => !hasAccessByCodes(['Media:PushProxy:Edit']),
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
      title: $t('media.pushProxy.status'),
      width: 100,
      align: 'center',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          {
            label: $t('media.pushProxy.onlineStatus.online'),
            value: 1,
            type: 'success',
          },
          {
            label: $t('media.pushProxy.onlineStatus.offline'),
            value: 0,
            type: 'error',
          },
        ],
      },
      field: 'onlineStatus',
      title: $t('media.pushProxy.onlineStatus.title'),
      width: 100,
      align: 'center',
    },
    {
      field: 'description',
      title: $t('media.pushProxy.description'),
      width: 200,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: $t('media.pushProxy.createTime'),
      width: 180,
      formatter: 'formatDateTime',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'app',
          nameTitle: $t('media.pushProxy.app'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'play',
            text: $t('media.pushProxy.play'),
            show: () => hasAccessByCodes(['Media:PushProxy:View']),
          },
          {
            code: 'edit',
            text: $t('common.edit'),
            show: () => hasAccessByCodes(['Media:PushProxy:Edit']),
          },
          {
            code: 'delete',
            text: $t('common.delete'),
            show: () => hasAccessByCodes(['Media:PushProxy:Edit']),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('media.pushProxy.operation'),
      width: 220,
    },
  ];
}
