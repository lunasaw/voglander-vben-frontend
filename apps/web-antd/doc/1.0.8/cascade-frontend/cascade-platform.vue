<template>
  <div>
    <!-- 搜索栏 -->
    <Card class="mb-4">
      <Form layout="inline" :model="queryForm" @submit="handleSearch">
        <FormItem :label="$t('cascade.platform.enabled')">
          <Select
            v-model:value="queryForm.enabled"
            style="width: 120px"
            allow-clear
          >
            <SelectOption :value="1">{{ $t('common.enabled') }}</SelectOption>
            <SelectOption :value="0">{{ $t('common.disabled') }}</SelectOption>
          </Select>
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" html-type="submit">{{
              $t('common.search')
            }}</Button>
            <Button @click="handleReset">{{ $t('common.reset') }}</Button>
            <Button type="primary" @click="handleAdd">{{
              $t('cascade.platform.add')
            }}</Button>
            <Button @click="handleRefresh">{{
              $t('cascade.platform.refreshScheduler')
            }}</Button>
          </Space>
        </FormItem>
      </Form>
    </Card>

    <!-- 表格 -->
    <Card>
      <Table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'enabled'">
            <Tag :color="record.enabled === 1 ? 'green' : 'red'">
              {{
                record.enabled === 1
                  ? $t('common.enabled')
                  : $t('common.disabled')
              }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button type="link" size="small" @click="handleEdit(record)">{{
                $t('common.edit')
              }}</Button>
              <Button
                type="link"
                size="small"
                :danger="record.enabled === 1"
                @click="
                  record.enabled === 1
                    ? handleDisable(record)
                    : handleEnable(record)
                "
              >
                {{
                  record.enabled === 1
                    ? $t('common.disable')
                    : $t('common.enable')
                }}
              </Button>
              <Popconfirm
                :title="$t('common.confirmDelete')"
                @confirm="handleDelete(record)"
              >
                <Button type="link" size="small" danger>{{
                  $t('common.delete')
                }}</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <!-- 表单弹窗 -->
    <Modal
      v-model:open="modalVisible"
      :title="isEdit ? $t('cascade.platform.edit') : $t('cascade.platform.add')"
      :width="800"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <Form
        :model="formData"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <FormItem
          :label="$t('cascade.platform.platformId')"
          name="platformId"
          required
        >
          <Input v-model:value="formData.platformId" :disabled="isEdit" />
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.platformName')"
          name="platformName"
        >
          <Input v-model:value="formData.platformName" />
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.serverIp')"
          name="serverIp"
          required
        >
          <Input v-model:value="formData.serverIp" />
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.serverPort')"
          name="serverPort"
          required
        >
          <InputNumber
            v-model:value="formData.serverPort"
            :min="1"
            :max="65535"
            style="width: 100%"
          />
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.serverDomain')"
          name="serverDomain"
        >
          <Input v-model:value="formData.serverDomain" />
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.localClientId')"
          name="localClientId"
          required
        >
          <Input v-model:value="formData.localClientId" />
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.localClientIp')"
          name="localClientIp"
        >
          <Input v-model:value="formData.localClientIp" />
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.localClientPort')"
          name="localClientPort"
        >
          <InputNumber
            v-model:value="formData.localClientPort"
            :min="1"
            :max="65535"
            style="width: 100%"
          />
        </FormItem>
        <FormItem :label="$t('cascade.platform.transport')" name="transport">
          <Select v-model:value="formData.transport">
            <SelectOption value="UDP">UDP</SelectOption>
            <SelectOption value="TCP">TCP</SelectOption>
          </Select>
        </FormItem>
        <FormItem :label="$t('cascade.platform.username')" name="username">
          <Input v-model:value="formData.username" />
        </FormItem>
        <FormItem :label="$t('cascade.platform.password')" name="password">
          <InputPassword v-model:value="formData.password" />
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.registerExpires')"
          name="registerExpires"
        >
          <InputNumber
            v-model:value="formData.registerExpires"
            :min="60"
            :max="3600"
            style="width: 100%"
          />
          <span class="ml-2">{{ $t('common.seconds') }}</span>
        </FormItem>
        <FormItem
          :label="$t('cascade.platform.keepaliveInterval')"
          name="keepaliveInterval"
        >
          <InputNumber
            v-model:value="formData.keepaliveInterval"
            :min="10"
            :max="300"
            style="width: 100%"
          />
          <span class="ml-2">{{ $t('common.seconds') }}</span>
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import {
  Card,
  Form,
  FormItem,
  Input,
  InputNumber,
  InputPassword,
  Select,
  SelectOption,
  Button,
  Space,
  Table,
  Tag,
  Modal,
  Popconfirm,
} from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import type { TableProps } from 'ant-design-vue';
import { getPlatformPage, addPlatform, updatePlatform, deletePlatform, enablePlatform, disablePlatform, refreshRegistrations } from '#/api/cascade/platform';
import type { CascadePlatformApi } from '#/api/cascade/platform';

const { t } = useI18n();

// 查询表单
const queryForm = reactive({
  enabled: undefined as number | undefined,
});

// 表格列定义
const columns = [
  {
    title: t('cascade.platform.platformId'),
    dataIndex: 'platformId',
    key: 'platformId',
  },
  {
    title: t('cascade.platform.platformName'),
    dataIndex: 'platformName',
    key: 'platformName',
  },
  {
    title: t('cascade.platform.serverIp'),
    dataIndex: 'serverIp',
    key: 'serverIp',
  },
  {
    title: t('cascade.platform.serverPort'),
    dataIndex: 'serverPort',
    key: 'serverPort',
  },
  {
    title: t('cascade.platform.localClientId'),
    dataIndex: 'localClientId',
    key: 'localClientId',
  },
  { title: t('cascade.platform.enabled'), key: 'enabled' },
  { title: t('common.action'), key: 'action', width: 250 },
];

// 表格数据
const dataSource = ref<CascadePlatformApi.Platform[]>([]);
const loading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => t('common.total', { count: total }),
});

// 表单弹窗
const modalVisible = ref(false);
const isEdit = ref(false);
const formData = reactive<CascadePlatformApi.Platform>({
  platformId: '',
  platformName: '',
  serverIp: '',
  serverPort: 5060,
  serverDomain: '',
  localClientId: '',
  localClientIp: '',
  localClientPort: undefined,
  transport: 'UDP',
  username: '',
  password: '',
  registerExpires: 3600,
  keepaliveInterval: 60,
});

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const res = await getPlatformPage({
      page: pagination.current,
      size: pagination.pageSize,
      enabled: queryForm.enabled,
    });
    dataSource.value = res.records;
    pagination.total = res.total;
  } catch (error) {
    message.error(t('common.loadFailed'));
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  pagination.current = 1;
  loadData();
};

// 重置
const handleReset = () => {
  queryForm.enabled = undefined;
  pagination.current = 1;
  loadData();
};

// 刷新调度
const handleRefresh = async () => {
  try {
    await refreshRegistrations();
    message.success(t('cascade.platform.refreshSuccess'));
  } catch (error) {
    message.error(t('common.operationFailed'));
  }
};

// 表格变化
const handleTableChange: TableProps['onChange'] = (pag) => {
  pagination.current = pag.current || 1;
  pagination.pageSize = pag.pageSize || 20;
  loadData();
};

// 新增
const handleAdd = () => {
  isEdit.value = false;
  Object.assign(formData, {
    platformId: '',
    platformName: '',
    serverIp: '',
    serverPort: 5060,
    serverDomain: '',
    localClientId: '',
    localClientIp: '',
    localClientPort: undefined,
    transport: 'UDP',
    username: '',
    password: '',
    registerExpires: 3600,
    keepaliveInterval: 60,
  });
  modalVisible.value = true;
};

// 编辑
const handleEdit = (record: CascadePlatformApi.Platform) => {
  isEdit.value = true;
  Object.assign(formData, record);
  modalVisible.value = true;
};

// 提交
const handleSubmit = async () => {
  try {
    if (isEdit.value && formData.id) {
      await updatePlatform(formData.id, formData);
      message.success(t('common.updateSuccess'));
    } else {
      await addPlatform(formData);
      message.success(t('common.addSuccess'));
    }
    modalVisible.value = false;
    loadData();
  } catch (error) {
    message.error(t('common.operationFailed'));
  }
};

// 取消
const handleCancel = () => {
  modalVisible.value = false;
};

// 启用
const handleEnable = async (record: CascadePlatformApi.Platform) => {
  try {
    await enablePlatform(record.id!);
    message.success(t('common.operationSuccess'));
    loadData();
  } catch (error) {
    message.error(t('common.operationFailed'));
  }
};

// 停用
const handleDisable = async (record: CascadePlatformApi.Platform) => {
  try {
    await disablePlatform(record.id!);
    message.success(t('common.operationSuccess'));
    loadData();
  } catch (error) {
    message.error(t('common.operationFailed'));
  }
};

// 删除
const handleDelete = async (record: CascadePlatformApi.Platform) => {
  try {
    await deletePlatform(record.id!);
    message.success(t('common.deleteSuccess'));
    loadData();
  } catch (error) {
    message.error(t('common.operationFailed'));
  }
};

onMounted(() => {
  loadData();
});
</script>
