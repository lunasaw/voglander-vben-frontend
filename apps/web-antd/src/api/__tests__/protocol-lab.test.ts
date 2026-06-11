import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getLabConfig,
  labKeepalive,
  labKeepaliveAuto,
  labPushAlarm,
  labPushCatalog,
  labPushDeviceInfo,
  labRegister,
  labUnregister,
  liveStart,
  ptzControl,
  queryCatalog,
  queryDeviceInfo,
  rebootDevice,
} from '../protocol-lab';

/**
 * api/protocol-lab.ts —— 前端 API 与后端真实端点的契约镜像。
 *
 * 规格依据：GB28181-PROTOCOL-LAB-FRONTEND-PLAN.md §1.1（左侧 8 个 /lab/client/*）
 * 与 §1.2（右侧 5 个复用端点）。这些 URL / 请求体 / 默认值是与后端逐字核对的契约，
 * 任何漂移都会让真实联调失败，故用测试钉死。
 */

// requestClient 桩：记录每次调用的 (url, body)，并回显可断言的返回。
const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('#/api/request', () => ({
  requestClient: {
    get: (...args: any[]) => getMock(...args),
    post: (...args: any[]) => postMock(...args),
  },
}));

beforeEach(() => {
  getMock.mockReset().mockResolvedValue(undefined);
  postMock.mockReset().mockResolvedValue(undefined);
});

describe('protocol-lab API —— 左侧设备 UA（/api/v1/lab/client/*）', () => {
  it('getLabConfig → GET /api/v1/lab/client/config', async () => {
    await getLabConfig();
    expect(getMock).toHaveBeenCalledWith('/api/v1/lab/client/config');
  });

  it('labRegister 默认空体 / 透传 expires', async () => {
    await labRegister();
    expect(postMock).toHaveBeenCalledWith('/api/v1/lab/client/register', {});

    postMock.mockClear();
    await labRegister({ expires: 3600 });
    expect(postMock).toHaveBeenCalledWith('/api/v1/lab/client/register', {
      expires: 3600,
    });
  });

  it('labRegister 透传扩展的 target + identity 字段（注册到外部平台）', async () => {
    await labRegister({
      expires: 3600,
      serverId: '34020000002000000001',
      serverIp: '10.0.0.1',
      serverPort: 5060,
      serverDomain: '3402000000',
      transport: 'TCP',
      clientId: '34020000001320000001',
      clientPassword: 'secret',
    });
    expect(postMock).toHaveBeenCalledWith('/api/v1/lab/client/register', {
      expires: 3600,
      serverId: '34020000002000000001',
      serverIp: '10.0.0.1',
      serverPort: 5060,
      serverDomain: '3402000000',
      transport: 'TCP',
      clientId: '34020000001320000001',
      clientPassword: 'secret',
    });
  });

  it('labUnregister → POST .../unregister 空体（后端固定 expires=0）', async () => {
    await labUnregister();
    expect(postMock).toHaveBeenCalledWith('/api/v1/lab/client/unregister', {});
  });

  it('labKeepalive → POST .../keepalive 空体', async () => {
    await labKeepalive();
    expect(postMock).toHaveBeenCalledWith('/api/v1/lab/client/keepalive', {});
  });

  it('labKeepaliveAuto → POST .../keepalive/auto 透传 enabled+intervalSec', async () => {
    await labKeepaliveAuto({ enabled: true, intervalSec: 30 });
    expect(postMock).toHaveBeenCalledWith('/api/v1/lab/client/keepalive/auto', {
      enabled: true,
      intervalSec: 30,
    });
  });

  it('labPushCatalog 默认空体 / 透传 channelCount', async () => {
    await labPushCatalog();
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/lab/client/catalog/push',
      {},
    );

    postMock.mockClear();
    await labPushCatalog({ channelCount: 4 });
    expect(postMock).toHaveBeenCalledWith('/api/v1/lab/client/catalog/push', {
      channelCount: 4,
    });
  });

  it('labPushDeviceInfo → POST .../device-info/push', async () => {
    await labPushDeviceInfo({ manufacturer: 'ACME', model: 'X1' });
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/lab/client/device-info/push',
      { manufacturer: 'ACME', model: 'X1' },
    );
  });

  it('labPushAlarm → POST .../alarm/push', async () => {
    await labPushAlarm({ alarmType: 1, priority: 1 });
    expect(postMock).toHaveBeenCalledWith('/api/v1/lab/client/alarm/push', {
      alarmType: 1,
      priority: 1,
    });
  });
});

describe('protocol-lab API —— 右侧平台下发（复用既有端点 §1.2）', () => {
  it('ptzControl 默认 speed=128，且调用方可覆盖', async () => {
    await ptzControl({ deviceId: 'd1', channelId: 'd101', command: 'UP' });
    expect(postMock).toHaveBeenCalledWith('/api/v1/ptz/control', {
      speed: 128,
      deviceId: 'd1',
      channelId: 'd101',
      command: 'UP',
    });

    postMock.mockClear();
    await ptzControl({
      deviceId: 'd1',
      channelId: 'd101',
      command: 'UP',
      speed: 64,
    });
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/ptz/control',
      expect.objectContaining({ speed: 64 }),
    );
  });

  it('queryCatalog → POST /api/v1/device-cmd/query-catalog {deviceId}', async () => {
    await queryCatalog('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/query-catalog', {
      deviceId: 'd1',
    });
  });

  it('queryDeviceInfo → POST /api/v1/device-cmd/query-info {deviceId}', async () => {
    await queryDeviceInfo('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/query-info', {
      deviceId: 'd1',
    });
  });

  it('rebootDevice → POST /api/v1/device-cmd/reboot {deviceId}', async () => {
    await rebootDevice('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/reboot', {
      deviceId: 'd1',
    });
  });

  it('liveStart 默认 protocol=FLV / streamMode=UDP，且调用方可覆盖', async () => {
    await liveStart({ deviceId: 'd1', channelId: 'd101' });
    expect(postMock).toHaveBeenCalledWith('/api/v1/live/start', {
      protocol: 'FLV',
      streamMode: 'UDP',
      deviceId: 'd1',
      channelId: 'd101',
    });

    postMock.mockClear();
    await liveStart({
      deviceId: 'd1',
      channelId: 'd101',
      protocol: 'HLS',
      streamMode: 'TCP',
    });
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/live/start',
      expect.objectContaining({ protocol: 'HLS', streamMode: 'TCP' }),
    );
  });
});

describe('protocol-lab API —— 返回值透传', () => {
  it('函数直接返回 requestClient 的结果（已由拦截器解包 data 本体）', async () => {
    postMock.mockResolvedValueOnce({ enabled: true, intervalSec: 30 });
    const state = await labKeepaliveAuto({ enabled: true });
    expect(state).toEqual({ enabled: true, intervalSec: 30 });
  });
});
