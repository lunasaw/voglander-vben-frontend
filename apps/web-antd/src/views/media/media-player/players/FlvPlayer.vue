<script lang="ts" setup>
import type { BasePlayerProps, BasePlayerEmits } from './BasePlayer.vue';

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

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

// 检查FLV支持
function isFlvSupported(): boolean {
  return flvjs.isSupported();
}

// 初始化FLV播放器
async function initPlayer() {
  if (!videoRef.value) {
    console.error('Video element not found');
    return;
  }

  if (!isFlvSupported()) {
    emit('format-not-supported', {
      format: props.format,
      message: 'FLV format is not supported in this browser',
    });
    return;
  }

  console.log(`Initializing FLV player for ${props.format}`);
  
  // 确保DOM更新完成
  await nextTick();

  // 设置video元素属性
  videoRef.value.className = 'native-video';
  videoRef.value.controls = props.controls;
  if (props.autoplay) {
    videoRef.value.autoplay = true;
  }

  // 配置FLV播放器
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
    flvConfig.type = 'flv';
    flvConfig.isLive = true;
  }

  try {
    flvPlayer = flvjs.createPlayer(flvConfig);
    flvPlayer.attachMediaElement(videoRef.value);

    // 事件监听
    flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
      console.log(`${props.format} loading complete`);
      isReady.value = true;
      emit('player-ready');
    });

    flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail) => {
      console.error(`${props.format} error:`, errorType, errorDetail);
      emit('player-error', { 
        message: `FLV player error: ${errorType} - ${errorDetail}` 
      });
    });

    // 加载播放器
    flvPlayer.load();
    
    if (props.autoplay) {
      await flvPlayer.play();
    }

    console.log(`FLV player initialized successfully for ${props.format}`);
  } catch (error) {
    console.error('Failed to create FLV player:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    emit('player-error', { message: errorMessage });
  }
}

// 播放
async function play() {
  if (flvPlayer && typeof flvPlayer.play === 'function') {
    try {
      await flvPlayer.play();
    } catch (error) {
      console.error('FLV play error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      emit('player-error', { message: errorMessage });
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
  console.log('Destroying FLV player');
  
  if (flvPlayer) {
    try {
      flvPlayer.unload();
      flvPlayer.detachMediaElement();
      flvPlayer.destroy();
      console.log('FLV player destroyed successfully');
    } catch (error) {
      console.warn('Error destroying FLV player:', error);
    }
    flvPlayer = null;
  }
  
  isReady.value = false;
}

// 获取播放器实例
function getPlayer() {
  return flvPlayer;
}

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
  </div>
</template>

<style scoped>
.flv-player {
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.native-video {
  width: 100%;
  height: auto;
  background: #000;
}

.native-video::-webkit-media-controls-panel {
  background-color: rgba(0, 0, 0, 0.8);
}
</style>