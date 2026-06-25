<script lang="ts" setup>
import type { CascadeSubscribeApi } from '#/api/cascade/subscribe';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Empty, Table, Tag } from 'ant-design-vue';

import { getCascadeSubscribeList } from '#/api/cascade/subscribe';
import { $t } from '#/locales';

const platformId = ref<string>('');
const loading = ref(false);
const list = ref<CascadeSubscribeApi.CascadeSubscribeVO[]>([]);

const columns = [
  {
    dataIndex: 'subTypeName',
    key: 'subTypeName',
    title: $t('cascade.subscribe.field.subType'),
  },
  {
    dataIndex: 'expires',
    key: 'expires',
    title: $t('cascade.subscribe.field.expires'),
  },
  {
    dataIndex: 'expireTime',
    key: 'expireTime',
    title: $t('cascade.subscribe.field.expireTime'),
  },
  {
    dataIndex: 'statusName',
    key: 'statusName',
    title: $t('cascade.subscribe.field.status'),
  },
];

function fmtTime(ts?: number) {
  if (!ts) {
    return '-';
  }
  return new Date(ts).toLocaleString();
}

async function loadList() {
  if (!platformId.value) {
    return;
  }
  loading.value = true;
  try {
    list.value = await getCascadeSubscribeList(platformId.value);
  } finally {
    loading.value = false;
  }
}

const [Drawer, drawerApi] = useVbenDrawer({
  footer: false,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<{ platformId?: string }>();
      platformId.value = data?.platformId ?? '';
      list.value = [];
      loadList();
    }
  },
});
</script>

<template>
  <Drawer class="w-full max-w-[700px]" :title="$t('cascade.subscribe.title')">
    <div class="p-4">
      <div class="text-muted-foreground mb-3 text-sm">
        {{ $t('cascade.platform.field.platformId') }}: {{ platformId }}
      </div>
      <Table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #emptyText>
          <Empty :description="$t('cascade.subscribe.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'expireTime'">
            {{ fmtTime(record.expireTime) }}
          </template>
          <template v-else-if="column.key === 'statusName'">
            <Tag :color="record.status === 1 ? 'success' : 'default'">
              {{ record.statusName }}
            </Tag>
          </template>
        </template>
      </Table>
    </div>
  </Drawer>
</template>
