<script lang="ts" setup>
import type { PushProxyApi } from '#/api/media/push-proxy';

import { computed, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import {
  createPushProxyWithNode,
  updatePushProxyBusiness,
} from '#/api/media/push-proxy';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

interface Props {
  formData?: PushProxyApi.PushProxyVO;
}

interface Emits {
  (e: 'success'): void;
}

defineProps<Props>();

const emit = defineEmits<Emits>();

const localFormData = ref<PushProxyApi.PushProxyVO>(
  {} as PushProxyApi.PushProxyVO,
);
const isEditMode = ref(false);

const breakpoints = useBreakpoints(breakpointsTailwind);
const isHorizontal = computed(() => breakpoints.greaterOrEqual('md').value);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: useFormSchema(false),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<PushProxyApi.PushProxyVO>();
      if (data) {
        localFormData.value = data;
        isEditMode.value = !!data.id;

        // 根据编辑模式设置schema
        formApi.setState({ schema: useFormSchema(isEditMode.value) });

        // 处理编辑模式的数据映射
        if (data.id) {
          // 从 extendObj 或 extend 字段中提取扩展配置
          let extendData = {};
          let showAdvanced = false;

          if (data.extendObj && typeof data.extendObj === 'object') {
            extendData = data.extendObj;
            showAdvanced = true;
          } else if (data.extend && data.extend.trim()) {
            try {
              extendData = JSON.parse(data.extend);
              showAdvanced = true;
            } catch (error) {
              console.warn('解析extend字段失败:', error);
            }
          }

          // 构建完整的表单数据
          const formValues = {
            ...data,
            showAdvanced,
            // 将嵌套的扩展字段平铺到表单级别
            vhost: extendData.vhost || '__defaultVhost__',
            retryCount: extendData.retryCount ?? -1,
            rtpType: extendData.rtpType ?? 0,
            timeoutSec: extendData.timeoutSec ?? 10,
            autoReconnect: extendData.autoReconnect ?? false,
            retryInterval: extendData.retryInterval ?? 5,
            enableMonitor: extendData.enableMonitor ?? false,
            qualityThreshold: extendData.qualityThreshold ?? 0.8,
            maxBitrate: extendData.maxBitrate,
            minBitrate: extendData.minBitrate,
            enableAuth: extendData.enableAuth ?? false,
            authUser: extendData.authUser,
            authPassword: extendData.authPassword,
            autoStop: extendData.autoStop ?? false,
            autoStopDelay: extendData.autoStopDelay ?? 300,
            priority: extendData.priority ?? 1,
            enableEncrypt: extendData.enableEncrypt ?? false,
            encryptKey: extendData.encryptKey,
            // 保留原始嵌套结构用于提交
            pushProxyExtendReq: {
              vhost: extendData.vhost || '__defaultVhost__',
              retryCount: extendData.retryCount ?? -1,
              rtpType: extendData.rtpType ?? 0,
              timeoutSec: extendData.timeoutSec ?? 10,
              autoReconnect: extendData.autoReconnect ?? false,
              retryInterval: extendData.retryInterval ?? 5,
              enableMonitor: extendData.enableMonitor ?? false,
              qualityThreshold: extendData.qualityThreshold ?? 0.8,
              maxBitrate: extendData.maxBitrate,
              minBitrate: extendData.minBitrate,
              enableAuth: extendData.enableAuth ?? false,
              authUser: extendData.authUser,
              authPassword: extendData.authPassword,
              autoStop: extendData.autoStop ?? false,
              autoStopDelay: extendData.autoStopDelay ?? 300,
              priority: extendData.priority ?? 1,
              enableEncrypt: extendData.enableEncrypt ?? false,
              encryptKey: extendData.encryptKey,
            },
          };

          formApi.setValues(formValues);
        } else {
          formApi.setValues(localFormData.value);
        }
      } else {
        // 创建模式设置schema
        formApi.setState({ schema: useFormSchema(false) });
        formApi.resetForm();
        localFormData.value = {};
        isEditMode.value = false;
      }
    }
  },
});

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    drawerApi.lock();
    try {
      const formValues = await formApi.getValues();

      // 构建提交数据
      const data:
        | PushProxyApi.PushProxyCreateReq
        | PushProxyApi.PushProxyUpdateReq = {
        ...formValues,
        // 如果是编辑模式且高级选项被展开，将扩展配置序列化到pushProxyExtendReq字段
        ...(localFormData.value?.id
          ? {
              id: localFormData.value.id!,
              ...(formValues.showAdvanced
                ? {
                    pushProxyExtendReq: {
                      vhost: formValues.vhost,
                      retryCount: formValues.retryCount,
                      rtpType: formValues.rtpType,
                      timeoutSec: formValues.timeoutSec,
                      autoReconnect: formValues.autoReconnect,
                      retryInterval: formValues.retryInterval,
                      enableMonitor: formValues.enableMonitor,
                      qualityThreshold: formValues.qualityThreshold,
                      maxBitrate: formValues.maxBitrate,
                      minBitrate: formValues.minBitrate,
                      enableAuth: formValues.enableAuth,
                      authUser: formValues.authUser,
                      authPassword: formValues.authPassword,
                      autoStop: formValues.autoStop,
                      autoStopDelay: formValues.autoStopDelay,
                      priority: formValues.priority,
                      enableEncrypt: formValues.enableEncrypt,
                      encryptKey: formValues.encryptKey,
                    },
                  }
                : {}),
            }
          : {
              ...(formValues.showAdvanced
                ? {
                    pushProxyExtendReq: {
                      vhost: formValues.vhost,
                      retryCount: formValues.retryCount,
                      rtpType: formValues.rtpType,
                      timeoutSec: formValues.timeoutSec,
                      autoReconnect: formValues.autoReconnect,
                      retryInterval: formValues.retryInterval,
                      enableMonitor: formValues.enableMonitor,
                      qualityThreshold: formValues.qualityThreshold,
                      maxBitrate: formValues.maxBitrate,
                      minBitrate: formValues.minBitrate,
                      enableAuth: formValues.enableAuth,
                      authUser: formValues.authUser,
                      authPassword: formValues.authPassword,
                      autoStop: formValues.autoStop,
                      autoStopDelay: formValues.autoStopDelay,
                      priority: formValues.priority,
                      enableEncrypt: formValues.enableEncrypt,
                      encryptKey: formValues.encryptKey,
                    },
                  }
                : {}),
            }),
      };

      await (localFormData.value?.id
        ? updatePushProxyBusiness(
            data as PushProxyApi.PushProxyUpdateReq,
            '更新推流代理',
          )
        : createPushProxyWithNode(data as PushProxyApi.PushProxyCreateReq));
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}

const getDrawerTitle = computed(() =>
  localFormData.value?.id
    ? $t('ui.actionTitle.edit', [$t('media.pushProxy.name')])
    : $t('ui.actionTitle.create', [$t('media.pushProxy.name')]),
);

// 暴露抽屉API供父组件使用
defineExpose({
  open: (data?: PushProxyApi.PushProxyVO) => {
    drawerApi.setData(data || {}).open();
  },
  close: () => drawerApi.close(),
});
</script>

<template>
  <Drawer class="w-full max-w-[700px]" :title="getDrawerTitle">
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
