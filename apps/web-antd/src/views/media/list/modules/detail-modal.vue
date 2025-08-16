<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { computed, ref } from 'vue';

import StreamDetailModal from '#/components/StreamDetailModal.vue';

interface Props {
  mediaInfo?: null | ZlmMediaApi.MediaInfoDetail;
  nodeKey?: string;
}

const props = defineProps<Props>();

const visible = ref(false);
const streamDetailModalRef = ref();

// 计算流参数
const streamParams = computed(() => {
  if (!props.mediaInfo) return null;
  return {
    vhost: props.mediaInfo.vhost,
    app: props.mediaInfo.app,
    stream: props.mediaInfo.stream,
  };
});

// 方法
function show() {
  visible.value = true;
}

function handleClose() {
  visible.value = false;
}

// 导出方法供父组件调用
defineExpose({
  show,
});
</script>

<template>
  <!-- 使用StreamDetailModal替代整个Modal -->
  <StreamDetailModal
    ref="streamDetailModalRef"
    :stream-params="streamParams"
    :node-key="nodeKey"
    :show-details="true"
    :open="visible"
    @update:open="visible = $event"
    @close="handleClose"
  />
</template>

<style scoped>
/* Styles are now handled by StreamDetailModal */
</style>
