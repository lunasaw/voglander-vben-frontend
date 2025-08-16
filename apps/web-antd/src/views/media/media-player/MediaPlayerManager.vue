<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { computed, ref, shallowRef, watch } from 'vue';

import { message } from 'ant-design-vue';

import {
  getBestFormat,
  getFormatDisplayName,
  getPlayerForFormat,
} from './composables/usePlayerDetection';
import FlvPlayer from './players/FlvPlayer.vue';
import HlsPlayer from './players/HlsPlayer.vue';
import VideoJsPlayer from './players/VideoJsPlayer.vue';

interface Props {
  playUrls?: null | ZlmMediaApi.PlayUrls;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  controls?: boolean;
  fluid?: boolean;
  currentFormat?: string; // 指定播放的格式
}

const props = withDefaults(defineProps<Props>(), {
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

// 组件映射
const playerComponents = {
  VideoJsPlayer,
  FlvPlayer,
  HlsPlayer,
};

// 当前播放器状态
const currentPlayerComponent = shallowRef();
const currentPlayerRef = ref();
const currentPlayingFormat = ref('');
const currentUrl = ref('');
const isDestroying = ref(false);

// 计算属性
const hasPlayUrls = computed(() => {
  if (!props.playUrls) return false;
  const urls = props.playUrls;
  return Object.values(urls).some(Boolean);
});

const currentPlayInfo = computed(() => {
  if (!props.playUrls) return null;

  // 如果指定了格式，优先使用指定格式
  if (props.currentFormat) {
    const url =
      props.playUrls[props.currentFormat as keyof ZlmMediaApi.PlayUrls];
    if (url) {
      const playerInfo = getPlayerForFormat(props.currentFormat);
      return {
        format: props.currentFormat,
        url,
        playerInfo,
      };
    }
  }

  // 否则使用最佳格式
  return getBestFormat(props.playUrls);
});

// 播放指定格式
function playFormat(format: string) {
  if (!props.playUrls) return;

  const url = props.playUrls[format as keyof ZlmMediaApi.PlayUrls];
  if (!url) {
    console.warn(`Format ${format} not available`);
    return;
  }

  const playerInfo = getPlayerForFormat(format);
  if (!playerInfo.supported) {
    message.warning({
      content: `当前浏览器不支持 ${getFormatDisplayName(format)} 格式播放${
        playerInfo.reason ? `: ${playerInfo.reason}` : ''
      }`,
      duration: 5,
    });
    return;
  }

  // 对于FLV格式切换，总是强制重建播放器以确保切换生效
  const isFLVSwitch =
    (format === 'httpFlv' || format === 'wsFlv') &&
    (currentPlayingFormat.value === 'httpFlv' ||
      currentPlayingFormat.value === 'wsFlv');

  // 对于同一种播放器组件但不同格式的情况，也需要强制重建
  const currentPlayerInfo = currentPlayingFormat.value
    ? getPlayerForFormat(currentPlayingFormat.value)
    : null;
  const newPlayerInfo = getPlayerForFormat(format);
  const samePlayerComponent =
    currentPlayerInfo?.component === newPlayerInfo.component;

  // 如果是相同的播放器类型且URL相同，且不是需要强制重建的情况，则跳过
  if (
    currentPlayingFormat.value === format &&
    currentUrl.value === url &&
    !isFLVSwitch
  ) {
    return;
  }

  // 如果是FLV格式之间的切换，或者是同一播放器组件的不同格式，强制重建
  if (
    (isFLVSwitch && currentPlayingFormat.value !== format) ||
    (samePlayerComponent && currentPlayingFormat.value !== format)
  ) {
    // Force rebuild player
  }

  isDestroying.value = true;

  // 先销毁当前播放器
  if (currentPlayerRef.value && currentPlayerRef.value.destroy) {
    currentPlayerRef.value.destroy();
  }

  // 设置新的播放器信息
  currentPlayingFormat.value = format;
  currentUrl.value = url;
  currentPlayerComponent.value =
    playerComponents[playerInfo.component as keyof typeof playerComponents];

  // 对于FLV格式切换或同组件不同格式切换，增加延迟时间确保彻底清理
  const needsLongerDelay =
    isFLVSwitch ||
    (samePlayerComponent && currentPlayingFormat.value !== format);
  const delay = needsLongerDelay ? 300 : 150;
  setTimeout(() => {
    isDestroying.value = false;
  }, delay);
}

// 处理播放器就绪
function handlePlayerReady() {
  // Player ready handler
}

// 处理播放器错误
function handlePlayerError(error: { code?: number; message: string }) {
  console.warn('Player error:', error);
  message.error({
    content: `播放器错误: ${error.message}`,
    duration: 100,
  });
}

// 处理格式不支持
function handleFormatNotSupported(data: { format: string; message: string }) {
  message.warning({
    content: `${getFormatDisplayName(data.format)} 格式不支持: ${data.message}`,
    duration: 5,
  });
  emit('formatNotSupported', data);
}

// 初始化播放器
function initializePlayer() {
  if (!currentPlayInfo.value) {
    console.warn('No available play URL found');
    return;
  }

  const { format, url, playerInfo } = currentPlayInfo.value;

  if (!playerInfo.supported) {
    handleFormatNotSupported({
      format,
      message: playerInfo.reason || 'Format not supported',
    });
    return;
  }

  currentPlayingFormat.value = format;
  currentUrl.value = url;
  currentPlayerComponent.value =
    playerComponents[playerInfo.component as keyof typeof playerComponents];
}

// 监听播放地址变化
watch(
  () => props.playUrls,
  () => {
    if (props.playUrls && hasPlayUrls.value) {
      initializePlayer();
    } else {
      currentPlayerComponent.value = null;
      currentPlayingFormat.value = '';
      currentUrl.value = '';
    }
  },
  { immediate: true, deep: true },
);

// 监听当前格式变化
watch(
  () => props.currentFormat,
  (newFormat) => {
    if (newFormat && newFormat !== currentPlayingFormat.value) {
      playFormat(newFormat);
    }
  },
  { immediate: true },
);

// 刷新当前播放器
function refreshCurrentPlayer() {
  if (currentPlayerRef.value) {
    // 如果播放器有refresh方法，优先使用
    if (currentPlayerRef.value.refresh) {
      currentPlayerRef.value.refresh();
    } else {
      // 否则通过重新初始化的方式刷新
      const currentFormat = currentPlayingFormat.value;
      playFormat(currentFormat);
    }
  }
}

// 销毁当前播放器
function destroyCurrentPlayer() {
  if (currentPlayerRef.value && currentPlayerRef.value.destroy) {
    currentPlayerRef.value.destroy();
  }
}

// 暴露方法给父组件
defineExpose({
  playFormat,
  destroy: destroyCurrentPlayer,
  refresh: refreshCurrentPlayer,
  getCurrentPlayer: () => currentPlayerRef.value,
  getCurrentFormat: () => currentPlayingFormat.value,
});
</script>

<template>
  <div class="media-player-manager">
    <div v-if="hasPlayUrls && currentPlayerComponent" class="player-wrapper">
      <!-- 动态播放器组件 -->
      <component
        :is="currentPlayerComponent"
        ref="currentPlayerRef"
        :url="currentUrl"
        :format="currentPlayingFormat"
        :width="width"
        :height="height"
        :autoplay="autoplay"
        :controls="controls"
        :fluid="fluid"
        :style="{
          opacity: isDestroying ? '0.7' : '1',
          transition: 'opacity 0.2s ease',
        }"
        @player-ready="handlePlayerReady"
        @player-error="handlePlayerError"
        @format-not-supported="handleFormatNotSupported"
      />

      <!-- 切换指示器 -->
      <div v-if="isDestroying" class="switching-indicator">
        <div class="switching-text">切换播放器中...</div>
      </div>
    </div>

    <div v-else class="no-player-message">
      <div class="p-8 text-center text-gray-500">
        <p class="mb-2 text-lg">暂无可播放的视频流</p>
        <p class="text-sm">请检查流媒体地址是否正确</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-player-manager {
  position: relative;
  width: 100%;
}

.player-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #000;
  border-radius: 8px;
}

.switching-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 999;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 24px;
  color: white;
  background: rgb(0 0 0 / 80%);
  border-radius: 6px;
  transform: translate(-50%, -50%);
}

.switching-text {
  font-size: 14px;
  font-weight: 500;
}

.switching-indicator::before {
  width: 16px;
  height: 16px;
  content: '';
  border: 2px solid #fff;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.no-player-message {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 200px;
  background: #f5f5f5;
  border-radius: 8px;
}
</style>
