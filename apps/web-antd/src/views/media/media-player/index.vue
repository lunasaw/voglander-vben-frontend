<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import flvjs from 'flv.js';
import Hls from 'hls.js';
import videojs from 'video.js';

import 'video.js/dist/video-js.css';

interface Props {
  playUrls?: null | ZlmMediaApi.PlayUrls;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  controls?: boolean;
  fluid?: boolean;
  currentFormat?: string; // 当前播放的格式
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

const videoRef = ref<HTMLVideoElement>();
let player: any = null;
let flvPlayer: flvjs.Player | null = null;
let hlsPlayer: Hls | null = null;
let currentPlayerType: 'flv' | 'hls' | 'videojs' = 'videojs';
const isDestroying = ref(false); // 添加销毁状态标识

// 格式优先级配置 - 优先使用原生支持更好的格式
const formatPriority = [
  'hls',
  'httpFmp4',
  'wsFmp4',
  'httpFlv',
  'wsFlv',
  'httpTs',
  'wsTs',
  'webrtc',
  'rtmp',
  'rtsp',
];

// 检测播放格式并返回最佳播放URL，支持指定格式
function getBestPlayUrl(
  specifiedFormat?: string,
): null | { format: string; type: string; url: string } {
  if (!props.playUrls) return null;

  // 如果指定了格式，优先使用指定格式
  if (specifiedFormat) {
    const url = props.playUrls[specifiedFormat as keyof ZlmMediaApi.PlayUrls];
    if (url) {
      return {
        url,
        format: specifiedFormat,
        type: getVideoType(specifiedFormat, url),
      };
    }
  }

  // 使用当前格式（如果有）
  if (props.currentFormat) {
    const url =
      props.playUrls[props.currentFormat as keyof ZlmMediaApi.PlayUrls];
    if (url) {
      return {
        url,
        format: props.currentFormat,
        type: getVideoType(props.currentFormat, url),
      };
    }
  }

  // 默认按优先级选择
  for (const format of formatPriority) {
    const url = props.playUrls[format as keyof ZlmMediaApi.PlayUrls];
    if (url) {
      return { url, format, type: getVideoType(format, url) };
    }
  }
  return null;
}

// 根据格式获取Video.js支持的类型
function getVideoType(format: string, url: string): string {
  switch (format) {
    case 'hls': {
      return 'application/x-mpegURL';
    }
    case 'httpFlv':
    case 'wsFlv': {
      return 'video/x-flv';
    }
    case 'httpFmp4':
    case 'wsFmp4': {
      return 'video/mp4';
    }
    case 'httpTs':
    case 'wsTs': {
      // TS流在不同浏览器中支持程度不同，尝试多种MIME类型
      return 'video/mp2t'; // 主要类型
    }
    case 'rtmp': {
      return 'rtmp/mp4';
    }
    case 'rtsp': {
      return 'rtsp/mp4';
    }
    case 'webrtc': {
      return 'application/x-webrtc';
    }
    default: {
      // 尝试从URL扩展名推断
      if (url.includes('.m3u8')) return 'application/x-mpegURL';
      if (url.includes('.flv')) return 'video/x-flv';
      if (url.includes('.ts')) return 'video/mp2t';
      if (url.includes('.mp4')) return 'video/mp4';
      return 'video/mp4';
    }
  }
}

// 播放指定格式
async function playFormat(format: string) {
  if (!props.playUrls) return;

  const url = props.playUrls[format as keyof ZlmMediaApi.PlayUrls];
  if (!url) {
    console.warn(`Format ${format} not available`);
    return;
  }

  // 先检查浏览器兼容性，在销毁播放器之前
  if (!isFormatSupported(format)) {
    console.warn(`Format ${format} is not supported in browser`);
    showUnsupportedMessage(format);
    // 不支持的格式不进行任何播放器操作，保持当前状态
    return;
  }

  console.log(`Playing specified format: ${format} - ${url}`);

  isDestroying.value = true;

  // 先设置目标播放器类型，避免UI闪烁
  const targetPlayerType = getPlayerTypeForFormat(format);
  currentPlayerType = targetPlayerType;

  destroyPlayer();
  await nextTick();
  // 增加延迟确保Video.js完全清理完成
  await new Promise(resolve => setTimeout(resolve, 100));

  const playInfo = { url, format, type: getVideoType(format, url) };

  try {
    switch (format) {
      case 'hls': {
        await initHlsPlayer(url);
        break;
      }
      case 'httpFlv':
      case 'wsFlv': {
        await initFlvPlayer(url, format);
        break;
      }
      case 'httpFmp4': {
        // HTTP-fMP4 可以用Video.js播放
        await initVideoJsPlayer(playInfo);
        break;
      }
      case 'httpTs':
      case 'wsTs': {
        console.log(`Attempting to play TS format: ${format}`);
        await initVideoJsPlayer(playInfo);
        break;
      }
      case 'wsFmp4': {
        // WS-fMP4 直接用Video.js处理WebSocket流
        await initVideoJsPlayer(playInfo);
        break;
      }
      default: {
        await initVideoJsPlayer(playInfo);
      }
    }

    // 确保播放器初始化完成后状态正确
    console.log(`Player initialized: ${format}, type: ${currentPlayerType}`);
  } catch (error) {
    console.error(`Failed to play ${format}:`, error);

    // 获取错误信息
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 对于TS格式，给出特殊的错误提示
    if (format === 'httpTs' || format === 'wsTs') {
      showUnsupportedMessage(format, errorMessage);
    } else if (isFormatSupported(format)) {
      // 其他支持的格式尝试回退到Video.js
      try {
        await initVideoJsPlayer(playInfo);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        const fallbackErrorMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        showUnsupportedMessage(format, fallbackErrorMessage);
      }
    } else {
      showUnsupportedMessage(format, errorMessage);
    }
  } finally {
    isDestroying.value = false;
  }
}

// 根据格式获取播放器类型
function getPlayerTypeForFormat(format: string): 'flv' | 'hls' | 'videojs' {
  if (format === 'hls') return 'hls';
  if (format === 'httpFlv' || format === 'wsFlv') return 'flv';
  return 'videojs';
}

// 检查格式是否在浏览器中支持
function isFormatSupported(format: string): boolean {
  const fullySupported = ['hls', 'httpFlv', 'wsFlv', 'httpFmp4'];

  // WS-fMP4 需要专门的WebSocket播放器，标准Video.js不支持
  if (format === 'wsFmp4') {
    return false; // 需要专门的WebSocket fMP4播放器如mpegts.js或Jessibuca
  }

  // WebRTC 需要特殊的WebRTC客户端
  if (format === 'webrtc') {
    return false; // 暂时标记为不支持，需要专门的WebRTC实现
  }

  // RTMP 和 RTSP 不能直接在浏览器播放
  if (format === 'rtmp' || format === 'rtsp') {
    return false;
  }

  // HTTP-TS 和 WS-TS 格式 - 放宽检查，让播放器尝试播放
  if (format === 'httpTs' || format === 'wsTs') {
    // 大部分现代浏览器都支持TS格式，即使canPlayType返回空字符串
    // 我们允许尝试播放，让播放器自己处理兼容性
    return false;
  }

  return fullySupported.includes(format);
}

// 显示不支持格式的消息
function showUnsupportedMessage(format: string, errorDetails?: string) {
  const messages: Record<string, string> = {
    rtmp: 'RTMP协议需要Flash或专用播放器，浏览器不支持直接播放。建议使用HLS或HTTP-FLV格式。',
    rtsp: 'RTSP协议需要专用播放器，浏览器不支持直接播放。建议使用HLS或HTTP-FLV格式。',
    webrtc:
      'WebRTC需要专门的客户端实现，当前播放器暂不支持。建议使用HLS或HTTP-FLV格式。',
    wsFmp4:
      'WS-fMP4需要专门的WebSocket播放器支持（如mpegts.js或Jessibuca），当前播放器暂不支持。建议使用HTTP-fMP4或HLS格式。',
    httpTs:
      '当前浏览器不支持HTTP-TS格式的原生播放。TS格式需要特殊的解码器支持，建议使用HLS或HTTP-FLV格式以获得更好的兼容性。',
    wsTs: '当前浏览器不支持WS-TS格式的原生播放。TS格式需要特殊的解码器支持，建议使用HLS或HTTP-FLV格式以获得更好的兼容性。',
  };

  let message =
    messages[format] || `${format.toUpperCase()}格式暂不支持浏览器播放`;

  if (errorDetails && (format === 'httpTs' || format === 'wsTs')) {
    message += ` 错误详情: ${errorDetails}`;
  }

  console.warn(message);

  // 发送事件给父组件显示提示
  emit('format-not-supported', { format, message });
}

// 初始化播放器
async function initPlayer() {
  if (!videoRef.value) return;

  const playInfo = getBestPlayUrl();
  if (!playInfo) {
    console.warn('No available play URL found');
    return;
  }

  console.log(`Initializing player for ${playInfo.format}: ${playInfo.url}`);

  try {
    // 根据格式选择合适的播放器
    if (playInfo.format === 'hls') {
      await initHlsPlayer(playInfo.url);
    } else if (playInfo.format === 'httpFlv' || playInfo.format === 'wsFlv') {
      await initFlvPlayer(playInfo.url, playInfo.format);
    } else {
      await initVideoJsPlayer(playInfo);
    }
  } catch (error) {
    console.error('Failed to initialize video player:', error);
    // 回退到Video.js
    await initVideoJsPlayer(playInfo);
  }
}

// 初始化HLS播放器 - 优先使用原生video支持
async function initHlsPlayer(url: string) {
  if (!videoRef.value) return;

  console.log('Initializing HLS player');

  // 首先检查浏览器是否原生支持HLS
  if (
    videoRef.value.canPlayType('application/vnd.apple.mpegurl') ||
    videoRef.value.canPlayType('application/x-mpegURL')
  ) {
    // 使用原生HTML5播放HLS
    console.log('Using native HLS support via Video.js');
    currentPlayerType = 'videojs';
    await initVideoJsPlayer({
      url,
      format: 'hls',
      type: 'application/x-mpegURL',
    });
    return;
  }

  // 不支持原生HLS，使用hls.js
  if (!Hls.isSupported()) {
    console.warn('HLS is not supported, fallback to Video.js');
    await initVideoJsPlayer({
      url,
      format: 'hls',
      type: 'application/x-mpegURL',
    });
    return;
  }

  currentPlayerType = 'hls';
  
  // 确保video元素处于干净状态
  if (videoRef.value) {
    videoRef.value.className = 'native-video';
    videoRef.value.controls = props.controls;
    if (props.autoplay) {
      videoRef.value.autoplay = true;
    }
  }

  hlsPlayer = new Hls({
    enableWorker: false,
    lowLatencyMode: true,
    backBufferLength: 90,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
  });

  hlsPlayer.loadSource(url);
  hlsPlayer.attachMedia(videoRef.value);

  hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
    console.log('HLS manifest parsed, starting playback');
    if (props.autoplay) {
      videoRef.value?.play().catch((error) => {
        console.log('Autoplay prevented:', error);
      });
    }
  });

  hlsPlayer.on(Hls.Events.ERROR, (_event, data) => {
    console.error('HLS error:', data);
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
          tryNextSource();
          break;
        }
      }
    }
  });

  console.log('HLS player initialized successfully');
}

// 初始化FLV播放器
async function initFlvPlayer(url: string, format: string) {
  if (!videoRef.value) return;

  console.log(`Initializing FLV player for ${format}`);
  
  currentPlayerType = 'flv';

  // 确保video元素处于干净状态
  if (videoRef.value) {
    videoRef.value.className = 'native-video';
    videoRef.value.controls = props.controls;
    if (props.autoplay) {
      videoRef.value.autoplay = true;
    }
  }

  const flvConfig: flvjs.MediaDataSource = {
    type: 'flv',
    url,
    isLive: true,
    cors: true,
    withCredentials: false,
    hasAudio: true,
    hasVideo: true,
  };

  // WebSocket FLV配置
  if (format === 'wsFlv') {
    flvConfig.type = 'flv';
    flvConfig.isLive = true;
  }

  flvPlayer = flvjs.createPlayer(flvConfig);
  flvPlayer.attachMediaElement(videoRef.value);

  flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
    console.log(`${format} loading complete`);
  });

  flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail) => {
    console.error(`${format} error:`, errorType, errorDetail);
    tryNextSource();
  });

  try {
    flvPlayer.load();
    if (props.autoplay) {
      await flvPlayer.play();
    }
    console.log(`${format} player initialized successfully`);
  } catch (error) {
    console.error(`${format} play error:`, error);
    tryNextSource();
  }
}

// 初始化Video.js播放器 - 用于MP4和原生支持的格式
async function initVideoJsPlayer(playInfo: {
  format: string;
  type: string;
  url: string;
}) {
  if (!videoRef.value) return;

  console.log(
    `Initializing Video.js for ${playInfo.format}, type: ${playInfo.type}`,
  );

  // 确保设置正确的播放器类型
  currentPlayerType = 'videojs';

  // 确保DOM更新完成
  await nextTick();

  // 确保video元素在DOM中并且引用正确
  if (!videoRef.value || !videoRef.value.parentNode) {
    console.error('Video element not found in DOM');
    return;
  }

  // 清理可能的残留状态
  if (Object.hasOwn(videoRef.value.dataset, 'vjsPlayer')) {
    console.log('Cleaning up existing Video.js instance');
    delete videoRef.value.dataset.vjsPlayer;
  }

  // 确保video元素有正确的class和属性
  if (videoRef.value) {
    videoRef.value.className = 'video-js vjs-default-skin';
    videoRef.value.dataset.setup = '{}';
    // 先设置一个空的src，然后load
    videoRef.value.src = '';
    videoRef.value.load();

    // 移除任何可能影响播放器初始化的属性
    videoRef.value.removeAttribute('controls');
    videoRef.value.removeAttribute('autoplay');
  }

  // 再等待一个tick确保DOM已更新
  await nextTick();

  // 根据格式调整Video.js配置
  const options: any = {
    controls: props.controls,
    autoplay: props.autoplay,
    fluid: props.fluid,
    responsive: true,
    playbackRates: [0.5, 1, 1.25, 1.5, 2],
    sources: [],
    techOrder: ['html5'],
    liveui: !['httpFmp4', 'wsFmp4'].includes(playInfo.format), // fMP4不是直播
    preload: 'auto',
    // 添加确保播放器完全重新初始化的选项
    restoreEl: false,
  };

  // 对于TS格式，根据浏览器支持选择MIME类型
  if (playInfo.format === 'httpTs' || playInfo.format === 'wsTs') {
    const supportedTypes = [];

    // 检查浏览器支持的MIME类型
    const testTypes = [
      'video/mp2t',
      'application/x-mpegts',
      'video/MP2T',
      'video/x-mpegts',
    ];

    if (videoRef.value) {
      for (const mimeType of testTypes) {
        const canPlay = videoRef.value.canPlayType(mimeType);
        if (canPlay === 'probably' || canPlay === 'maybe') {
          supportedTypes.push({ src: playInfo.url, type: mimeType });
        }
      }
    }

    // 如果没有找到明确支持的类型，尝试所有常用类型
    if (supportedTypes.length === 0) {
      console.log(
        'Browser canPlayType check failed, trying common TS MIME types',
      );
      supportedTypes.push(
        { src: playInfo.url, type: 'video/mp2t' },
        { src: playInfo.url, type: 'application/x-mpegts' },
      );
    }

    options.sources = supportedTypes;
    options.liveui = true;
    options.preload = 'metadata';

    // TS流的特殊配置
    options.html5 = {
      nativeVideoTracks: false,
      nativeAudioTracks: false,
      nativeTextTracks: false,
    };

    console.log(
      `Using MIME types for ${playInfo.format}:`,
      supportedTypes.map((s) => s.type),
    );
  } else {
    // 其他格式使用单一源
    options.sources = [
      {
        src: playInfo.url,
        type: playInfo.type,
      },
    ];
  }

  console.log('Video.js options:', options);
  console.log('Video element state before init:', {
    element: videoRef.value,
    parentNode: videoRef.value?.parentNode,
    className: videoRef.value?.className,
    dataset: videoRef.value?.dataset,
  });

  try {
    player = videojs(videoRef.value, options);

    // 添加错误处理
    player.on('error', () => {
      const error = player?.error();
      console.error('Video.js error:', error);

      // 对于TS格式的特殊处理
      if (playInfo.format === 'httpTs' || playInfo.format === 'wsTs') {
        const errorCode = error?.code;
        const errorMessage = error?.message || 'Unknown error';
        console.error(
          `TS format error - Code: ${errorCode}, Message: ${errorMessage}`,
        );

        if (errorCode === 4) {
          // MEDIA_ERR_SRC_NOT_SUPPORTED
          showUnsupportedMessage(
            playInfo.format,
            'MEDIA_ERR_SRC_NOT_SUPPORTED - Browser does not support this TS stream format',
          );
          return;
        }
      }

      tryNextSource();
    });

    // 播放器就绪
    player.ready(() => {
      console.log(`Video.js player is ready for ${playInfo.format}`);
    });

    // 添加加载事件监听
    player.on('loadstart', () => {
      console.log(`Video.js started loading ${playInfo.format}`);
    });

    player.on('canplay', () => {
      console.log(`Video.js can play ${playInfo.format}`);
    });
  } catch (error) {
    console.error('Failed to create Video.js player:', error);
    throw error;
  }
}

// 尝试下一个可用的播放源
function tryNextSource() {
  if (!props.playUrls) return;

  const currentPlayInfo = getBestPlayUrl();
  if (!currentPlayInfo) return;

  let foundCurrent = false;
  let currentSource = '';

  // 获取当前播放源
  if (currentPlayerType === 'videojs' && player) {
    currentSource = player.currentSrc();
  } else if (currentPlayerType === 'hls' && hlsPlayer) {
    currentSource = hlsPlayer.url || '';
  } else if (currentPlayerType === 'flv' && flvPlayer) {
    currentSource = currentPlayInfo.url;
  }

  for (const format of formatPriority) {
    const url = props.playUrls[format as keyof ZlmMediaApi.PlayUrls];
    if (!url) continue;

    if (foundCurrent) {
      // 找到当前源之后的下一个源
      console.log(`Switching to ${format}: ${url}`);
      destroyPlayer();
      setTimeout(() => initPlayer(), 100);
      return;
    }

    if (url === currentSource) {
      foundCurrent = true;
    }
  }

  console.warn('No alternative sources available');
}

// 销毁播放器
function destroyPlayer() {
  console.log('Destroying player, current type:', currentPlayerType);

  if (player) {
    try {
      // 更彻底的Video.js清理
      console.log('Disposing Video.js player...');
      
      // 停止播放
      if (typeof player.pause === 'function') {
        player.pause();
      }
      
      // 清理所有事件监听器
      if (typeof player.off === 'function') {
        player.off();
      }
      
      // 重置源
      if (typeof player.reset === 'function') {
        player.reset();
      }
      
      // 彻底销毁
      player.dispose();
      
      console.log('Video.js player disposed successfully');
    } catch (error) {
      console.warn('Error disposing Video.js player:', error);
    }
    player = null;
  }

  if (hlsPlayer) {
    try {
      hlsPlayer.destroy();
    } catch (error) {
      console.warn('Error destroying HLS player:', error);
    }
    hlsPlayer = null;
  }

  if (flvPlayer) {
    try {
      flvPlayer.unload();
      flvPlayer.detachMediaElement();
      flvPlayer.destroy();
    } catch (error) {
      console.warn('Error destroying FLV player:', error);
    }
    flvPlayer = null;
  }

  // 彻底清理video元素的状态
  if (videoRef.value) {
    try {
      console.log('Cleaning video element...');
      
      // 停止当前播放
      videoRef.value.pause();
      
      // 特别针对Video.js的清理
      if (currentPlayerType === 'videojs') {
        console.log('Performing Video.js specific cleanup...');
        
        // 清理Video.js可能添加的所有内容
        const vjsElements = videoRef.value.querySelectorAll('.vjs-*');
        vjsElements.forEach(el => el.remove());
        
        // 清理可能的子元素
        while (videoRef.value.firstChild) {
          videoRef.value.removeChild(videoRef.value.firstChild);
        }
      }

      // 移除所有可能的属性
      const attributesToRemove = ['data-vjs-player', 'id', 'data-setup'];

      attributesToRemove.forEach((attr) => {
        if (videoRef.value?.hasAttribute(attr)) {
          videoRef.value.removeAttribute(attr);
        }
      });

      // 重置src和清理
      videoRef.value.src = '';
      videoRef.value.srcObject = null;
      videoRef.value.load();

      // 移除可能的Video.js添加的类
      const classesToRemove = [
        'vjs-tech',
        'vjs-user-inactive',
        'vjs-user-active',
        'vjs-has-started',
        'vjs-paused',
        'vjs-playing',
        'vjs-ended',
        'vjs-seeking',
        'vjs-waiting',
        'vjs-audio-only-mode',
        'vjs-controls-disabled',
        'vjs-controls-enabled',
        'vjs-workinghover',
        'vjs-v7',
        'vjs-html5',
        'vjs-ready',
      ];
      classesToRemove.forEach((cls) => {
        videoRef.value?.classList.remove(cls);
      });

      // 清理所有可能的Video.js数据属性
      if (videoRef.value.dataset) {
        Object.keys(videoRef.value.dataset).forEach((key) => {
          delete videoRef.value!.dataset[key];
        });
      }

      // 移除所有自定义属性
      const attributesToRemoveTwo = [
        'data-vjs-player',
        'data-setup',
        'id',
        'data-reactid',
        'tabindex',
        'role',
        'aria-label',
      ];
      attributesToRemoveTwo.forEach((attr) => {
        if (videoRef.value?.hasAttribute(attr)) {
          videoRef.value.removeAttribute(attr);
        }
      });

      // 重置基本样式和类
      videoRef.value.className = '';
      videoRef.value.style.cssText = '';
      
      console.log('Video element cleaned successfully');
    } catch (error) {
      console.warn('Error cleaning video element:', error);
    }
  }

  console.log('Player destroyed');
  // 不要重置 currentPlayerType，让它保持目标类型
}

// 重新初始化播放器
async function reinitPlayer() {
  destroyPlayer();
  await nextTick();
  initPlayer();
}

// 监听播放地址变化
watch(
  () => props.playUrls,
  () => {
    if (props.playUrls) {
      reinitPlayer();
    } else {
      destroyPlayer();
    }
  },
  { deep: true },
);

onMounted(() => {
  nextTick(() => {
    if (props.playUrls) {
      initPlayer();
    }
  });
});

onBeforeUnmount(() => {
  destroyPlayer();
  isDestroying.value = false;
});

// 暴露方法给父组件
defineExpose({
  player: () => player,
  reinit: reinitPlayer,
  destroy: destroyPlayer,
  playFormat,
});
</script>

<template>
  <div class="media-player-container">
    <div v-if="playUrls && getBestPlayUrl()" class="video-wrapper">
      <video
        ref="videoRef"
        :class="
          currentPlayerType === 'videojs'
            ? 'video-js vjs-default-skin'
            : 'native-video'
        "
        preload="auto"
        :width="width"
        :height="height"
        :data-setup="currentPlayerType === 'videojs' ? '{}' : undefined"
        :style="{
          opacity: isDestroying ? '0.7' : '1',
          transition: 'opacity 0.2s ease',
        }"
      >
        <p class="vjs-no-js">
          要观看此视频，请启用 JavaScript，并考虑升级到支持
          <a href="https://videojs.com/html5-video-support/" target="_blank">
            HTML5 视频
          </a>
          的网络浏览器。
        </p>
      </video>

      <!-- 加载指示器 -->
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
.media-player-container {
  width: 100%;
  position: relative;
}

.video-wrapper {
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

/* Video.js 样式覆盖 */
:deep(.video-js) {
  width: 100% !important;
  height: auto !important;
}

/* 原生视频播放器样式 */
.native-video {
  width: 100%;
  height: auto;
  background: #000;
}

.native-video::-webkit-media-controls-panel {
  background-color: rgba(0, 0, 0, 0.8);
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
