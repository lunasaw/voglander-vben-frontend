<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { ref } from 'vue';

import MediaPlayerManager from './MediaPlayerManager.vue';

interface Props {
  playUrls?: null | ZlmMediaApi.PlayUrls;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  controls?: boolean;
  fluid?: boolean;
  currentFormat?: string; // 当前播放的格式
}

withDefaults(defineProps<Props>(), {
  playUrls: null,
  width: '100%',
  height: 360,
  autoplay: false,
  controls: true,
  fluid: true,
  currentFormat: '',
});

const emit = defineEmits<{
  formatNotSupported: [data: { format: string; message: string }];
}>();

const playerManagerRef = ref();

// 播放指定格式
function playFormat(format: string) {
  if (playerManagerRef.value && playerManagerRef.value.playFormat) {
    playerManagerRef.value.playFormat(format);
  }
}

// 销毁播放器
function destroy() {
  if (playerManagerRef.value && playerManagerRef.value.destroy) {
    playerManagerRef.value.destroy();
  }
}

// 重新初始化播放器
function reinit() {
  // 重新初始化会通过响应式数据自动触发
}

// 刷新当前播放器
function refresh() {
  if (playerManagerRef.value && playerManagerRef.value.refresh) {
    playerManagerRef.value.refresh();
  }
}

// 获取当前播放器
function player() {
  return playerManagerRef.value?.getCurrentPlayer();
}

// 暴露方法给父组件（保持向后兼容）
defineExpose({
  player,
  reinit,
  destroy,
  playFormat,
  refresh, // 新增refresh方法
});
</script>

<template>
  <MediaPlayerManager
    ref="playerManagerRef"
    :play-urls="playUrls"
    :width="width"
    :height="height"
    :autoplay="autoplay"
    :controls="controls"
    :fluid="fluid"
    :current-format="currentFormat"
    @format-not-supported="emit('formatNotSupported', $event)"
  />
</template>
