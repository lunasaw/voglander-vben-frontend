<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { computed } from 'vue';

import { Modal } from 'ant-design-vue';

import MediaPlayerManager from '#/views/media/media-player/MediaPlayerManager.vue';

interface MediaInfo {
  schema: string;
  app: string;
  stream: string;
  vhost?: string;
  serverId?: string;
  description?: string;
}

interface PlayUrlsResponse {
  code: number;
  data: ZlmMediaApi.PlayUrls;
  msg: string;
  result: string;
}

interface Props {
  open?: boolean;
  mediaInfo?: MediaInfo | null;
  playUrls?: null | PlayUrlsResponse | ZlmMediaApi.PlayUrls;
  title?: string;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  controls?: boolean;
  fluid?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  mediaInfo: null,
  playUrls: null,
  title: '视频播放',
  width: 900,
  height: 400,
  autoplay: true,
  controls: true,
  fluid: true,
  loading: false,
});

const emit = defineEmits<{
  close: [];
  formatNotSupported: [data: { format: string; message: string }];
}>();

// 计算播放地址
const computedPlayUrls = computed(() => {
  if (!props.playUrls) return null;

  // 如果是API响应格式，提取data部分
  if (
    typeof props.playUrls === 'object' &&
    'code' in props.playUrls &&
    'data' in props.playUrls
  ) {
    return (props.playUrls as PlayUrlsResponse).data;
  }

  // 如果是直接的播放地址对象
  return props.playUrls as ZlmMediaApi.PlayUrls;
});

// 计算弹窗标题
const modalTitle = computed(() => {
  if (props.title && props.title !== '视频播放') {
    return props.title;
  }

  if (props.mediaInfo) {
    return `播放: ${props.mediaInfo.schema}/${props.mediaInfo.app}/${props.mediaInfo.stream}`;
  }

  return '视频播放';
});

// 关闭弹窗
function handleClose() {
  emit('close');
}

// 处理播放器格式不支持
function handleFormatNotSupported(data: { format: string; message: string }) {
  emit('formatNotSupported', data);
}
</script>

<template>
  <Modal
    :open="open"
    :title="modalTitle"
    :width="width"
    :footer="null"
    :mask-closable="false"
    destroy-on-close
    @cancel="handleClose"
  >
    <div class="media-player-container">
      <!-- 媒体信息显示 -->
      <div
        v-if="mediaInfo"
        class="media-info mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3"
      >
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span class="font-medium text-gray-600">协议:</span>
            <span class="ml-2">{{ mediaInfo.schema }}</span>
          </div>
          <div>
            <span class="font-medium text-gray-600">应用名称:</span>
            <span class="ml-2">{{ mediaInfo.app }}</span>
          </div>
          <div>
            <span class="font-medium text-gray-600">流ID:</span>
            <span class="ml-2">{{ mediaInfo.stream }}</span>
          </div>
          <div>
            <span class="font-medium text-gray-600">虚拟主机:</span>
            <span class="ml-2">{{
              mediaInfo.vhost || '__defaultVhost__'
            }}</span>
          </div>
          <div v-if="mediaInfo.serverId">
            <span class="font-medium text-gray-600">节点ID:</span>
            <span class="ml-2">{{ mediaInfo.serverId }}</span>
          </div>
          <div v-if="mediaInfo.description" class="col-span-2">
            <span class="font-medium text-gray-600">描述:</span>
            <span class="ml-2">{{ mediaInfo.description }}</span>
          </div>
        </div>
      </div>

      <!-- 播放器区域 -->
      <div class="player-wrapper overflow-hidden rounded-lg bg-black">
        <!-- 加载状态 -->
        <div
          v-if="loading"
          class="flex min-h-[400px] items-center justify-center"
        >
          <div class="text-white">正在加载播放器...</div>
        </div>

        <!-- 播放器组件 -->
        <MediaPlayerManager
          v-else-if="computedPlayUrls"
          :play-urls="computedPlayUrls"
          width="100%"
          :height="height"
          :autoplay="autoplay"
          :controls="controls"
          :fluid="fluid"
          @format-not-supported="handleFormatNotSupported"
        />

        <!-- 无播放地址状态 -->
        <div
          v-else
          class="flex min-h-[400px] items-center justify-center p-8 text-center text-gray-500"
        >
          <div>
            <p class="mb-2 text-lg">暂无可播放的视频流</p>
            <p class="text-sm">请检查流媒体地址是否正确或稍后重试</p>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.media-player-container {
  max-height: 80vh;
  overflow-y: auto;
}
</style>
