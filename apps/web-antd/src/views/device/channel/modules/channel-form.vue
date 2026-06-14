<script lang="ts" setup>
import type { DeviceApi } from '#/api/device';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { updateDeviceChannel } from '#/api/device';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

/**
 * 通道编辑表单抽屉（通道更新支链）。
 *
 * connectedComponent 模式：从 drawerApi.getData() 取选中行回填，
 * 提交走 PUT /deviceChannel/update。channelId / deviceId 是身份字段
 * （后端按主键 id 更新），schema 中只读，仅 name / status 可改。
 * 仅编辑既有通道——通道由设备目录回包落库，不在本表单新增范畴。
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
    const data = drawerApi.getData<DeviceApi.DeviceChannelVO>();
    if (data?.id) {
      // 回填：身份字段只读展示 + 可编辑 name/status。
      formApi.setValues({
        id: data.id,
        deviceId: data.deviceId,
        channelId: data.channelId,
        name: data.name,
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
  const values = await formApi.getValues<DeviceApi.DeviceChannelUpdateReq>();

  drawerApi.setState({ confirmLoading: true });
  try {
    await updateDeviceChannel(values);
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
