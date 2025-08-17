export interface PlayerInfo {
  type: 'flv' | 'hls' | 'videojs';
  component: string;
  supported: boolean;
  reason?: string;
}

// 格式到播放器的映射
export function getPlayerForFormat(format: string): PlayerInfo {
  switch (format) {
    case 'hls': {
      return {
        type: 'hls',
        component: 'HlsPlayer',
        supported: true,
      };
    }
    case 'httpFlv':
    case 'wsFlv': {
      return {
        type: 'flv',
        component: 'FlvPlayer',
        supported: true,
      };
    }
    case 'httpFmp4':
    case 'httpTs':
    case 'wsFmp4':
    case 'wsTs': {
      return {
        type: 'videojs',
        component: 'VideoJsPlayer',
        supported: true,
      };
    }

    case 'rtmp':
    case 'rtsp': {
      return {
        type: 'videojs',
        component: 'VideoJsPlayer',
        supported: false,
        reason: `${format.toUpperCase()} protocol is not supported in browsers`,
      };
    }

    case 'webrtc': {
      return {
        type: 'videojs',
        component: 'VideoJsPlayer',
        supported: false,
        reason: 'WebRTC requires specialized client implementation',
      };
    }

    default: {
      return {
        type: 'videojs',
        component: 'VideoJsPlayer',
        supported: false,
        reason: `Unknown format: ${format}`,
      };
    }
  }
}

// 格式优先级配置
export const formatPriority = [
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

// 获取最佳播放格式
export function getBestFormat(playUrls: Record<string, any>): null | {
  format: string;
  playerInfo: PlayerInfo;
  url: string;
} {
  for (const format of formatPriority) {
    const url = playUrls[format];
    if (url) {
      const playerInfo = getPlayerForFormat(format);
      if (playerInfo.supported) {
        return { format, url, playerInfo };
      }
    }
  }
  return null;
}

// 格式显示名称映射
export const formatDisplayNames: Record<string, string> = {
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

export function getFormatDisplayName(format: string): string {
  return formatDisplayNames[format] || format.toUpperCase();
}
