<template>
  <div>
    <!-- 搜索栏 -->
    <Card class="mb-4">
      <Form layout="inline" :model="queryForm" @submit="handleSearch">
        <FormItem :label="$t('cascade.channel.platformId')">
          <Select
            v-model:value="queryForm.platformId"
            style="width: 200px"
            allow-clear
          >
            <SelectOption
              v-for="p in platformList"
              :key="p.platformId"
              :value="p.platformId"
            >
              {{ p.platformName || p.platformId }}
            </SelectOption>
          </Select>
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" html-type="submit">{{
              $t('common.search')
            }}</Button>
            <Button @click="handleReset">{{ $t('common.reset') }}</Button>
            <Button type="primary" @click="handleAdd">{{
              $t('cascade.channel.add')
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
          <template v-if="column.key === 'action'">
            <Space>
              <Button type="link" size="small" @click="handleEdit(record)">{{
                $t('common.edit')
              }}</Button>
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
      :title="isEdit ? $t('cascade.channel.edit') : $t('cascade.channel.add')"
      :width="700"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <Form
        :model="formData"
        :label-col="{ span: 8 }"
        :wrapper-col="{ span: 14 }"
      >
        <FormItem
          :label="$t('cascade.channel.platformId')"
          name="platformId"
          required
        >
          <Select v-model:value="formData.platformId" :disabled="isEdit">
            <SelectOption
              v-for="p in platformList"
              :key="p.platformId"
              :value="p.platformId"
            >
              {{ p.platformName || p.platformId }}
            </SelectOption>
          </Select>
        </FormItem>
        <FormItem
          :label="$t('cascade.channel.localDeviceId')"
          name="localDeviceId"
          required
        >
          <Input v-model:value="formData.localDeviceId" :disabled="isEdit" />
        </FormItem>
        <FormItem
          :label="$t('cascade.channel.localChannelId')"
          name="localChannelId"
          required
        >
          <Input v-model:value="formData.localChannelId" :disabled="isEdit" />
        </FormItem>
        <FormItem
          :label="$t('cascade.channel.cascadeChannelId')"
          name="cascadeChannelId"
          required
        >
          <Input v-model:value="formData.cascadeChannelId" />
          <div class="text-gray-400 text-xs mt-1">
            {{ $t('cascade.channel.cascadeChannelIdTip') }}
          </div>
        </FormItem>
        <FormItem :label="$t('cascade.channel.cascadeName')" name="cascadeName">
          <Input v-model:value="formData.cascadeName" />
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
  Select,
  SelectOption,
  Button,
  Space,
  Table,
  Modal,
  Popconfirm,
} from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import type { TableProps } from 'ant-design-vue';
import { getChannelPage, addChannel, updateChannel, deleteChannel } from '#/api/cascade/channel';
import type { CascadeChannelApi } from '#/api/cascade/channel';
import { getPlatformPage } from '#/api/cascade/platform';
import type { CascadePlatformApi } from '#/api/cascade/platform';

const { t } = useI18n();

// 平台列表
const platformList = ref<CascadePlatformApi.Platform[]>([]);

// 查询表单
const queryForm = reactive({
  platformId: undefined as string | undefined,
});

// 表格列定义
const columns = [
  {
    title: t('cascade.channel.platformId'),
    dataIndex: 'platformId',
    key: 'platformId',
    width: 180,
  },
  {
    title: t('cascade.channel.localDeviceId'),
    dataIndex: 'localDeviceId',
    key: 'localDeviceId',
    width: 180,
  },
  {
    title: t('cascade.channel.localChannelId'),
    dataIndex: 'localChannelId',
    key: 'localChannelId',
    width: 180,
  },
  {
    title: t('cascade.channel.cascadeChannelId'),
    dataIndex: 'cascadeChannelId',
    key: 'cascadeChannelId',
    width: 180,
  },
  {
    title: t('cascade.channel.cascadeName'),
    dataIndex: 'cascadeName',
    key: 'cascadeName',
  },
  { title: t('common.action'), key: 'action', width: 180 },
];

// 表格数据
const dataSource = ref<CascadeChannelApi.Channel[]>([]);
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
const formData = reactive<CascadeChannelApi.Channel>({
  platformId: '',
  localDeviceId: '',
  localChannelId: '',
  cascadeChannelId: '',
  cascadeName: '',
});

// 加载平台列表
const loadPlatformList = async () => {
  try {
    const res = await getPlatformPage({ page: 1, size: 1000, enabled: 1 });
    platformList.value = res.records;
  } catch (error) {
    console.error('Failed to load platform list', error);
  }
};

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const res = await getChannelPage({
      page: pagination.current,
      size: pagination.pageSize,
      platformId: queryForm.platformId,
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
  queryForm.platformId = undefined;
  pagination.current = 1;
  loadData();
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
    localDeviceId: '',
    localChannelId: '',
    cascadeChannelId: '',
    cascadeName: '',
  });
  modalVisible.value = true;
};

// 编辑
const handleEdit = (record: CascadeChannelApi.Channel) => {
  isEdit.value = true;
  Object.assign(formData, record);
  modalVisible.value = true;
};

// 提交
const handleSubmit = async () => {
  try {
    if (isEdit.value && formData.id) {
      await updateChannel(formData.id, formData);
      message.success(t('common.updateSuccess'));
    } else {
      await addChannel(formData);
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

// 删除
const handleDelete = async (record: CascadeChannelApi.Channel) => {
  try {
    await deleteChannel(record.id!);
    message.success(t('common.deleteSuccess'));
    loadData();
  } catch (error) {
    message.error(t('common.operationFailed'));
  }
};

onMounted(() => {
  loadPlatformList();
  loadData();
});
</script>
