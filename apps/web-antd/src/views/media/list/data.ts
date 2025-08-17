import type { VbenFormSchema } from '@vben/common-ui';

import type { OnActionClickFn, VxeGridPropTypes } from '#/adapter/vxe-table';
import type { ZlmMediaApi } from '#/api/media/zlm-media';

import { $t } from '#/locales';

/**
 * 获取产生源类型文本描述
 */
export function getOriginTypeText(originType: number): string {
  const typeMap: Record<number, string> = {
    0: $t('media.list.originType.unknown'),
    1: $t('media.list.originType.rtmpPush'),
    2: $t('media.list.originType.rtspPush'),
    3: $t('media.list.originType.rtpPush'),
    4: $t('media.list.originType.pull'),
    5: $t('media.list.originType.ffmpegPull'),
    6: $t('media.list.originType.mp4Vod'),
    7: $t('media.list.originType.deviceChn'),
  };
  return typeMap[originType] || $t('media.list.originType.unknown');
}

/**
 * 获取编码类型文本描述
 */
export function getCodecText(codecId: number): string {
  const codecMap: Record<number, string> = {
    0: 'H264',
    1: 'H265',
    2: 'AAC',
    3: 'G711A',
    4: 'G711U',
  };
  return codecMap[codecId] || `Unknown(${codecId})`;
}

/**
 * 获取轨道类型文本描述
 */
export function getTrackTypeText(codecType: number): string {
  const typeMap: Record<number, string> = {
    0: $t('media.list.trackType.video'),
    1: $t('media.list.trackType.audio'),
  };
  return typeMap[codecType] || $t('media.list.trackType.unknown');
}

/**
 * 格式化字节速度
 */
export function formatBytesSpeed(bytesSpeed: number): string {
  if (bytesSpeed === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const digitGroups = Math.floor(Math.log10(bytesSpeed) / Math.log10(1024));
  return `${(bytesSpeed / 1024 ** digitGroups).toFixed(2)} ${units[digitGroups]}`;
}

/**
 * 格式化时间戳为本地时间
 */
export function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * 格式化存活时间（秒）为可读格式
 */
export function formatAliveTime(seconds: number): string {
  if (seconds < 60) return `${seconds}${$t('media.list.time.seconds')}`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}${$t('media.list.time.minutes')}`;
  if (seconds < 86_400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}${$t('media.list.time.hours')}${minutes}${$t('media.list.time.minutes')}`;
  }
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  return `${days}${$t('media.list.time.days')}${hours}${$t('media.list.time.hours')}`;
}

/**
 * 获取流媒体列表表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<ZlmMediaApi.MediaData>,
): VxeGridPropTypes.Columns {
  return [
    {
      type: 'checkbox',
      width: 50,
      align: 'center',
      fixed: 'left',
    },
    {
      field: 'schema',
      title: $t('media.list.columns.schema'),
      width: 80,
      align: 'center',
      fixed: 'left',
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'blue', label: 'RTSP', value: 'rtsp' },
          { color: 'green', label: 'RTMP', value: 'rtmp' },
          { color: 'orange', label: 'HTTP', value: 'http' },
          { color: 'purple', label: 'WS', value: 'ws' },
        ],
      },
    },
    {
      field: 'app',
      title: $t('media.list.columns.app'),
      width: 120,
      align: 'center',
    },
    {
      field: 'stream',
      title: $t('media.list.columns.stream'),
      width: 180,
      align: 'left',
    },
    {
      field: 'vhost',
      title: $t('media.list.columns.vhost'),
      width: 150,
      align: 'center',
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'default',
            label: $t('media.list.defaultVhost'),
            value: '__defaultVhost__',
          },
        ],
      },
    },
    {
      field: 'readerCount',
      title: $t('media.list.columns.readerCount'),
      width: 100,
      align: 'center',
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'success', label: '', value: (val: number) => val > 0 },
          { color: 'default', label: '', value: (val: number) => val === 0 },
        ],
      },
    },
    {
      field: 'totalReaderCount',
      title: $t('media.list.columns.totalReaderCount'),
      width: 120,
      align: 'center',
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'processing', label: '', value: (val: number) => val > 0 },
          { color: 'default', label: '', value: (val: number) => val === 0 },
        ],
      },
    },
    {
      field: 'originType',
      title: $t('media.list.columns.originType'),
      width: 120,
      align: 'center',
      formatter: ({ cellValue }) => getOriginTypeText(cellValue),
    },
    {
      field: 'bytesSpeed',
      title: $t('media.list.columns.bytesSpeed'),
      width: 120,
      align: 'right',
      formatter: ({ cellValue }) => formatBytesSpeed(cellValue),
    },
    {
      field: 'createStamp',
      title: $t('media.list.columns.createTime'),
      width: 160,
      align: 'center',
      formatter: ({ cellValue }) => formatTimestamp(cellValue),
    },
    {
      field: 'aliveSecond',
      title: $t('media.list.columns.aliveTime'),
      width: 120,
      align: 'center',
      formatter: ({ cellValue }) => formatAliveTime(cellValue),
    },
    {
      field: 'originUrl',
      title: $t('media.list.columns.originUrl'),
      width: 300,
      align: 'left',
      showOverflow: 'tooltip',
    },
    {
      title: $t('media.list.columns.actions'),
      width: 160,
      align: 'center',
      fixed: 'right',
      cellRender: {
        name: 'CellOperation',
        attrs: { onClick: onActionClick },
        options: [
          {
            code: 'view',
            text: $t('media.list.actions.view'),
          },
          {
            code: 'close',
            text: $t('media.list.actions.close'),
            danger: true,
          },
        ],
      },
    },
  ];
}

/**
 * 获取搜索表单配置
 */
export function useSearchFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'schema',
      label: $t('media.list.search.schema'),
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('media.list.search.all'), value: '' },
          { label: 'RTSP', value: 'rtsp' },
          { label: 'RTMP', value: 'rtmp' },
          { label: 'HTTP', value: 'http' },
          { label: 'WebSocket', value: 'ws' },
        ],
        placeholder: $t('media.list.search.schema'),
      },
    },
    {
      fieldName: 'app',
      label: $t('media.list.search.app'),
      component: 'Input',
      componentProps: {
        placeholder: $t('media.list.search.appPlaceholder'),
      },
    },
    {
      fieldName: 'stream',
      label: $t('media.list.search.stream'),
      component: 'Input',
      componentProps: {
        placeholder: $t('media.list.search.streamPlaceholder'),
      },
    },
    {
      fieldName: 'vhost',
      label: $t('media.list.search.vhost'),
      component: 'Input',
      componentProps: {
        placeholder: $t('media.list.search.vhostPlaceholder'),
      },
    },
  ];
}
