<script lang="ts" setup>
import type { BasePlayerEmits, BasePlayerProps } from './BasePlayer.vue';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { RotateCw } from '@vben/icons';

import flvjs from 'flv.js';

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
let flvPlayer: flvjs.Player | null = null;
const isReady = ref(false);
const isLoading = ref(false);
const loadingStartTime = ref<number>(0);
const firstFrameReceived = ref(false);
const showRefreshButton = ref(false);

// 检查FLV支持
function isFlvSupported(): boolean {
  return flvjs.isSupported();
}

// 刷新播放器
function refreshPlayer() {
  destroy();
  isLoading.value = false;
  firstFrameReceived.value = false;
  showRefreshButton.value = false;
  setTimeout(() => {
    initPlayer();
  }, 500);
}

// 检查首帧加载超时
function checkFirstFrameTimeout() {
  setTimeout(() => {
    if (isLoading.value && !firstFrameReceived.value) {
      const elapsed = Date.now() - loadingStartTime.value;
      if (elapsed > 8000 && !showRefreshButton.value) {
        // 8秒后显示刷新按钮
        showRefreshButton.value = true;
      }
    }
  }, 8000);
}

// 初始化FLV播放器
async function initPlayer() {
  if (!videoRef.value) {
    return;
  }

  if (!isFlvSupported()) {
    emit('formatNotSupported', {
      format: props.format,
      message: 'FLV format is not supported in this browser',
    });
    return;
  }

  // 重置状态
  isLoading.value = true;
  loadingStartTime.value = Date.now();
  firstFrameReceived.value = false;
  showRefreshButton.value = false;

  // 启动首帧超时检测
  checkFirstFrameTimeout();

  // 确保DOM更新完成
  await nextTick();

  // 设置video元素属性
  videoRef.value.className = 'native-video';
  videoRef.value.controls = props.controls;
  if (props.autoplay) {
    videoRef.value.autoplay = true;
  }

  // 配置FLV播放器 - 根据格式类型进行差异化配置
  const flvConfig: flvjs.MediaDataSource = {
    type: 'flv',
    url: props.url,
    isLive: true,
    cors: true,
    withCredentials: false,
    hasAudio: true,
    hasVideo: true,
  };

  // WebSocket FLV特殊配置
  if (props.format === 'wsFlv') {
    // WebSocket FLV需要特殊处理
    flvConfig.type = 'flv';
    flvConfig.isLive = true;
    // 对于WebSocket FLV，可能需要不同的配置
    // 注意：flv.js可能不直接支持WebSocket，这里保持兼容性配置
  } else {
    // HTTP FLV使用标准配置
  }

  try {
    flvPlayer = flvjs.createPlayer(flvConfig);
    flvPlayer.attachMediaElement(videoRef.value);

    // 事件监听
    flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
      isReady.value = true;
      isLoading.value = false;
      emit('playerReady');
    });

    flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail) => {
      isLoading.value = false;
      showRefreshButton.value = true;
      emit('playerError', {
        message: `FLV player error: ${errorType} - ${errorDetail}`,
      });
    });

    // 监听视频元数据加载
    if (videoRef.value) {
      videoRef.value.addEventListener('loadedmetadata', () => {
        firstFrameReceived.value = true;
        isLoading.value = false;
      });

      videoRef.value.addEventListener('loadstart', () => {});

      videoRef.value.addEventListener('canplay', () => {
        firstFrameReceived.value = true;
        isLoading.value = false;
      });

      videoRef.value.addEventListener(
        'timeupdate',
        () => {
          if (!firstFrameReceived.value) {
            firstFrameReceived.value = true;
            isLoading.value = false;
          }
        },
        { once: true },
      );
    }

    // 加载播放器
    flvPlayer.load();

    if (props.autoplay) {
      await flvPlayer.play();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    isLoading.value = false;
    showRefreshButton.value = true;
    emit('playerError', { message: errorMessage });
  }
}

// 播放
async function play() {
  if (flvPlayer && typeof flvPlayer.play === 'function') {
    try {
      await flvPlayer.play();
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
  firstFrameReceived.value = false;
  showRefreshButton.value = false;

  if (flvPlayer) {
    try {
      flvPlayer.unload();
      flvPlayer.detachMediaElement();
      flvPlayer.destroy();
    } catch {
      // Ignore destroy errors
    }
    flvPlayer = null;
  }

  isReady.value = false;
}

// 获取播放器实例
function getPlayer() {
  return flvPlayer;
}

// 监听props变化，重新初始化播放器
watch(
  () => [props.url, props.format],
  ([newUrl, newFormat], [oldUrl, oldFormat]) => {
    // 只有在已经初始化过且URL或格式发生变化时才重新初始化
    if (flvPlayer && (newUrl !== oldUrl || newFormat !== oldFormat)) {
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
  <div class="flv-player">
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
    <div v-if="isLoading && !firstFrameReceived" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在等待视频流...</div>
      <div class="loading-subtitle">请稍候，正在获取首帧关键帧</div>
    </div>

    <!-- 刷新按钮 -->
    <div v-if="showRefreshButton" class="refresh-overlay">
      <div class="refresh-content">
        <div class="refresh-message">
          <div class="refresh-title">视频加载失败</div>
          <div class="refresh-subtitle">
            可能是首帧关键帧获取失败，请尝试刷新
          </div>
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

.flv-player {
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
