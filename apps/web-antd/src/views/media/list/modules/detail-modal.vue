<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { computed, ref } from 'vue';

import { Modal } from 'ant-design-vue';

interface Props {
  mediaInfo?: null | ZlmMediaApi.MediaInfoDetail;
  playUrls?: null | ZlmMediaApi.PlayUrls;
}

const props = defineProps<Props>();

const visible = ref(false);

// 计算属性
const hasPlayUrls = computed(() => {
  if (!props.playUrls) return false;
  const urls = props.playUrls;
  return (
    urls.rtsp ||
    urls.rtmp ||
    urls['http-flv'] ||
    urls['ws-flv'] ||
    urls.hls ||
    urls.webrtc
  );
});

const formatCreateTime = computed(() => {
  if (!props.mediaInfo?.createStamp) return '-';
  return new Date(props.mediaInfo.createStamp * 1000).toLocaleString();
});

const formatAliveTime = computed(() => {
  if (!props.mediaInfo?.aliveSecond) return '-';
  return `${Math.floor(props.mediaInfo.aliveSecond / 60)} 分钟`;
});

const formatBytesSpeed = computed(() => {
  if (!props.mediaInfo?.bytesSpeed) return '0 KB/s';
  return `${(props.mediaInfo.bytesSpeed / 1024).toFixed(2)} KB/s`;
});

const formatTotalBytes = computed(() => {
  if (!props.mediaInfo?.totalBytes) return '-';
  return `${(props.mediaInfo.totalBytes / 1024 / 1024).toFixed(2)} MB`;
});

// 方法
function show() {
  visible.value = true;
}

function handleClose() {
  visible.value = false;
}

// 导出方法供父组件调用
defineExpose({
  show,
});
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="`流信息详情 - ${mediaInfo?.app}/${mediaInfo?.stream}`"
    :width="800"
    :footer="null"
    @cancel="handleClose"
  >
    <div class="detail-content">
      <!-- 基本信息 -->
      <div class="info-section">
        <h4 class="section-title">基本信息</h4>
        <div class="info-box">
          <p><strong>协议:</strong> {{ mediaInfo?.schema }}</p>
          <p><strong>虚拟主机:</strong> {{ mediaInfo?.vhost }}</p>
          <p><strong>应用名:</strong> {{ mediaInfo?.app }}</p>
          <p><strong>流ID:</strong> {{ mediaInfo?.stream }}</p>
          <p>
            <strong>观看人数:</strong> {{ mediaInfo?.readerCount }} /
            {{ mediaInfo?.totalReaderCount }}
          </p>
        </div>
      </div>

      <!-- 播放地址 -->
      <div class="info-section">
        <h4 class="section-title">播放地址</h4>
        <div class="info-box">
          <p v-if="playUrls?.rtsp">
            <strong>RTSP:</strong>
            <code class="url-code">{{ playUrls.rtsp }}</code>
          </p>
          <p v-if="playUrls?.rtmp">
            <strong>RTMP:</strong>
            <code class="url-code">{{ playUrls.rtmp }}</code>
          </p>
          <p v-if="playUrls?.['http-flv']">
            <strong>HTTP-FLV:</strong>
            <code class="url-code">{{ playUrls['http-flv'] }}</code>
          </p>
          <p v-if="playUrls?.['ws-flv']">
            <strong>WS-FLV:</strong>
            <code class="url-code">{{ playUrls['ws-flv'] }}</code>
          </p>
          <p v-if="playUrls?.hls">
            <strong>HLS:</strong>
            <code class="url-code">{{ playUrls.hls }}</code>
          </p>
          <p v-if="playUrls?.webrtc">
            <strong>WebRTC:</strong>
            <code class="url-code">{{ playUrls.webrtc }}</code>
          </p>
          <p v-if="!hasPlayUrls" class="no-urls">暂无可用播放地址</p>
        </div>
      </div>

      <!-- 流详细信息 -->
      <div class="info-section">
        <h4 class="section-title">流详细信息</h4>
        <div class="info-box">
          <p><strong>产生源类型:</strong> {{ mediaInfo?.originTypeStr }}</p>
          <p><strong>产生源URL:</strong> {{ mediaInfo?.originUrl || '无' }}</p>
          <p><strong>创建时间:</strong> {{ formatCreateTime }}</p>
          <p><strong>存活时间:</strong> {{ formatAliveTime }}</p>
          <p><strong>数据传输速度:</strong> {{ formatBytesSpeed }}</p>
          <p v-if="mediaInfo?.totalBytes">
            <strong>总字节数:</strong> {{ formatTotalBytes }}
          </p>
          <p v-if="mediaInfo?.recordingHLS !== undefined">
            <strong>HLS录制:</strong>
            {{ mediaInfo.recordingHLS ? '启用' : '禁用' }}
          </p>
          <p v-if="mediaInfo?.recordingMP4 !== undefined">
            <strong>MP4录制:</strong>
            {{ mediaInfo.recordingMP4 ? '启用' : '禁用' }}
          </p>
        </div>
      </div>

      <!-- 音视频轨道 -->
      <div
        v-if="mediaInfo?.tracks && mediaInfo.tracks.length > 0"
        class="info-section"
      >
        <h4 class="section-title">音视频轨道</h4>
        <div
          v-for="(track, index) in mediaInfo.tracks"
          :key="index"
          class="track-box"
        >
          <p>
            <strong>轨道 {{ index + 1 }}:</strong>
            {{ track.codec_type === 0 ? '视频' : '音频' }}
          </p>
          <p><strong>编码:</strong> {{ track.codec_id_name || '未知' }}</p>

          <!-- 视频轨道信息 -->
          <template v-if="track.codec_type === 0">
            <p><strong>分辨率:</strong> {{ track.width }}x{{ track.height }}</p>
            <p><strong>帧率:</strong> {{ track.fps }} fps</p>
            <p><strong>GOP大小:</strong> {{ track.gop_size }} 帧</p>
            <p><strong>GOP间隔:</strong> {{ track.gop_interval_ms }} ms</p>
          </template>

          <!-- 音频轨道信息 -->
          <template v-else>
            <p><strong>采样率:</strong> {{ track.sample_rate || '未知' }} Hz</p>
            <p>
              <strong>采样位数:</strong> {{ track.sample_bit || '未知' }} bit
            </p>
            <p><strong>声道数:</strong> {{ track.channels }}</p>
          </template>

          <p><strong>总帧数:</strong> {{ track.frames }}</p>
          <p><strong>关键帧数:</strong> {{ track.key_frames || 0 }}</p>
          <p>
            <strong>就绪状态:</strong> {{ track.ready ? '就绪' : '未就绪' }}
          </p>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.detail-content {
  max-height: 500px;
  overflow-y: auto;
}

.info-section {
  margin-bottom: 16px;
}

.section-title {
  margin-bottom: 8px;
  color: #1890ff;
  font-size: 16px;
  font-weight: 600;
}

.info-box {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
}

.track-box {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.info-box p,
.track-box p {
  margin: 0 0 4px 0;
  line-height: 1.5;
}

.info-box p:last-child,
.track-box p:last-child {
  margin-bottom: 0;
}

.url-code {
  background: #e6f7ff;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 12px;
  font-family: monospace;
  word-break: break-all;
}

.no-urls {
  color: #999;
  font-style: italic;
}

strong {
  font-weight: 600;
  color: #333;
}
</style>
