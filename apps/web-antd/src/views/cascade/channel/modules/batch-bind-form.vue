<script lang="ts" setup>
import type { CascadeChannelApi } from '#/api/cascade/channel';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message, Select, Textarea } from 'ant-design-vue';

import { batchBindCascadeChannels } from '#/api/cascade/channel';
import { $t } from '#/locales';

interface Emits {
  (e: 'success'): void;
}

const emit = defineEmits<Emits>();

const platformOptions = ref<Array<{ label: string; value: string }>>([]);
const platformId = ref<string>('');
/** 每行一条：localChannelId 或 `localChannelId,localDeviceId,cascadeName`（逗号分隔，后两项可选）。 */
const channelsText = ref<string>('');

const placeholder = computed(() => $t('cascade.channel.batchBind.placeholder'));

/** 解析多行文本为绑定项列表。 */
function parseChannels(): CascadeChannelApi.BatchBindItem[] {
  return channelsText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localChannelId, localDeviceId, cascadeName] = line
        .split(',')
        .map((s) => s.trim());
      return {
        localChannelId: localChannelId ?? '',
        localDeviceId: localDeviceId || undefined,
        cascadeName: cascadeName || undefined,
      };
    })
    .filter((item) => item.localChannelId);
}

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<{
        platformId?: string;
        platformOptions?: Array<{ label: string; value: string }>;
      }>();
      platformOptions.value = data?.platformOptions ?? [];
      platformId.value = data?.platformId ?? '';
      channelsText.value = '';
    }
  },
});

async function onSubmit() {
  if (!platformId.value) {
    message.error($t('cascade.channel.batchBind.platformRequired'));
    return;
  }
  const channels = parseChannels();
  if (channels.length === 0) {
    message.error($t('cascade.channel.batchBind.channelsRequired'));
    return;
  }

  drawerApi.lock();
  try {
    const added = await batchBindCascadeChannels({
      platformId: platformId.value,
      channels,
    });
    message.success($t('cascade.channel.batchBind.success', [added]));
    drawerApi.close();
    emit('success');
  } finally {
    drawerApi.unlock();
  }
}
</script>

<template>
  <Drawer
    class="w-full max-w-[600px]"
    :title="$t('cascade.channel.batchBind.title')"
  >
    <div class="flex flex-col gap-4 p-4">
      <div>
        <div class="mb-2 font-medium">
          {{ $t('cascade.channel.field.platformId') }}
        </div>
        <Select
          v-model:value="platformId"
          class="w-full"
          :options="platformOptions"
          :placeholder="$t('cascade.channel.placeholder.platformId')"
        />
      </div>
      <div>
        <div class="mb-2 font-medium">
          {{ $t('cascade.channel.batchBind.channels') }}
        </div>
        <Textarea
          v-model:value="channelsText"
          :auto-size="{ minRows: 8, maxRows: 16 }"
          :placeholder="placeholder"
        />
        <div class="text-muted-foreground mt-1 text-xs">
          {{ $t('cascade.channel.batchBind.help') }}
        </div>
      </div>
    </div>
  </Drawer>
</template>
