<script lang="ts" setup>
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { computed, ref, watch } from 'vue';

import { Copy, RotateCw } from '@vben/icons';

import { Button, message, Modal, Spin } from 'ant-design-vue';

import { getZlmMediaInfo, getZlmMediaPlayUrls } from '#/api/media/zlm-media';

import MediaPlayer from '../views/media/media-player/index.vue';

interface StreamParams {
  /** 虚拟主机，例如__defaultVhost__ */
  vhost: string;
  /** 应用名，例如 main */
  app: string;
  /** 流ID，例如 av_stream */
  stream: string;
}

interface Props {
  /** 流参数 */
  streamParams?: null | StreamParams;
  /** 节点Key，用于请求指定节点的流信息 */
  nodeKey?: string;
  /** 是否显示详情信息（除播放器外的其他信息） */
  showDetails?: boolean;
  /** 模态框标题，不传则使用默认标题 */
  title?: string;
  /** 是否可见 */
  open?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  streamParams: null,
  nodeKey: undefined,
  showDetails: true,
  title: '',
  open: false,
});

const emit = defineEmits<{
  close: [];
  'update:open': [value: boolean];
}>();

// 状态管理
const visible = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

const loading = ref(false);
const playerRef = ref();
const currentPlayingFormat = ref('');
const isRefreshing = ref(false);

// 数据状态
const mediaInfo = ref<null | ZlmMediaApi.MediaInfoDetail>(null);
const playUrls = ref<null | ZlmMediaApi.PlayUrls>(null);

// 计算属性
const modalTitle = computed(() => {
  if (props.title) return props.title;
  if (props.streamParams) {
    return `流信息详情 - ${props.streamParams.app}/${props.streamParams.stream}`;
  }
  return '流信息详情';
});

const hasPlayUrls = computed(() => {
  if (!playUrls.value) return false;
  const urls = playUrls.value;
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
  if (!mediaInfo.value?.createStamp) return '-';
  return new Date(mediaInfo.value.createStamp * 1000).toLocaleString();
});

const formatAliveTime = computed(() => {
  if (!mediaInfo.value?.aliveSecond) return '-';
  return `${Math.floor(mediaInfo.value.aliveSecond / 60)} 分钟`;
});

const formatBytesSpeed = computed(() => {
  if (!mediaInfo.value?.bytesSpeed) return '0 KB/s';
  return `${(mediaInfo.value.bytesSpeed / 1024).toFixed(2)} KB/s`;
});

const formatTotalBytes = computed(() => {
  if (!mediaInfo.value?.totalBytes) return '-';
  return `${(mediaInfo.value.totalBytes / 1024 / 1024).toFixed(2)} MB`;
});

// 监听流参数变化，自动加载数据
watch(
  () => [props.streamParams, props.open],
  async ([newParams, newOpen]) => {
    if (newOpen && newParams) {
      await loadStreamData();
    }
  },
  { immediate: true },
);

// 加载流数据
async function loadStreamData() {
  if (!props.streamParams) return;

  loading.value = true;
  try {
    // 并行请求媒体信息和播放地址
    const [mediaInfoResponse, playUrlsResponse] = await Promise.all([
      props.showDetails
        ? getZlmMediaInfo(props.streamParams, props.nodeKey)
        : Promise.resolve(null),
      getZlmMediaPlayUrls(props.streamParams, props.nodeKey),
    ]);

    if (props.showDetails && mediaInfoResponse) {
      mediaInfo.value = mediaInfoResponse;
    }

    if (playUrlsResponse) {
      // 检查是否是包装的响应格式 {code, data, msg}const { code, data } = playUrlsResponse || {};
      playUrls.value =
        typeof playUrlsResponse === 'object' &&
        'code' in playUrlsResponse &&
        'data' in playUrlsResponse
          ? playUrlsResponse.data
          : playUrlsResponse;
    }
  } catch (error) {
    console.error('加载流数据失败:', error);
    message.error('加载流数据失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

// 刷新数据
async function refreshData() {
  if (!props.streamParams) return;

  isRefreshing.value = true;
  try {
    await loadStreamData();
    message.success('数据已刷新');
  } catch {
    message.error('刷新数据失败');
  } finally {
    isRefreshing.value = false;
  }
}

function handleClose() {
  // 停止播放器
  if (playerRef.value && playerRef.value.destroy) {
    playerRef.value.destroy();
  }

  visible.value = false;
  currentPlayingFormat.value = '';

  // 清理数据
  mediaInfo.value = null;
  playUrls.value = null;

  emit('close');
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

// 导出方法供父组件调用
defineExpose({
  refreshData,
});
</script>

<template>
  <Modal
    v-model:open="visible"
    :width="1000"
    :footer="null"
    @cancel="handleClose"
    destroy-on-close
  >
    <template #title>
      <div class="modal-title-wrapper">
        <div class="modal-title-text">{{ modalTitle }}</div>
      </div>
    </template>
    <Spin :spinning="loading" tip="加载中...">
      <div class="detail-content">
        <!-- 顶部操作栏 -->
        <div v-if="showDetails" class="action-bar">
          <!-- 刷新数据按钮已移动到标题栏 -->
        </div>

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
              <Button
                v-if="showDetails"
                type="text"
                :loading="isRefreshing"
                @click="refreshData"
                :disabled="isRefreshing"
                title="刷新数据"
              >
                <RotateCw class="refresh-icon" />
                刷新数据
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

        <!-- 以下为详情信息，根据showDetails控制显示 -->
        <template v-if="showDetails">
          <!-- 基本信息 -->
          <div class="info-section">
            <h4 class="section-title">基本信息</h4>
            <div class="info-box">
              <p><strong>协议:</strong> {{ mediaInfo?.schema || '-' }}</p>
              <p>
                <strong>虚拟主机:</strong>
                {{ mediaInfo?.vhost || streamParams?.vhost || '-' }}
              </p>
              <p>
                <strong>应用名:</strong>
                {{ mediaInfo?.app || streamParams?.app || '-' }}
              </p>
              <p>
                <strong>流ID:</strong>
                {{ mediaInfo?.stream || streamParams?.stream || '-' }}
              </p>
              <p>
                <strong>观看人数:</strong> {{ mediaInfo?.readerCount || 0 }} /
                {{ mediaInfo?.totalReaderCount || 0 }}
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
                    @click="playFormat('rtsp', playUrls.rtsp!)"
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
                    @click="copyUrl(playUrls.rtsp!, 'rtsp')"
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
                    @click="playFormat('rtmp', playUrls.rtmp!)"
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
                    @click="copyUrl(playUrls.rtmp!, 'rtmp')"
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
                    @click="playFormat('httpFlv', playUrls.httpFlv!)"
                  >
                    {{ playUrls.httpFlv }}
                  </button>
                  <button
                    class="copy-btn"
                    @click="copyUrl(playUrls.httpFlv!, 'httpFlv')"
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
                    @click="playFormat('wsFlv', playUrls.wsFlv!)"
                  >
                    {{ playUrls.wsFlv }}
                  </button>
                  <button
                    class="copy-btn"
                    @click="copyUrl(playUrls.wsFlv!, 'wsFlv')"
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
                    @click="playFormat('hls', playUrls.hls!)"
                  >
                    {{ playUrls.hls }}
                  </button>
                  <button
                    class="copy-btn"
                    @click="copyUrl(playUrls.hls!, 'hls')"
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
                    @click="playFormat('webrtc', playUrls.webrtc!)"
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
                    @click="copyUrl(playUrls.webrtc!, 'webrtc')"
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
                    @click="playFormat('httpTs', playUrls.httpTs!)"
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
                    @click="copyUrl(playUrls.httpTs!, 'httpTs')"
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
                    @click="playFormat('wsTs', playUrls.wsTs!)"
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
                    @click="copyUrl(playUrls.wsTs!, 'wsTs')"
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
                    @click="playFormat('httpFmp4', playUrls.httpFmp4!)"
                  >
                    {{ playUrls.httpFmp4 }}
                  </button>
                  <button
                    class="copy-btn"
                    @click="copyUrl(playUrls.httpFmp4!, 'httpFmp4')"
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
                    @click="playFormat('wsFmp4', playUrls.wsFmp4!)"
                  >
                    {{ playUrls.wsFmp4 }}
                  </button>
                  <button
                    class="copy-btn"
                    @click="copyUrl(playUrls.wsFmp4!, 'wsFmp4')"
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
          <div v-if="mediaInfo" class="info-section">
            <h4 class="section-title">流详细信息</h4>
            <div class="info-box">
              <p>
                <strong>产生源类型:</strong>
                {{ mediaInfo.originTypeStr || '-' }}
              </p>
              <p>
                <strong>产生源URL:</strong> {{ mediaInfo.originUrl || '无' }}
              </p>
              <p><strong>创建时间:</strong> {{ formatCreateTime }}</p>
              <p><strong>存活时间:</strong> {{ formatAliveTime }}</p>
              <p><strong>数据传输速度:</strong> {{ formatBytesSpeed }}</p>
              <p v-if="mediaInfo.totalBytes">
                <strong>总字节数:</strong> {{ formatTotalBytes }}
              </p>
              <p v-if="mediaInfo.recordingHLS !== undefined">
                <strong>HLS录制:</strong>
                {{ mediaInfo.recordingHLS ? '启用' : '禁用' }}
              </p>
              <p v-if="mediaInfo.recordingMP4 !== undefined">
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
                <p>
                  <strong>分辨率:</strong> {{ track.width }}x{{ track.height }}
                </p>
                <p><strong>帧率:</strong> {{ track.fps }} fps</p>
                <p><strong>GOP大小:</strong> {{ track.gop_size }} 帧</p>
                <p><strong>GOP间隔:</strong> {{ track.gop_interval_ms }} ms</p>
              </template>

              <!-- 音频轨道信息 -->
              <template v-else>
                <p>
                  <strong>采样率:</strong> {{ track.sample_rate || '未知' }} Hz
                </p>
                <p>
                  <strong>采样位数:</strong>
                  {{ track.sample_bit || '未知' }} bit
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
        </template>
      </div>
    </Spin>
  </Modal>
</template>

<style scoped>
.detail-content {
  max-height: 600px;
  overflow-y: auto;
}

.modal-title-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 50%;
}

.modal-title-text {
  font-size: 16px;
  font-weight: 500;
  color: rgb(0 0 0 / 88%);
}

.title-refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  transition: all 0.2s;
}

.title-refresh-btn:hover {
  background-color: rgb(0 0 0 / 4%);
}

.title-refresh-icon {
  width: 16px;
  height: 16px;
  color: #1890ff;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
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

.no-urls {
  font-style: italic;
  color: #999;
}

strong {
  font-weight: 600;
  color: #333;
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

.player-refresh-btn .ant-btn {
  height: 20px;
  padding: 2px 4px;
  background: transparent;
  border: none;
}

.player-refresh-btn .ant-btn:hover {
  background: #e6f7ff;
  border-color: #40a9ff;
}
</style>
