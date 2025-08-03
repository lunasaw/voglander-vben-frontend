<script lang="ts" setup>
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createDept, updateDept } from '#/api/system/dept';
import { $t } from '#/locales';

import { useSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<SystemDeptApi.SystemDept>();
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.dept.name')])
    : $t('ui.actionTitle.create', [$t('system.dept.name')]);
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useSchema(),
  showDefaultActions: false,
});

function resetForm() {
  formApi.resetForm();
  const resetData = formData.value || {};
  // 过滤permissions数组中的null值
  if (resetData.permissions && Array.isArray(resetData.permissions)) {
    resetData.permissions = resetData.permissions.filter(
      (item: any) => item !== null,
    );
  }
  formApi.setValues(resetData);
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      modalApi.lock();
      const data = await formApi.getValues();

      // 过滤permissions数组中的null值
      if (data.permissions && Array.isArray(data.permissions)) {
        const originalLength = data.permissions.length;
        data.permissions = data.permissions.filter(
          (item: any) => item !== null,
        );
        console.log(
          '过滤前permissions长度:',
          originalLength,
          '过滤后长度:',
          data.permissions.length,
        );
        console.log('过滤后的permissions:', data.permissions);
      }

      try {
        await (formData.value?.id
          ? updateDept(formData.value.id, data)
          : createDept(data));
        modalApi.close();
        emit('success');
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<SystemDeptApi.SystemDept>();
      if (data) {
        if (data.pid === 0) {
          data.pid = undefined;
        }
        // 过滤permissions数组中的 null 值
        if (data.permissions && Array.isArray(data.permissions)) {
          data.permissions = data.permissions.filter(
            (item: any) => item !== null,
          );
        }
        formData.value = data;
        formApi.setValues(formData.value);
      }
    }
  },
});
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
