<script lang="ts" setup>
import type { BasePlayerProps, BasePlayerEmits } from './BasePlayer.vue';

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

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

// 检查HLS支持
function checkHlsSupport(): { supported: boolean; native: boolean } {
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

// 初始化HLS播放器
async function initPlayer() {
  if (!videoRef.value) {
    console.error('Video element not found');
    return;
  }

  console.log(`Initializing HLS player for ${props.format}`);
  
  // 确保DOM更新完成
  await nextTick();

  const hlsSupport = checkHlsSupport();
  
  if (!hlsSupport.supported) {
    emit('format-not-supported', {
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
      console.log('Using native HLS support');
      useNativeHls.value = true;
      
      videoRef.value.src = props.url;
      videoRef.value.load();

      videoRef.value.addEventListener('loadstart', () => {
        console.log('Native HLS loading started');
      });

      videoRef.value.addEventListener('canplay', () => {
        console.log('Native HLS can play');
        isReady.value = true;
        emit('player-ready');
      });

      videoRef.value.addEventListener('error', () => {
        const error = videoRef.value?.error;
        console.error('Native HLS error:', error);
        emit('player-error', { 
          code: error?.code,
          message: error?.message || 'Native HLS playback error' 
        });
      });

      if (props.autoplay) {
        videoRef.value.play().catch((error) => {
          console.log('Autoplay prevented:', error);
        });
      }
    } else {
      // 使用hls.js
      console.log('Using hls.js');
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
        console.log('HLS manifest parsed');
        isReady.value = true;
        emit('player-ready');
        
        if (props.autoplay) {
          videoRef.value?.play().catch((error) => {
            console.log('Autoplay prevented:', error);
          });
        }
      });

      hlsPlayer.on(Hls.Events.ERROR, (_event, data) => {
        console.error('HLS.js error:', data);
        
        if (data.fatal) {
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
              emit('player-error', { 
                message: `HLS fatal error: ${data.type} - ${data.details}` 
              });
              break;
            }
          }
        } else {
          console.warn('HLS non-fatal error:', data);
        }
      });
    }

    console.log(`HLS player initialized successfully for ${props.format}`);
  } catch (error) {
    console.error('Failed to create HLS player:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    emit('player-error', { message: errorMessage });
  }
}

// 播放
async function play() {
  if (videoRef.value) {
    try {
      await videoRef.value.play();
    } catch (error) {
      console.error('HLS play error:', error);
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
  console.log('Destroying HLS player');
  
  if (hlsPlayer && !useNativeHls.value) {
    try {
      hlsPlayer.destroy();
      console.log('HLS.js player destroyed successfully');
    } catch (error) {
      console.warn('Error destroying HLS player:', error);
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
  </div>
</template>

<style scoped>
.hls-player {
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