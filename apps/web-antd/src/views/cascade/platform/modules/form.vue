<script lang="ts" setup>
import type { CascadePlatformApi } from '#/api/cascade/platform';

import { computed, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import { message } from 'ant-design-vue';

import {
  createCascadePlatform,
  updateCascadePlatform,
} from '#/api/cascade/platform';
import { $t } from '#/locales';

import { usePlatformFormSchema } from '../data';

interface Emits {
  (e: 'success'): void;
}

const emit = defineEmits<Emits>();

const localFormData = ref<CascadePlatformApi.CascadePlatformVO>(
  {} as CascadePlatformApi.CascadePlatformVO,
);
const isEditMode = ref(false);

const breakpoints = useBreakpoints(breakpointsTailwind);
const isHorizontal = computed(() => breakpoints.greaterOrEqual('md').value);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: usePlatformFormSchema(false),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<CascadePlatformApi.CascadePlatformVO>();
      if (data?.id) {
        localFormData.value = data;
        isEditMode.value = true;

        // 根据编辑模式设置schema
        formApi.setState({ schema: usePlatformFormSchema(true) });

        // 回填表单数据
        formApi.setValues(data);
      } else {
        // 创建模式设置schema
        formApi.setState({ schema: usePlatformFormSchema(false) });
        formApi.resetForm();
        localFormData.value = {} as CascadePlatformApi.CascadePlatformVO;
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
        await updateCascadePlatform(localFormData.value.id, {
          id: localFormData.value.id,
          ...formValues,
        } as CascadePlatformApi.PlatformUpdateReq);
        message.success($t('device.msg.updateSuccess'));
      } else {
        // 新增模式
        await createCascadePlatform(
          formValues as CascadePlatformApi.PlatformCreateReq,
        );
        message.success(
          $t('ui.actionMessage.createSuccess', [$t('cascade.platform.name')]),
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
    ? $t('cascade.platform.edit')
    : $t('cascade.platform.add'),
);
</script>

<template>
  <Drawer class="w-full max-w-[700px]" :title="getDrawerTitle">
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
