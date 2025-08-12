<script lang="ts" setup>
import type { StreamProxyApi } from '#/api/media/stream-proxy';

import { computed } from 'vue';

import { useVbenForm } from '@vben/common-ui';

import {
  createStreamProxyBusiness,
  updateStreamProxyBusiness,
} from '#/api/media/stream-proxy';
import { $t } from '#/locales';

import { useEditFormSchema, useFormSchema } from '../data';

interface Props {
  formData?: StreamProxyApi.StreamProxyVO;
}

interface Emits {
  (e: 'success'): void;
}

const props = withDefaults(defineProps<Props>(), {
  formData: () => ({}) as StreamProxyApi.StreamProxyVO,
});

const emit = defineEmits<Emits>();

const isEdit = computed(() => !!props.formData?.id);

const [Form, formApi] = useVbenForm({
  // 根据是否为编辑模式选择不同的表单配置
  schema: isEdit.value ? useEditFormSchema() : useFormSchema(),
  resetAfterSubmit: false,
  submitButtonOptions: {
    text: $t('common.confirm'),
  },
  resetButtonOptions: {
    text: $t('common.cancel'),
  },
  onSubmit: handleSubmit,
  onReset: () => formApi.resetForm(),
});

async function handleSubmit(values: Record<string, any>) {
  await (isEdit.value
    ? updateStreamProxyBusiness(
        {
          id: props.formData.id!,
          ...values,
        },
        '更新拉流代理',
      )
    : createStreamProxyBusiness(values as StreamProxyApi.StreamProxyCreateReq));
  emit('success');
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl">
    <div class="mb-6 text-center">
      <h2 class="text-lg font-semibold">
        {{
          isEdit ? $t('media.streamProxy.edit') : $t('media.streamProxy.create')
        }}
      </h2>
    </div>

    <Form />
  </div>
</template>
