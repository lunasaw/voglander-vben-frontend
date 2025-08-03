<script lang="ts" setup>
import type { MediaNodeApi } from '#/api/media/medianode';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createMediaNode, updateMediaNode } from '#/api/media/medianode';
import { $t } from '#/locales';

import { useEditFormSchema, useFormSchema } from '../data';

const emits = defineEmits(['success']);

const { hasAccessByCodes } = useAccess();
const formData = ref<MediaNodeApi.MediaNodeVO>();
const isEdit = ref(false);

// 动态获取表单schema，编辑时节点ID不可修改
const getFormSchema = computed(() => {
  return isEdit.value ? useEditFormSchema() : useFormSchema();
});

const [Form, formApi] = useVbenForm({
  schema: getFormSchema,
  showDefaultActions: false,
});

const id = ref<number>();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues();

    drawerApi.lock();
    try {
      await (id.value
        ? updateMediaNode({ ...values, id: id.value })
        : createMediaNode(values));
      emits('success');
      drawerApi.close();
    } catch {
      drawerApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<MediaNodeApi.MediaNodeVO>();
      formApi.resetForm();
      if (data?.id) {
        formData.value = data;
        id.value = data.id;
        isEdit.value = true;
        formApi.setValues(data);
      } else {
        id.value = undefined;
        isEdit.value = false;
        formData.value = undefined;
      }
    }
  },
});

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('common.edit', $t('media.node.name'))
    : $t('common.create', $t('media.node.name'));
});
</script>

<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
