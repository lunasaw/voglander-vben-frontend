<script lang="ts" setup>
import type { MediaNodeApi } from '#/api/media/medianode';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createMediaNode, updateMediaNode } from '#/api/media/medianode';
import { $t } from '#/locales';

import { useEditFormSchema, useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<MediaNodeApi.MediaNodeVO>();
const isEdit = ref(false);

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
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
        ? updateMediaNode({
            ...values,
            id: id.value,
          } as MediaNodeApi.MediaNodeUpdateReq)
        : createMediaNode(values as MediaNodeApi.MediaNodeCreateReq));
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
        // 编辑时节点 ID 不可修改
        formApi.setState({ schema: useEditFormSchema() });
        formApi.setValues(data);
      } else {
        id.value = undefined;
        isEdit.value = false;
        formData.value = undefined;
        formApi.setState({ schema: useFormSchema() });
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
