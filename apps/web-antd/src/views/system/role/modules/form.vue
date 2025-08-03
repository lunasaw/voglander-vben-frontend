<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import type { Recordable } from '@vben/types';

import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenTree } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Spin } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getMenuList } from '#/api/system/menu';
import { createRole, updateRole } from '#/api/system/role';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemRoleApi.SystemRole>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const permissions = ref<DataNode[]>([]);
const loadingPermissions = ref(false);

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();

    // 过滤 permissions 字段中的 null 值和 undefined 值
    if (values.permissions) {
      if (Array.isArray(values.permissions)) {
        values.permissions = values.permissions.filter(
          (item: any) => item !== null && item !== undefined,
        );
      } else if (typeof values.permissions === 'string') {
        // 如果是字符串，可能需要解析
        try {
          const parsed = JSON.parse(values.permissions);
          if (Array.isArray(parsed)) {
            values.permissions = parsed.filter(
              (item: any) => item !== null && item !== undefined,
            );
          }
        } catch {
          // 如果解析失败，保持原值
        }
      }
    }
    drawerApi.lock();
    (id.value ? updateRole(id.value, values) : createRole(values))
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemRoleApi.SystemRole>();
      formApi.resetForm();
      if (data) {
        formData.value = data;
        id.value = data.id;
        // 先设置其他字段
        formApi.setValues({
          name: data.name,
          status: data.status,
          remark: data.remark,
        });
        
        // 权限数据需要在权限树加载完成后设置
        const setPermissionsData = () => {
          if (data.permissions && Array.isArray(data.permissions)) {
            console.log('设置角色权限数据:', data.permissions);
            formApi.setFieldValue('permissions', data.permissions);
          }
        };
        
        if (permissions.value.length === 0) {
          loadPermissions().then(() => {
            setPermissionsData();
          });
        } else {
          setPermissionsData();
        }
      } else {
        id.value = undefined;
        formApi.setFieldValue('permissions', []);
      }

      if (permissions.value.length === 0) {
        loadPermissions();
      }
    }
  },
});

async function loadPermissions() {
  loadingPermissions.value = true;
  try {
    const res = await getMenuList();
    permissions.value = res as unknown as DataNode[];
  } finally {
    loadingPermissions.value = false;
  }
}

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('common.edit', $t('system.role.name'))
    : $t('common.create', $t('system.role.name'));
});

function getNodeClass(node: Recordable<any>) {
  const classes: string[] = [];
  if (node.value?.type === 'button') {
    classes.push('inline-flex');
    if (node.index % 3 >= 1) {
      classes.push('!pl-0');
    }
  }

  return classes.join(' ');
}

function handlePermissionsChange(value: any) {
  // 过滤掉null和undefined值
  const filteredValue = Array.isArray(value)
    ? value.filter((item: any) => item !== null && item !== undefined)
    : value;
  // 更新表单值
  formApi.setFieldValue('permissions', filteredValue);
}
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form>
      <template #permissions="slotProps">
        <Spin :spinning="loadingPermissions" wrapper-class-name="w-full">
          <VbenTree
            :tree-data="permissions"
            multiple
            bordered
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            v-bind="slotProps"
            value-field="id"
            label-field="meta.title"
            icon-field="meta.icon"
            @change="handlePermissionsChange"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.meta.icon" :icon="value.meta.icon" />
              {{ $t(value.meta.title) }}
            </template>
          </VbenTree>
        </Spin>
      </template>
    </Form>
  </Drawer>
</template>
<style lang="css" scoped>
:deep(.ant-tree-title) {
  .tree-actions {
    display: none;
    margin-left: 20px;
  }
}

:deep(.ant-tree-title:hover) {
  .tree-actions {
    display: flex;
    flex: auto;
    justify-content: flex-end;
    margin-left: 20px;
  }
}
</style>
