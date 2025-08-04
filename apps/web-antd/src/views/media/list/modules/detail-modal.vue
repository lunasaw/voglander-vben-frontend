<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { computed, ref } from 'vue';

import { Copy, RotateCw } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import MediaPlayer from '../../media-player/index.vue';

interface Props {
  mediaInfo?: null | ZlmMediaApi.MediaInfoDetail;
  playUrls?: null | ZlmMediaApi.PlayUrls;
  onRefresh?: () => Promise<void>;
}

const props = defineProps<Props>();

const visible = ref(false);
const playerRef = ref();
const currentPlayingFormat = ref('');
const isRefreshing = ref(false);

// 计算属性
const hasPlayUrls = computed(() => {
  if (!props.playUrls) return false;
  const urls = props.playUrls;
  return (
    urls.rtsp ||
    urls.rtmp ||
    urls.httpFlv ||
    urls.wsFlv ||
    urls.hls ||
    urls.webrtc ||
    urls.httpTs ||
    urls.wsTs ||
    urls.httpFmp4 ||
    urls.wsFmp4
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
  // 停止播放器
  if (playerRef.value && playerRef.value.destroy) {
    playerRef.value.destroy();
  }

  visible.value = false;
  currentPlayingFormat.value = '';
}

// 播放指定格式
function playFormat(format: string, _url: string) {
  // 先校验格式支持
  if (!isFormatSupported(format)) {
    message.warning({
      content: `当前浏览器不支持 ${getFormatDisplayName(format)} 格式播放`,
      duration: 5,
    });
    return;
  }

  if (playerRef.value && playerRef.value.playFormat) {
    // 对于FLV格式之间的切换，显示切换提示
    const isFLVSwitch =
      (format === 'httpFlv' || format === 'wsFlv') &&
      (currentPlayingFormat.value === 'httpFlv' ||
        currentPlayingFormat.value === 'wsFlv') &&
      currentPlayingFormat.value !== format;

    if (isFLVSwitch) {
      message.loading({
        content: `正在切换到 ${getFormatDisplayName(format)}...`,
        key: 'format-switch',
        duration: 0, // 不自动消失
      });
    }

    currentPlayingFormat.value = format;
    playerRef.value.playFormat(format);

    // 延迟隐藏加载提示
    if (isFLVSwitch) {
      setTimeout(() => {
        message.destroy('format-switch');
        message.success({
          content: `已切换到 ${getFormatDisplayName(format)}`,
          duration: 2,
        });
      }, 1000);
    }
  }
}

// 获取格式显示名称
function getFormatDisplayName(format: string): string {
  const formatNames: Record<string, string> = {
    rtsp: 'RTSP',
    rtmp: 'RTMP',
    httpFlv: 'HTTP-FLV',
    wsFlv: 'WS-FLV',
    hls: 'HLS',
    webrtc: 'WebRTC',
    httpTs: 'HTTP-TS',
    wsTs: 'WS-TS',
    httpFmp4: 'HTTP-fMP4',
    wsFmp4: 'WS-fMP4',
  };
  return formatNames[format] || format.toUpperCase();
}

// 处理不支持的格式
function handleFormatNotSupported(data: { format: string; message: string }) {
  message.warning({
    content: data.message,
    duration: 5,
  });
}

// 获取格式支持状态
function isFormatSupported(format: string): boolean {
  const supportedFormats = ['hls', 'httpFlv', 'wsFlv', 'httpFmp4'];

  // WS-fMP4 需要专门的WebSocket播放器，标准Video.js不支持
  if (format === 'wsFmp4') {
    return false; // 需要专门的WebSocket fMP4播放器如mpegts.js或Jessibuca
  }

  // HTTP-TS 和 WS-TS 格式 - 放宽检查，让播放器尝试播放
  if (format === 'httpTs' || format === 'wsTs') {
    // 大部分现代浏览器都支持TS格式，即使canPlayType返回空字符串
    // 我们允许尝试播放，让播放器自己处理兼容性
    return true;
  }

  return supportedFormats.includes(format);
}

// 复制URL到剪贴板
async function copyUrl(url: string, format: string) {
  try {
    // 检查是否支持现代剪贴板API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      message.success(`已复制 ${getFormatDisplayName(format)} 播放地址`);
      return;
    }
  } catch (error) {
    console.error('Modern clipboard API failed:', error);
  }

  // 回退方案：使用传统的execCommand方法
  try {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.append(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    textArea.remove();

    if (successful) {
      message.success(`已复制 ${getFormatDisplayName(format)} 播放地址`);
    } else {
      throw new Error('execCommand failed');
    }
  } catch (fallbackError) {
    console.error('Fallback copy method also failed:', fallbackError);
    message.error('复制失败，请手动复制该地址');
  }
}

// 刷新播放器
function handleRefreshPlayer() {
  if (playerRef.value && playerRef.value.refresh) {
    playerRef.value.refresh();
    message.success('播放器已刷新');
  } else {
    message.warning('播放器刷新功能不可用');
  }
}

// 刷新观看人数
async function handleRefreshViewerCount() {
  if (!props.onRefresh) {
    message.warning('刷新功能未配置');
    return;
  }

  isRefreshing.value = true;
  try {
    await props.onRefresh();
    message.success('观看人数已刷新');
  } catch (error) {
    console.warn('刷新观看人数失败:', error);
    message.error('刷新观看人数失败');
  } finally {
    isRefreshing.value = false;
  }
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
    :width="1000"
    :footer="null"
    @cancel="handleClose"
  >
    <div class="detail-content">
      <!-- 视频播放器 -->
      <div v-if="hasPlayUrls" class="player-section">
        <h4 class="section-title">
          视频播放
          <span v-if="currentPlayingFormat" class="playing-format">
            (当前: {{ getFormatDisplayName(currentPlayingFormat) }})
          </span>
          <span class="player-refresh-btn">
            <Button
              type="text"
              @click="handleRefreshPlayer"
              size="small"
              title="刷新播放器"
            >
              <RotateCw class="refresh-icon" />
              刷新播放器
            </Button>
          </span>
        </h4>
        <div class="player-wrapper">
          <MediaPlayer
            ref="playerRef"
            :play-urls="playUrls"
            :height="400"
            :autoplay="false"
            :controls="true"
            :fluid="true"
            @format-not-supported="handleFormatNotSupported"
          />
        </div>
      </div>

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
            <span v-if="props.onRefresh" class="refresh-count-btn">
              <Button
                type="text"
                :loading="isRefreshing"
                @click="handleRefreshViewerCount"
                :disabled="isRefreshing"
                size="small"
                title="刷新观看人数"
              >
                <RotateCw class="refresh-icon" />
              </Button>
            </span>
          </p>
        </div>
      </div>

      <!-- 播放地址 -->
      <div class="info-section">
        <h4 class="section-title">播放地址 (点击测试播放)</h4>
        <div class="info-box">
          <div v-if="playUrls?.rtsp" class="url-item">
            <strong>RTSP:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{
                  active: currentPlayingFormat === 'rtsp',
                  disabled: !isFormatSupported('rtsp'),
                }"
                :disabled="!isFormatSupported('rtsp')"
                @click="playFormat('rtsp', playUrls.rtsp)"
              >
                {{ playUrls.rtsp }}
                <span
                  v-if="!isFormatSupported('rtsp')"
                  class="unsupported-label"
                >
                  (浏览器不支持)
                </span>
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.rtsp, 'rtsp')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.rtmp" class="url-item">
            <strong>RTMP:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{
                  active: currentPlayingFormat === 'rtmp',
                  disabled: !isFormatSupported('rtmp'),
                }"
                :disabled="!isFormatSupported('rtmp')"
                @click="playFormat('rtmp', playUrls.rtmp)"
              >
                {{ playUrls.rtmp }}
                <span
                  v-if="!isFormatSupported('rtmp')"
                  class="unsupported-label"
                >
                  (浏览器不支持)
                </span>
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.rtmp, 'rtmp')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.httpFlv" class="url-item">
            <strong>HTTP-FLV:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{ active: currentPlayingFormat === 'httpFlv' }"
                @click="playFormat('httpFlv', playUrls.httpFlv)"
              >
                {{ playUrls.httpFlv }}
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.httpFlv, 'httpFlv')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.wsFlv" class="url-item">
            <strong>WS-FLV:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{ active: currentPlayingFormat === 'wsFlv' }"
                @click="playFormat('wsFlv', playUrls.wsFlv)"
              >
                {{ playUrls.wsFlv }}
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.wsFlv, 'wsFlv')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.hls" class="url-item">
            <strong>HLS:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{ active: currentPlayingFormat === 'hls' }"
                @click="playFormat('hls', playUrls.hls)"
              >
                {{ playUrls.hls }}
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.hls, 'hls')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.webrtc" class="url-item">
            <strong>WebRTC:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{
                  active: currentPlayingFormat === 'webrtc',
                  disabled: !isFormatSupported('webrtc'),
                }"
                :disabled="!isFormatSupported('webrtc')"
                @click="playFormat('webrtc', playUrls.webrtc)"
              >
                {{ playUrls.webrtc }}
                <span
                  v-if="!isFormatSupported('webrtc')"
                  class="unsupported-label"
                >
                  (需要专用客户端)
                </span>
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.webrtc, 'webrtc')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.httpTs" class="url-item">
            <strong>HTTP-TS:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{
                  active: currentPlayingFormat === 'httpTs',
                  disabled: !isFormatSupported('httpTs'),
                }"
                :disabled="!isFormatSupported('httpTs')"
                @click="playFormat('httpTs', playUrls.httpTs)"
              >
                {{ playUrls.httpTs }}
                <span
                  v-if="!isFormatSupported('httpTs')"
                  class="unsupported-label"
                >
                  (浏览器不支持TS格式)
                </span>
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.httpTs, 'httpTs')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.wsTs" class="url-item">
            <strong>WS-TS:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{
                  active: currentPlayingFormat === 'wsTs',
                  disabled: !isFormatSupported('wsTs'),
                }"
                :disabled="!isFormatSupported('wsTs')"
                @click="playFormat('wsTs', playUrls.wsTs)"
              >
                {{ playUrls.wsTs }}
                <span
                  v-if="!isFormatSupported('wsTs')"
                  class="unsupported-label"
                >
                  (浏览器不支持TS格式)
                </span>
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.wsTs, 'wsTs')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.httpFmp4" class="url-item">
            <strong>HTTP-fMP4:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{ active: currentPlayingFormat === 'httpFmp4' }"
                @click="playFormat('httpFmp4', playUrls.httpFmp4)"
              >
                {{ playUrls.httpFmp4 }}
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.httpFmp4, 'httpFmp4')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
          <div v-if="playUrls?.wsFmp4" class="url-item">
            <strong>WS-fMP4:</strong>
            <div class="url-controls">
              <button
                class="url-link"
                :class="{ active: currentPlayingFormat === 'wsFmp4' }"
                @click="playFormat('wsFmp4', playUrls.wsFmp4)"
              >
                {{ playUrls.wsFmp4 }}
              </button>
              <button
                class="copy-btn"
                @click="copyUrl(playUrls.wsFmp4, 'wsFmp4')"
                title="复制链接"
              >
                <Copy class="copy-icon" />
              </button>
            </div>
          </div>
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
  max-height: 600px;
  overflow-y: auto;
}

.player-section {
  margin-bottom: 24px;
}

.player-wrapper {
  margin-bottom: 16px;
  overflow: hidden;
  background: #000;
  border-radius: 8px;
}

.info-section {
  margin-bottom: 16px;
}

.section-title {
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1890ff;
}

.playing-format {
  font-size: 14px;
  font-weight: normal;
  color: #52c41a;
}

.url-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 8px;
}

.url-item strong {
  flex-shrink: 0;
  min-width: 100px;
}

.url-controls {
  display: flex;
  flex: 1;
  gap: 4px;
  align-items: flex-start;
}

.url-link {
  flex: 1;
  min-height: 24px;
  padding: 4px 8px;
  font-family: monospace;
  font-size: 12px;
  color: #1890ff;
  text-align: left;
  word-break: break-all;
  cursor: pointer;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  transition: all 0.2s;
}

.copy-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 4px 6px;
  color: #666;
  cursor: pointer;
  background: #f0f0f0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  transition: all 0.2s;
}

.copy-btn:hover {
  color: #1890ff;
  background: #e6f7ff;
  border-color: #40a9ff;
}

.copy-icon {
  width: 14px;
  height: 14px;
}

.url-link:hover {
  color: #096dd9;
  background: #bae7ff;
  border-color: #40a9ff;
}

.url-link.active {
  font-weight: 600;
  color: white;
  background: #52c41a;
  border-color: #52c41a;
}

.url-link.active:hover {
  background: #389e0d;
  border-color: #389e0d;
}

.url-link.disabled {
  color: #bfbfbf;
  cursor: not-allowed;
  background: #f5f5f5;
  border-color: #d9d9d9;
}

.url-link.disabled:hover {
  color: #bfbfbf;
  background: #f5f5f5;
  border-color: #d9d9d9;
}

.unsupported-label {
  margin-left: 8px;
  font-size: 11px;
  font-weight: normal;
  color: #ff7875;
}

.info-box {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
}

.track-box {
  padding: 12px;
  margin-bottom: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.info-box p,
.track-box p {
  margin: 0 0 4px;
  line-height: 1.5;
}

.info-box p:last-child,
.track-box p:last-child {
  margin-bottom: 0;
}

.url-code {
  padding: 2px 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  background: #e6f7ff;
  border-radius: 3px;
}

.no-urls {
  font-style: italic;
  color: #999;
}

strong {
  font-weight: 600;
  color: #333;
}

.refresh-count-btn {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
}

.player-refresh-btn {
  display: inline-flex;
  align-items: center;
  margin-left: 16px;
}

.refresh-icon {
  width: 14px;
  height: 14px;
  color: #1890ff;
}

.refresh-count-btn .ant-btn,
.player-refresh-btn .ant-btn {
  height: 20px;
  padding: 2px 4px;
  background: transparent;
  border: none;
}

.refresh-count-btn .ant-btn:hover,
.player-refresh-btn .ant-btn:hover {
  background: #e6f7ff;
  border-color: #40a9ff;
}

.refresh-count-btn .ant-btn:disabled,
.player-refresh-btn .ant-btn:disabled {
  color: #bfbfbf;
  background: transparent;
}
</style>
