<script lang="ts" setup>
import type { StreamProxyApi } from '#/api/media/stream-proxy';

import { computed, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import {
  createStreamProxyBusiness,
  updateStreamProxyBusiness,
} from '#/api/media/stream-proxy';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

interface Props {
  formData?: StreamProxyApi.StreamProxyVO;
}

interface Emits {
  (e: 'success'): void;
}

defineProps<Props>();

const emit = defineEmits<Emits>();

const localFormData = ref<StreamProxyApi.StreamProxyVO>(
  {} as StreamProxyApi.StreamProxyVO,
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
      const data = drawerApi.getData<StreamProxyApi.StreamProxyVO>();
      if (data) {
        localFormData.value = data;
        isEditMode.value = !!data.id;

        // 根据编辑模式设置schema
        formApi.setState({ schema: useFormSchema(isEditMode.value) });

        // 处理编辑模式的数据映射
        if (data.id) {
          // 从 extendObj 或 extend 字段中提取扩展配置
          let extendData: Partial<StreamProxyApi.StreamProxyExtendReq> = {};
          let showAdvanced = false;

          if (data.extendObj && typeof data.extendObj === 'object') {
            extendData = data.extendObj;
            // console.log('extendData:', extendData);
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
            streamProxyExtendReq: {
              // schema回显：优先从extendObj中获取，其次从直接字段，最后使用默认值
              schema: extendData.schema || data.schema || 'rtsp',
              vhost: extendData.vhost || '__defaultVhost__',
              retryCount: extendData.retryCount ?? data.retryCount ?? -1,
              rtpType: extendData.rtpType ?? data.rtpType ?? 0,
              timeoutSec: extendData.timeoutSec ?? data.timeoutSec ?? 10,
              enableHls: extendData.enableHls ?? data.enableHls ?? true,
              enableHlsFmp4:
                extendData.enableHlsFmp4 ?? data.enableHlsFmp4 ?? false,
              enableMp4: extendData.enableMp4 ?? data.enableMp4 ?? false,
              enableRtsp: extendData.enableRtsp ?? data.enableRtsp ?? true,
              enableRtmp: extendData.enableRtmp ?? data.enableRtmp ?? true,
              enableTs: extendData.enableTs ?? data.enableTs ?? false,
              enableFmp4: extendData.enableFmp4 ?? data.enableFmp4 ?? false,
              hlsDemand: extendData.hlsDemand ?? data.hlsDemand ?? false,
              rtspDemand: extendData.rtspDemand ?? data.rtspDemand ?? false,
              rtmpDemand: extendData.rtmpDemand ?? data.rtmpDemand ?? false,
              tsDemand: extendData.tsDemand ?? data.tsDemand ?? false,
              fmp4Demand: extendData.fmp4Demand ?? data.fmp4Demand ?? false,
              enableAudio: extendData.enableAudio ?? data.enableAudio ?? true,
              addMuteAudio:
                extendData.addMuteAudio ?? data.addMuteAudio ?? false,
              mp4SavePath: extendData.mp4SavePath ?? data.mp4SavePath,
              mp4MaxSecond: extendData.mp4MaxSecond ?? data.mp4MaxSecond ?? 300,
              mp4AsPlayer: extendData.mp4AsPlayer ?? data.mp4AsPlayer ?? false,
              hlsSavePath: extendData.hlsSavePath ?? data.hlsSavePath,
              modifyStamp: extendData.modifyStamp ?? data.modifyStamp ?? 0,
              autoClose: extendData.autoClose ?? data.autoClose ?? false,
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
        localFormData.value = {} as StreamProxyApi.StreamProxyVO;
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
      const data: Partial<
        StreamProxyApi.StreamProxyCreateReq &
          StreamProxyApi.StreamProxyUpdateReq
      > = {
        ...formValues,
        // 如果是编辑模式且高级选项被展开，将扩展配置序列化到extend字段
        ...(localFormData.value?.id && formValues.showAdvanced
          ? {
              extend: JSON.stringify(formValues.streamProxyExtendReq),
            }
          : {}),
      };

      await (localFormData.value?.id
        ? updateStreamProxyBusiness(
            {
              id: localFormData.value.id!,
              ...data,
            } as StreamProxyApi.StreamProxyUpdateReq,
            '更新拉流代理',
          )
        : createStreamProxyBusiness(
            data as StreamProxyApi.StreamProxyCreateReq,
          ));
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}

const getDrawerTitle = computed(() =>
  localFormData.value?.id
    ? $t('ui.actionTitle.edit', [$t('media.streamProxy.name')])
    : $t('ui.actionTitle.create', [$t('media.streamProxy.name')]),
);

// 暴露抽屉API供父组件使用
defineExpose({
  open: (data?: StreamProxyApi.StreamProxyVO) => {
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
