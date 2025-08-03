<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { computed, ref, shallowRef, watch } from 'vue';

import { message } from 'ant-design-vue';

import FlvPlayer from './players/FlvPlayer.vue';
import HlsPlayer from './players/HlsPlayer.vue';
import VideoJsPlayer from './players/VideoJsPlayer.vue';
import { 
  getBestFormat, 
  getFormatDisplayName, 
  getPlayerForFormat 
} from './composables/usePlayerDetection';

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
  width: '100%',
  height: 360,
  autoplay: false,
  controls: true,
  fluid: true,
  currentFormat: '',
});

const emit = defineEmits<{
  'format-not-supported': [data: { format: string; message: string }];
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
  return Object.values(urls).some(url => url);
});

const currentPlayInfo = computed(() => {
  if (!props.playUrls) return null;

  // 如果指定了格式，优先使用指定格式
  if (props.currentFormat) {
    const url = props.playUrls[props.currentFormat as keyof ZlmMediaApi.PlayUrls];
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

  console.log(`Switching to ${format}: ${url}`);
  
  // 如果是相同的播放器类型且URL相同，不需要切换
  if (currentPlayingFormat.value === format && currentUrl.value === url) {
    console.log('Same format and URL, skipping switch');
    return;
  }
  
  isDestroying.value = true;
  
  // 先销毁当前播放器
  if (currentPlayerRef.value && currentPlayerRef.value.destroy) {
    currentPlayerRef.value.destroy();
  }
  
  // 设置新的播放器信息
  currentPlayingFormat.value = format;
  currentUrl.value = url;
  currentPlayerComponent.value = playerComponents[playerInfo.component as keyof typeof playerComponents];
  
  // 延迟确保组件切换完成
  setTimeout(() => {
    isDestroying.value = false;
  }, 150);
}

// 处理播放器就绪
function handlePlayerReady() {
  console.log(`Player ready for ${currentPlayingFormat.value}`);
}

// 处理播放器错误
function handlePlayerError(error: { code?: number; message: string }) {
  console.error('Player error:', error);
  message.error({
    content: `播放器错误: ${error.message}`,
    duration: 5,
  });
}

// 处理格式不支持
function handleFormatNotSupported(data: { format: string; message: string }) {
  console.warn(`Format ${data.format} not supported:`, data.message);
  message.warning({
    content: `${getFormatDisplayName(data.format)} 格式不支持: ${data.message}`,
    duration: 5,
  });
  emit('format-not-supported', data);
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

  console.log(`Initializing player for ${format}: ${url}`);
  
  currentPlayingFormat.value = format;
  currentUrl.value = url;
  currentPlayerComponent.value = playerComponents[playerInfo.component as keyof typeof playerComponents];
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
  { immediate: true, deep: true }
);

// 监听当前格式变化
watch(
  () => props.currentFormat,
  (newFormat) => {
    if (newFormat && newFormat !== currentPlayingFormat.value) {
      playFormat(newFormat);
    }
  },
  { immediate: true }
);

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
  width: 100%;
  position: relative;
}

.player-wrapper {
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.switching-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 999;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.switching-text {
  font-size: 14px;
  font-weight: 500;
}

.switching-indicator::before {
  content: '';
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
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
  width: 100%;
  min-height: 200px;
  background: #f5f5f5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>