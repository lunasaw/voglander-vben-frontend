<script lang="ts" setup>
import type { BasePlayerProps, BasePlayerEmits } from './BasePlayer.vue';

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import videojs from 'video.js';

import 'video.js/dist/video-js.css';

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
let player: any = null;
const isReady = ref(false);
const retryCount = ref(0);
const maxRetries = 3;

// 根据格式获取Video.js支持的类型
function getVideoType(format: string, url: string): string {
  switch (format) {
    case 'hls': {
      return 'application/x-mpegURL';
    }
    case 'httpFmp4':
    case 'wsFmp4': {
      return 'video/mp4';
    }
    case 'httpTs':
    case 'wsTs': {
      return 'video/mp2t';
    }
    default: {
      // 尝试从URL扩展名推断
      if (url.includes('.m3u8')) return 'application/x-mpegURL';
      if (url.includes('.ts')) return 'video/mp2t';
      if (url.includes('.mp4')) return 'video/mp4';
      return 'video/mp4';
    }
  }
}

// 初始化Video.js播放器
async function initPlayer() {
  // 等待多个周期确保DOM完全准备好
  await nextTick();
  await nextTick();
  
  if (!videoRef.value) {
    retryCount.value++;
    console.error(`Video element not found, retry ${retryCount.value}/${maxRetries}...`);
    
    if (retryCount.value <= maxRetries) {
      // 重试机制
      setTimeout(() => {
        initPlayer();
      }, 100 * retryCount.value); // 递增延迟
    } else {
      console.error('Video element still not found after all retries');
      emit('player-error', { message: 'Video element not found in DOM after retries' });
    }
    return;
  }

  console.log(`Initializing Video.js player for ${props.format}`);
  
  // 重置重试计数
  retryCount.value = 0;
  
  // 额外等待确保DOM稳定
  await new Promise(resolve => setTimeout(resolve, 100));

  // 为Video.js创建唯一ID
  const uniqueId = `vjs-player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  videoRef.value.id = uniqueId;
  videoRef.value.className = 'video-js vjs-default-skin';
  videoRef.value.dataset.setup = '{}';

  // 根据格式配置Video.js选项
  const options: any = {
    controls: props.controls,
    autoplay: props.autoplay,
    fluid: props.fluid,
    responsive: true,
    playbackRates: [0.5, 1, 1.25, 1.5, 2],
    sources: [
      {
        src: props.url,
        type: getVideoType(props.format, props.url),
      },
    ],
    techOrder: ['html5'],
    liveui: !['httpFmp4', 'wsFmp4'].includes(props.format),
    preload: 'auto',
    restoreEl: false,
  };

  // 对于TS格式的特殊处理
  if (props.format === 'httpTs' || props.format === 'wsTs') {
    const supportedTypes = [];
    const testTypes = [
      'video/mp2t',
      'application/x-mpegts',
      'video/MP2T',
      'video/x-mpegts',
    ];

    for (const mimeType of testTypes) {
      const canPlay = videoRef.value.canPlayType(mimeType);
      if (canPlay === 'probably' || canPlay === 'maybe') {
        supportedTypes.push({ src: props.url, type: mimeType });
      }
    }

    if (supportedTypes.length === 0) {
      supportedTypes.push(
        { src: props.url, type: 'video/mp2t' },
        { src: props.url, type: 'application/x-mpegts' },
      );
    }

    options.sources = supportedTypes;
    options.liveui = true;
    options.preload = 'metadata';
    options.html5 = {
      nativeVideoTracks: false,
      nativeAudioTracks: false,
      nativeTextTracks: false,
    };
  }

  try {
    player = videojs(videoRef.value, options);

    // 错误处理
    player.on('error', () => {
      const error = player?.error();
      console.error('Video.js error:', error);
      
      const errorCode = error?.code;
      const errorMessage = error?.message || 'Unknown Video.js error';
      
      if (props.format === 'httpTs' || props.format === 'wsTs') {
        if (errorCode === 4) {
          emit('format-not-supported', {
            format: props.format,
            message: 'Browser does not support this TS stream format',
          });
          return;
        }
      }
      
      emit('player-error', { code: errorCode, message: errorMessage });
    });

    // 播放器就绪
    player.ready(() => {
      console.log(`Video.js player ready for ${props.format}`);
      isReady.value = true;
      emit('player-ready');
    });

    console.log(`Video.js player initialized successfully for ${props.format}`);
  } catch (error) {
    console.error('Failed to create Video.js player:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    emit('player-error', { message: errorMessage });
  }
}

// 播放
async function play() {
  if (player && typeof player.play === 'function') {
    try {
      await player.play();
    } catch (error) {
      console.error('Video.js play error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      emit('player-error', { message: errorMessage });
    }
  }
}

// 暂停
function pause() {
  if (player && typeof player.pause === 'function') {
    player.pause();
  }
}

// 销毁播放器
function destroy() {
  console.log('Destroying Video.js player');
  
  if (player) {
    try {
      // 完整的Video.js清理序列
      if (typeof player.pause === 'function') {
        player.pause();
      }
      if (typeof player.off === 'function') {
        player.off();
      }
      if (typeof player.reset === 'function') {
        player.reset();
      }
      
      player.dispose();
      console.log('Video.js player disposed successfully');
    } catch (error) {
      console.warn('Error disposing Video.js player:', error);
    }
    player = null;
  }
  
  isReady.value = false;
}

// 获取播放器实例
function getPlayer() {
  return player;
}

onMounted(async () => {
  // 确保组件完全挂载后再初始化
  await nextTick();
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
  <div class="videojs-player">
    <video
      ref="videoRef"
      class="video-js vjs-default-skin"
      :width="width"
      :height="height"
      data-setup="{}"
    >
      <p class="vjs-no-js">
        要观看此视频，请启用 JavaScript，并考虑升级到支持
        <a href="https://videojs.com/html5-video-support/" target="_blank">
          HTML5 视频
        </a>
        的网络浏览器。
      </p>
    </video>
  </div>
</template>

<style scoped>
.videojs-player {
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

/* Video.js 样式覆盖 */
:deep(.video-js) {
  width: 100% !important;
  height: auto !important;
}

:deep(.vjs-big-play-button) {
  font-size: 2.5em;
  line-height: 2.3;
  height: 2.3em;
  width: 2.3em;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.45);
  border: none;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

:deep(.vjs-control-bar) {
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
}

:deep(.vjs-progress-control .vjs-progress-holder) {
  height: 6px;
}

:deep(.vjs-progress-control .vjs-play-progress) {
  background-color: #1890ff;
}

:deep(.vjs-progress-control .vjs-load-progress) {
  background: rgba(255, 255, 255, 0.3);
}

:deep(.vjs-progress-control .vjs-progress-holder .vjs-load-progress div) {
  background: rgba(255, 255, 255, 0.2);
}
</style>