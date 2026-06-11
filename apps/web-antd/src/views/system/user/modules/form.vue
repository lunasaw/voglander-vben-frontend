<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createUser, updateUser } from '#/api/system/user';
import { $t } from '#/locales';

import { useEditFormSchema, useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemUserApi.UserVO>();
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

    // 编辑模式下，如果密码为空则不传递密码字段
    if (isEdit.value && !values.password) {
      delete values.password;
    }

    drawerApi.lock();
    try {
      await (id.value
        ? updateUser(
            id.value,
            values as Omit<SystemUserApi.UserUpdateReq, 'id'>,
          )
        : createUser(values as SystemUserApi.UserCreateReq));
      emits('success');
      drawerApi.close();
    } catch {
      drawerApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemUserApi.UserVO>();
      formApi.resetForm();
      if (data?.id) {
        formData.value = data;
        id.value = data.id;
        isEdit.value = true;
        // 编辑时不显示密码必填
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
    ? $t('common.edit', $t('system.user.name'))
    : $t('common.create', $t('system.user.name'));
});
</script>

<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
