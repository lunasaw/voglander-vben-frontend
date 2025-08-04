<script lang="ts" setup>
import type { BasePlayerEmits, BasePlayerProps } from './BasePlayer.vue';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { RotateCw } from '@vben/icons';

import Hls from 'hls.js';

interface Props extends BasePlayerProps {}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: 360,
  autoplay: false,
  controls: true,
  fluid: true,
});

const emit = defineEmits<BasePlayerEmits>();

const videoRef = ref<HTMLVideoElement>();
let hlsPlayer: Hls | null = null;
const isReady = ref(false);
const useNativeHls = ref(false);
const isLoading = ref(false);
const showRefreshButton = ref(false);

// 检查HLS支持
function checkHlsSupport(): { native: boolean; supported: boolean } {
  if (!videoRef.value) {
    return { supported: false, native: false };
  }

  // 检查原生HLS支持
  const nativeSupported =
    videoRef.value.canPlayType('application/vnd.apple.mpegurl') ||
    videoRef.value.canPlayType('application/x-mpegURL');

  if (nativeSupported) {
    return { supported: true, native: true };
  }

  // 检查hls.js支持
  if (Hls.isSupported()) {
    return { supported: true, native: false };
  }

  return { supported: false, native: false };
}

// 刷新播放器
function refreshPlayer() {
  destroy();
  isLoading.value = false;
  showRefreshButton.value = false;
  setTimeout(() => {
    initPlayer();
  }, 500);
}

// 初始化HLS播放器
async function initPlayer() {
  if (!videoRef.value) {
    return;
  }

  // 重置状态
  isLoading.value = true;
  showRefreshButton.value = false;

  // 确保DOM更新完成
  await nextTick();

  const hlsSupport = checkHlsSupport();

  if (!hlsSupport.supported) {
    emit('formatNotSupported', {
      format: props.format,
      message: 'HLS format is not supported in this browser',
    });
    return;
  }

  // 设置video元素属性
  videoRef.value.className = 'native-video';
  videoRef.value.controls = props.controls;
  if (props.autoplay) {
    videoRef.value.autoplay = true;
  }

  try {
    if (hlsSupport.native) {
      // 使用原生HLS支持
      useNativeHls.value = true;

      videoRef.value.src = props.url;
      videoRef.value.load();

      videoRef.value.addEventListener('loadstart', () => {});

      videoRef.value.addEventListener('canplay', () => {
        isReady.value = true;
        isLoading.value = false;
        emit('playerReady');
      });

      videoRef.value.addEventListener('error', () => {
        const error = videoRef.value?.error;
        isLoading.value = false;
        showRefreshButton.value = true;
        emit('playerError', {
          code: error?.code,
          message: error?.message || 'Native HLS playback error',
        });
      });

      if (props.autoplay) {
        videoRef.value.play().catch((_error) => {
          // Handle autoplay prevention
        });
      }
    } else {
      // 使用hls.js
      useNativeHls.value = false;

      hlsPlayer = new Hls({
        enableWorker: false,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsPlayer.loadSource(props.url);
      hlsPlayer.attachMedia(videoRef.value);

      hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        isReady.value = true;
        isLoading.value = false;
        emit('playerReady');

        if (props.autoplay) {
          videoRef.value?.play().catch((_error) => {
            // Handle autoplay prevention
          });
        }
      });

      hlsPlayer.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          isLoading.value = false;
          showRefreshButton.value = true;

          switch (data.type) {
            case Hls.ErrorTypes.MEDIA_ERROR: {
              hlsPlayer?.recoverMediaError();
              break;
            }
            case Hls.ErrorTypes.NETWORK_ERROR: {
              hlsPlayer?.startLoad();
              break;
            }
            default: {
              emit('playerError', {
                message: `HLS fatal error: ${data.type} - ${data.details}`,
              });
              break;
            }
          }
        } else {
          // Handle non-fatal errors
        }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    emit('playerError', { message: errorMessage });
  }
}

// 播放
async function play() {
  if (videoRef.value) {
    try {
      await videoRef.value.play();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      emit('playerError', { message: errorMessage });
    }
  }
}

// 暂停
function pause() {
  if (videoRef.value) {
    videoRef.value.pause();
  }
}

// 销毁播放器
function destroy() {
  // 清理状态
  isLoading.value = false;
  showRefreshButton.value = false;

  if (hlsPlayer && !useNativeHls.value) {
    try {
      hlsPlayer.destroy();
    } catch {
      // Ignore destroy errors
    }
    hlsPlayer = null;
  }

  if (videoRef.value) {
    videoRef.value.src = '';
    videoRef.value.load();
  }

  isReady.value = false;
  useNativeHls.value = false;
}

// 获取播放器实例
function getPlayer() {
  return useNativeHls.value ? videoRef.value : hlsPlayer;
}

// 监听props变化，重新初始化播放器
watch(
  () => [props.url, props.format],
  ([newUrl, newFormat], [oldUrl, oldFormat]) => {
    // 只有在已经初始化过且URL或格式发生变化时才重新初始化
    if (
      (hlsPlayer || useNativeHls.value) &&
      (newUrl !== oldUrl || newFormat !== oldFormat)
    ) {
      destroy();
      // 延迟重新初始化，确保完全清理
      setTimeout(() => {
        initPlayer();
      }, 100);
    }
  },
  { flush: 'post' },
);

onMounted(() => {
  initPlayer();
});

onBeforeUnmount(() => {
  destroy();
});

// 暴露方法给父组件
defineExpose({
  play,
  pause,
  destroy,
  getPlayer,
  refresh: refreshPlayer,
});
</script>

<template>
  <div class="hls-player">
    <video
      ref="videoRef"
      class="native-video"
      :width="width"
      :height="height"
      :controls="controls"
      :autoplay="autoplay"
    >
      您的浏览器不支持视频播放。
    </video>

    <!-- 加载指示器 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载视频流...</div>
      <div class="loading-subtitle">请稍候片刻</div>
    </div>

    <!-- 刷新按钮 -->
    <div v-if="showRefreshButton" class="refresh-overlay">
      <div class="refresh-content">
        <div class="refresh-message">
          <div class="refresh-title">视频加载失败</div>
          <div class="refresh-subtitle">请尝试刷新播放器</div>
        </div>
        <button
          class="refresh-button"
          @click="refreshPlayer"
          :disabled="isLoading"
        >
          <RotateCw class="refresh-icon" :class="{ spinning: isLoading }" />
          刷新播放器
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.hls-player {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #000;
  border-radius: 8px;
}

.native-video {
  width: 100%;
  height: auto;
  background: #000;
}

.native-video::-webkit-media-controls-panel {
  background-color: rgb(0 0 0 / 80%);
}

/* 加载指示器 */
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  background: rgb(0 0 0 / 80%);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  margin-bottom: 16px;
  border: 3px solid rgb(255 255 255 / 30%);
  border-top: 3px solid #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
}

.loading-subtitle {
  font-size: 14px;
  color: rgb(255 255 255 / 70%);
  text-align: center;
}

/* 刷新覆盖层 */
.refresh-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: rgb(0 0 0 / 90%);
}

.refresh-content {
  padding: 24px;
  text-align: center;
}

.refresh-message {
  margin-bottom: 24px;
}

.refresh-title {
  margin-bottom: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #ff4d4f;
}

.refresh-subtitle {
  font-size: 14px;
  line-height: 1.5;
  color: rgb(255 255 255 / 80%);
}

.refresh-button {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  background: #1890ff;
  border: none;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.refresh-button:hover {
  background: #40a9ff;
  transform: translateY(-1px);
}

.refresh-button:active {
  transform: translateY(0);
}

.refresh-button:disabled {
  cursor: not-allowed;
  background: #595959;
  transform: none;
}

.refresh-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}
</style>
