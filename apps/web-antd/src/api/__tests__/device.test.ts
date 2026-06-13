import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  broadcast,
  controlAlarm,
  controlRecordStart,
  controlRecordStop,
  downloadConfig,
  getDevicePage,
  liveStart,
  liveStop,
  ptzControl,
  ptzStop,
  queryAlarm,
  queryCatalog,
  queryDeviceInfo,
  queryDeviceStatus,
  queryMobilePosition,
  queryPreset,
  queryRecord,
  rebootDevice,
  setDeviceConfig,
} from '../device';

/**
 * api/device.ts —— 设备管理前端 API 与后端已落地端点的契约镜像。
 *
 * 规格依据：GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md
 *   §1.1（DeviceController /device/getPage）
 *   §1.2（DeviceCmdController /device-cmd/* 含 S2 新增支链）
 *   §1.3（复用既有 /ptz、/live 端点，与协议台同源）
 *
 * URL / 请求体是逐字核对后端真实代码的契约（.cursorrules 铁律：严禁臆造字段/端点）。
 * 任何漂移都会让真实联调 404 / 400，故用测试钉死。
 */

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

describe('device API —— 分页查询（§1.1 DeviceController）', () => {
  it('getDevicePage：page/size 走 query，条件走 body', async () => {
    await getDevicePage({ page: 2, size: 20 }, { deviceId: 'd1', status: 1 });
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/device/getPage?page=2&size=20',
      { deviceId: 'd1', status: 1 },
    );
  });

  it('getDevicePage：无条件 body 时发空对象（不发 undefined）', async () => {
    await getDevicePage({ page: 1, size: 10 });
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/device/getPage?page=1&size=10',
      {},
    );
  });

  it('getDevicePage：透传后端解包后的 DeviceListResp 本体', async () => {
    postMock.mockResolvedValueOnce({
      total: 3,
      items: [{ deviceId: 'd1', status: 1, statusName: '在线' }],
    });
    const resp = await getDevicePage({ page: 1, size: 10 });
    expect(resp).toEqual({
      total: 3,
      items: [{ deviceId: 'd1', status: 1, statusName: '在线' }],
    });
  });
});

describe('device API —— 复用既有端点（§1.3，与协议台同源，勿重建）', () => {
  it('ptzControl → POST /api/v1/ptz/control 透传 payload', async () => {
    await ptzControl({ deviceId: 'd1', channelId: 'd101', command: 'UP' });
    expect(postMock).toHaveBeenCalledWith('/api/v1/ptz/control', {
      deviceId: 'd1',
      channelId: 'd101',
      command: 'UP',
    });
  });

  it('ptzStop → POST /api/v1/ptz/stop {deviceId}', async () => {
    await ptzStop('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/ptz/stop', {
      deviceId: 'd1',
    });
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

  it('liveStart → POST /api/v1/live/start 透传 payload', async () => {
    await liveStart({ deviceId: 'd1', channelId: 'd101' });
    expect(postMock).toHaveBeenCalledWith('/api/v1/live/start', {
      deviceId: 'd1',
      channelId: 'd101',
    });
  });

  it('liveStart 返回 LivePlayVO（含 playUrls）透传', async () => {
    postMock.mockResolvedValueOnce({
      streamId: 's1',
      playUrls: { httpFlv: 'http://x/s.flv' },
    });
    const vo = await liveStart({ deviceId: 'd1', channelId: 'd101' });
    expect(vo).toEqual({
      streamId: 's1',
      playUrls: { httpFlv: 'http://x/s.flv' },
    });
  });

  it('liveStop → POST /api/v1/live/stop {streamId}（G4：停流统一走 /live/stop）', async () => {
    await liveStop('s1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/live/stop', {
      streamId: 's1',
    });
  });
});

describe('device API —— S2 新增支链（§1.2 DeviceCmdController）', () => {
  it('queryDeviceStatus → POST /api/v1/device-cmd/query-status {deviceId}', async () => {
    await queryDeviceStatus('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/query-status', {
      deviceId: 'd1',
    });
  });

  it('queryPreset → POST /api/v1/device-cmd/query-preset {deviceId}', async () => {
    await queryPreset('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/query-preset', {
      deviceId: 'd1',
    });
  });

  it('queryMobilePosition → POST .../query-mobile-position {deviceId, interval?}', async () => {
    await queryMobilePosition('d1');
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/device-cmd/query-mobile-position',
      { deviceId: 'd1', interval: undefined },
    );

    postMock.mockClear();
    await queryMobilePosition('d1', '5');
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/device-cmd/query-mobile-position',
      { deviceId: 'd1', interval: '5' },
    );
  });

  it('downloadConfig → POST .../config/download {deviceId, configType}', async () => {
    await downloadConfig('d1', 'BASIC');
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/device-cmd/config/download',
      {
        deviceId: 'd1',
        configType: 'BASIC',
      },
    );
  });

  it('setDeviceConfig → POST .../config/set 透传可选配置字段', async () => {
    await setDeviceConfig({
      deviceId: 'd1',
      name: 'cam',
      expiration: '3600',
      heartBeatInterval: '30',
      heartBeatCount: '3',
    });
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/config/set', {
      deviceId: 'd1',
      name: 'cam',
      expiration: '3600',
      heartBeatInterval: '30',
      heartBeatCount: '3',
    });
  });

  it('controlRecordStart → POST .../record/start {deviceId}', async () => {
    await controlRecordStart('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/record/start', {
      deviceId: 'd1',
    });
  });

  it('controlRecordStop → POST .../record/stop {deviceId}', async () => {
    await controlRecordStop('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/record/stop', {
      deviceId: 'd1',
    });
  });

  it('queryRecord → POST .../record {deviceId, startTime?, endTime?}', async () => {
    await queryRecord({ deviceId: 'd1', startTime: 1000, endTime: 2000 });
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/record', {
      deviceId: 'd1',
      startTime: 1000,
      endTime: 2000,
    });
  });

  it('queryAlarm → POST .../alarm/query 透传过滤条件', async () => {
    await queryAlarm({
      deviceId: 'd1',
      startTime: 1000,
      endTime: 2000,
      startPriority: '1',
      endPriority: '4',
      alarmMethod: '2',
      alarmType: '5',
    });
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/alarm/query', {
      deviceId: 'd1',
      startTime: 1000,
      endTime: 2000,
      startPriority: '1',
      endPriority: '4',
      alarmMethod: '2',
      alarmType: '5',
    });
  });

  it('controlAlarm → POST .../alarm/control {deviceId, alarmMethod?, alarmType?}', async () => {
    await controlAlarm({ deviceId: 'd1', alarmMethod: '2', alarmType: '5' });
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/alarm/control', {
      deviceId: 'd1',
      alarmMethod: '2',
      alarmType: '5',
    });
  });

  it('broadcast → POST /api/v1/device-cmd/broadcast {deviceId}', async () => {
    await broadcast('d1');
    expect(postMock).toHaveBeenCalledWith('/api/v1/device-cmd/broadcast', {
      deviceId: 'd1',
    });
  });
});
