<script lang="ts" setup>
import type { BasePlayerEmits, BasePlayerProps } from './BasePlayer.vue';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

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

    if (retryCount.value <= maxRetries) {
      // 重试机制
      setTimeout(() => {
        initPlayer();
      }, 100 * retryCount.value); // 递增延迟
    } else {
      emit('playerError', {
        message: 'Video element not found in DOM after retries',
      });
    }
    return;
  }

  // 重置重试计数
  retryCount.value = 0;

  // 额外等待确保DOM稳定
  await new Promise((resolve) => setTimeout(resolve, 100));

  // 为Video.js创建唯一ID
  const uniqueId = `vjs-player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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

      const errorCode = error?.code;
      const errorMessage = error?.message || 'Unknown Video.js error';

      if (
        (props.format === 'httpTs' || props.format === 'wsTs') &&
        errorCode === 4
      ) {
        emit('formatNotSupported', {
          format: props.format,
          message: 'Browser does not support this TS stream format',
        });
        return;
      }

      emit('playerError', { code: errorCode, message: errorMessage });
    });

    // 播放器就绪
    player.ready(() => {
      isReady.value = true;
      emit('playerReady');
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    emit('playerError', { message: errorMessage });
  }
}

// 播放
async function play() {
  if (player && typeof player.play === 'function') {
    try {
      await player.play();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      emit('playerError', { message: errorMessage });
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
    } catch {
      // Ignore dispose errors
    }
    player = null;
  }

  isReady.value = false;
}

// 获取播放器实例
function getPlayer() {
  return player;
}

// 监听props变化，重新初始化播放器
watch(
  () => [props.url, props.format],
  ([newUrl, newFormat], [oldUrl, oldFormat]) => {
    // 只有在已经初始化过且URL或格式发生变化时才重新初始化
    if (player && (newUrl !== oldUrl || newFormat !== oldFormat)) {
      destroy();
      // 延迟重新初始化，确保完全清理
      setTimeout(async () => {
        await nextTick();
        initPlayer();
      }, 100);
    }
  },
  { flush: 'post' },
);

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
  overflow: hidden;
  background: #000;
  border-radius: 8px;
}

/* Video.js 样式覆盖 */
:deep(.video-js) {
  width: 100% !important;
  height: auto !important;
}

:deep(.vjs-big-play-button) {
  top: 50%;
  left: 50%;
  width: 2.3em;
  height: 2.3em;
  font-size: 2.5em;
  line-height: 2.3;
  background-color: rgb(0 0 0 / 45%);
  border: none;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

:deep(.vjs-control-bar) {
  background: linear-gradient(transparent, rgb(0 0 0 / 70%));
}

:deep(.vjs-progress-control .vjs-progress-holder) {
  height: 6px;
}

:deep(.vjs-progress-control .vjs-play-progress) {
  background-color: #1890ff;
}

:deep(.vjs-progress-control .vjs-load-progress) {
  background: rgb(255 255 255 / 30%);
}

:deep(.vjs-progress-control .vjs-progress-holder .vjs-load-progress div) {
  background: rgb(255 255 255 / 20%);
}
</style>
