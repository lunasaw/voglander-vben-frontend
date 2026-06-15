<script lang="ts" setup>
import type { CascadeChannelApi } from '#/api/cascade/channel';

import { computed, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import { message } from 'ant-design-vue';

import {
  createCascadeChannel,
  updateCascadeChannel,
} from '#/api/cascade/channel';
import { $t } from '#/locales';

import { useChannelFormSchema } from '../data';

interface Emits {
  (e: 'success'): void;
}

const emit = defineEmits<Emits>();

const localFormData = ref<CascadeChannelApi.CascadeChannelVO>(
  {} as CascadeChannelApi.CascadeChannelVO,
);
const isEditMode = ref(false);
const platformOptions = ref<Array<{ label: string; value: string }>>([]);

const breakpoints = useBreakpoints(breakpointsTailwind);
const isHorizontal = computed(() => breakpoints.greaterOrEqual('md').value);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: useChannelFormSchema(false, []),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<
        CascadeChannelApi.CascadeChannelVO & {
          platformOptions?: Array<{ label: string; value: string }>;
        }
      >();

      // 提取平台选项
      platformOptions.value = data?.platformOptions || [];

      if (data?.id) {
        localFormData.value = data;
        isEditMode.value = true;

        // 根据编辑模式设置schema
        formApi.setState({
          schema: useChannelFormSchema(true, platformOptions.value),
        });

        // 回填表单数据
        formApi.setValues(data);
      } else {
        // 创建模式设置schema
        formApi.setState({
          schema: useChannelFormSchema(false, platformOptions.value),
        });
        formApi.resetForm();
        localFormData.value = {} as CascadeChannelApi.CascadeChannelVO;
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

      if (localFormData.value?.id) {
        // 编辑模式
        await updateCascadeChannel(localFormData.value.id, {
          id: localFormData.value.id,
          ...formValues,
        } as CascadeChannelApi.ChannelUpdateReq);
        message.success($t('device.msg.updateSuccess'));
      } else {
        // 新增模式
        await createCascadeChannel(
          formValues as CascadeChannelApi.ChannelCreateReq,
        );
        message.success(
          $t('ui.actionMessage.createSuccess', [$t('cascade.channel.name')]),
        );
      }

      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}

const getDrawerTitle = computed(() =>
  localFormData.value?.id
    ? $t('cascade.channel.edit')
    : $t('cascade.channel.add'),
);
</script>

<template>
  <Drawer class="w-full max-w-[700px]" :title="getDrawerTitle">
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
