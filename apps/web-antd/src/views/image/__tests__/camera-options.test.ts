import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraOptions } from '../collection/use-camera-options';

const api = vi.hoisted(() => ({
  getDeviceChannelPage: vi.fn(),
  getDevicePage: vi.fn(),
}));

vi.mock('#/api/device', () => api);
vi.mock('#/locales', () => ({ $t: (key: string) => key }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mountCameraOptions(pageSize = 2) {
  let camera!: ReturnType<typeof useCameraOptions>;
  const wrapper = mount(
    defineComponent({
      setup() {
        camera = useCameraOptions(pageSize);
        return () => h('div');
      },
    }),
  );
  return { camera, wrapper };
}

describe('remote camera options', () => {
  beforeEach(() => {
    api.getDeviceChannelPage.mockReset();
    api.getDevicePage.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces device search and merges exact ID with fuzzy name results', async () => {
    vi.useFakeTimers();
    api.getDevicePage.mockImplementation(
      (_paging: unknown, filters: { deviceId?: string; name?: string }) =>
        Promise.resolve(
          filters.deviceId
            ? {
                items: [
                  {
                    deviceId: 'device-1',
                    id: 1,
                    name: 'Lobby',
                    status: 1,
                    statusName: 'online',
                  },
                ],
                total: 1,
              }
            : {
                items: [
                  {
                    deviceId: 'device-1',
                    id: 1,
                    name: 'Lobby',
                    status: 1,
                    statusName: 'online',
                  },
                  {
                    deviceId: 'device-2',
                    id: 2,
                    name: 'Lobby East',
                    status: 0,
                    statusName: 'offline',
                  },
                ],
                total: 2,
              },
        ),
    );
    const { camera, wrapper } = mountCameraOptions();

    camera.searchDevices(' device-1 ');
    await vi.advanceTimersByTimeAsync(299);
    expect(api.getDevicePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(camera.devices.value).toHaveLength(2));

    expect(api.getDevicePage).toHaveBeenCalledTimes(2);
    expect(camera.devices.value.map((option) => option.value)).toEqual([
      'device-1',
      'device-2',
    ]);
    expect(camera.devices.value[1]).toMatchObject({ online: false });
    wrapper.unmount();
  });

  it('discards stale responses even when an aborted transport still resolves', async () => {
    const oldName = deferred<{ items: any[]; total: number }>();
    const oldExact = deferred<{ items: any[]; total: number }>();
    const newName = deferred<{ items: any[]; total: number }>();
    const newExact = deferred<{ items: any[]; total: number }>();
    api.getDevicePage.mockImplementation(
      (_paging: unknown, filters: { deviceId?: string; name?: string }) => {
        if (filters.name === 'old') return oldName.promise;
        if (filters.deviceId === 'old') return oldExact.promise;
        if (filters.name === 'new') return newName.promise;
        return newExact.promise;
      },
    );
    const { camera, wrapper } = mountCameraOptions();

    const oldRequest = camera.queryDevices('old');
    const newRequest = camera.queryDevices('new');
    newExact.resolve({
      items: [
        {
          deviceId: 'new',
          id: 2,
          status: 1,
          statusName: 'online',
        },
      ],
      total: 1,
    });
    newName.resolve({ items: [], total: 0 });
    await newRequest;
    oldExact.resolve({
      items: [
        {
          deviceId: 'old',
          id: 1,
          status: 1,
          statusName: 'online',
        },
      ],
      total: 1,
    });
    oldName.resolve({ items: [], total: 0 });
    await oldRequest;

    expect(camera.devices.value.map((option) => option.value)).toEqual(['new']);
    wrapper.unmount();
  });

  it('paginates channels, disables offline choices and preserves missing IDs', async () => {
    api.getDeviceChannelPage.mockImplementation(
      (paging: { page: number }, filters: { channelId?: string }) => {
        if (filters.channelId === 'missing') {
          return Promise.resolve({ items: [], total: 0 });
        }
        return Promise.resolve(
          paging.page === 1
            ? {
                items: [
                  {
                    channelId: 'channel-1',
                    deviceId: 'device-1',
                    id: 1,
                    status: 1,
                    statusName: 'online',
                  },
                  {
                    channelId: 'channel-2',
                    deviceId: 'device-1',
                    id: 2,
                    status: 0,
                    statusName: 'offline',
                  },
                ],
                total: 3,
              }
            : {
                items: [
                  {
                    channelId: 'channel-3',
                    deviceId: 'device-1',
                    id: 3,
                    status: 1,
                    statusName: 'online',
                  },
                ],
                total: 3,
              },
        );
      },
    );
    const { camera, wrapper } = mountCameraOptions();

    await camera.queryChannels('device-1');
    expect(camera.channels.value[1]).toMatchObject({
      disabled: true,
      online: false,
    });
    camera.loadMoreChannels();
    await vi.waitFor(() => expect(camera.channels.value).toHaveLength(3));
    await camera.resolveChannel('device-1', 'missing');
    expect(camera.channels.value.at(-1)).toMatchObject({
      disabled: true,
      missing: true,
      value: 'missing',
    });
    wrapper.unmount();
  });
});
