<script lang="ts" setup>
import type { DeviceApi } from '#/api/device';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { updateDevice } from '#/api/device';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

/**
 * 设备编辑表单抽屉（§4.2 编辑支链）。
 *
 * connectedComponent 模式：从 drawerApi.getData() 取选中行回填，
 * 提交走 PUT /device/update。deviceId 唯一索引不可改（schema 中只读）。
 * 仅编辑既有设备——新增设备由设备 SIP 注册落库，不在本表单范畴。
 */
interface Emits {
  (e: 'success'): void;
}

const emit = defineEmits<Emits>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      return;
    }
    const data = drawerApi.getData<DeviceApi.DeviceVO>();
    if (data?.id) {
      // 回填：仅取后端可更新字段，时间/通道等运行态不入表单。
      formApi.setValues({
        id: data.id,
        deviceId: data.deviceId,
        name: data.name,
        ip: data.ip,
        port: data.port,
        type: data.type,
        serverIp: data.serverIp,
        status: data.status,
      });
    }
  },
});

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const values = await formApi.getValues<DeviceApi.DeviceUpdateReq>();

  drawerApi.setState({ confirmLoading: true });
  try {
    await updateDevice(values);
    message.success($t('device.msg.updateSuccess'));
    drawerApi.close();
    emit('success');
  } finally {
    drawerApi.setState({ confirmLoading: false });
  }
}
</script>

<template>
  <Drawer :title="$t('device.action.edit')">
    <Form />
  </Drawer>
</template>
