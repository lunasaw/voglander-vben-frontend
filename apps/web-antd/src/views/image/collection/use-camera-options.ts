import type { DeviceApi } from '#/api/device';

import { onBeforeUnmount, ref } from 'vue';

import { getDeviceChannelPage, getDevicePage } from '#/api/device';
import { $t } from '#/locales';

export interface CameraSelectOption {
  disabled?: boolean;
  label: string;
  missing?: boolean;
  online: boolean;
  value: string;
}

function deviceOption(device: DeviceApi.DeviceVO): CameraSelectOption {
  const online = device.status === 1;
  return {
    label: `${online ? '●' : '○'} ${device.deviceId}${device.name ? ` · ${device.name}` : ''} · ${
      online
        ? $t('image.collections.camera.online')
        : $t('image.collections.camera.offline')
    }`,
    online,
    value: device.deviceId,
  };
}

function channelOption(channel: DeviceApi.DeviceChannelVO): CameraSelectOption {
  const online = channel.status === 1;
  return {
    disabled: !online,
    label: `${online ? '●' : '○'} ${channel.channelId}${channel.name ? ` · ${channel.name}` : ''} · ${
      online
        ? $t('image.collections.camera.online')
        : $t('image.collections.camera.offline')
    }`,
    online,
    value: channel.channelId,
  };
}

function mergeOptions(
  current: CameraSelectOption[],
  incoming: CameraSelectOption[],
  reset: boolean,
) {
  const merged = new Map<string, CameraSelectOption>();
  if (!reset) {
    for (const option of current) merged.set(option.value, option);
  }
  for (const option of incoming) merged.set(option.value, option);
  return [...merged.values()];
}

export function useCameraOptions(pageSize = 50) {
  const devices = ref<CameraSelectOption[]>([]);
  const channels = ref<CameraSelectOption[]>([]);
  const deviceTotal = ref(0);
  const channelTotal = ref(0);
  const deviceLoading = ref(false);
  const channelLoading = ref(false);
  const deviceError = ref(false);
  const channelError = ref(false);
  let deviceKeyword = '';
  let channelKeyword = '';
  let channelDeviceId = '';
  let devicePage = 1;
  let channelPage = 1;
  let deviceRevision = 0;
  let channelRevision = 0;
  let deviceRequest: AbortController | undefined;
  let channelRequest: AbortController | undefined;
  let deviceTimer: ReturnType<typeof setTimeout> | undefined;
  let channelTimer: ReturnType<typeof setTimeout> | undefined;

  async function queryDevices(keyword = '', reset = true) {
    const revision = ++deviceRevision;
    deviceRequest?.abort();
    deviceRequest = new AbortController();
    deviceKeyword = keyword.trim();
    devicePage = reset ? 1 : devicePage + 1;
    deviceLoading.value = true;
    deviceError.value = false;
    try {
      const nameRequest = getDevicePage(
        { page: devicePage, size: pageSize },
        deviceKeyword ? { name: deviceKeyword } : {},
        deviceRequest.signal,
      );
      const exactRequest = deviceKeyword
        ? getDevicePage(
            { page: 1, size: pageSize },
            { deviceId: deviceKeyword },
            deviceRequest.signal,
          )
        : undefined;
      const [nameResult, exactResult] = await Promise.all([
        nameRequest,
        exactRequest,
      ]);
      if (revision !== deviceRevision) return;
      const options = [
        ...(exactResult?.items ?? []),
        ...(nameResult?.items ?? []),
      ].map((item) => deviceOption(item));
      devices.value = mergeOptions(devices.value, options, reset);
      deviceTotal.value = Math.max(
        devices.value.length,
        (nameResult?.total ?? 0) + (exactResult?.total ?? 0),
      );
    } catch {
      if (!deviceRequest.signal.aborted && revision === deviceRevision) {
        deviceError.value = true;
      }
    } finally {
      if (revision === deviceRevision) deviceLoading.value = false;
    }
  }

  async function queryChannels(deviceId: string, keyword = '', reset = true) {
    const revision = ++channelRevision;
    channelRequest?.abort();
    channelRequest = new AbortController();
    channelDeviceId = deviceId;
    channelKeyword = keyword.trim();
    channelPage = reset ? 1 : channelPage + 1;
    if (!deviceId) {
      channels.value = [];
      channelTotal.value = 0;
      return;
    }
    channelLoading.value = true;
    channelError.value = false;
    try {
      const nameRequest = getDeviceChannelPage(
        { page: channelPage, size: pageSize },
        { deviceId, ...(channelKeyword ? { name: channelKeyword } : {}) },
        channelRequest.signal,
      );
      const exactRequest = channelKeyword
        ? getDeviceChannelPage(
            { page: 1, size: pageSize },
            { channelId: channelKeyword, deviceId },
            channelRequest.signal,
          )
        : undefined;
      const [nameResult, exactResult] = await Promise.all([
        nameRequest,
        exactRequest,
      ]);
      if (revision !== channelRevision) return;
      const options = [
        ...(exactResult?.items ?? []),
        ...(nameResult?.items ?? []),
      ].map((item) => channelOption(item));
      channels.value = mergeOptions(channels.value, options, reset);
      channelTotal.value = Math.max(
        channels.value.length,
        (nameResult?.total ?? 0) + (exactResult?.total ?? 0),
      );
    } catch {
      if (!channelRequest.signal.aborted && revision === channelRevision) {
        channelError.value = true;
      }
    } finally {
      if (revision === channelRevision) channelLoading.value = false;
    }
  }

  function searchDevices(keyword: string) {
    if (deviceTimer) clearTimeout(deviceTimer);
    deviceTimer = setTimeout(() => void queryDevices(keyword, true), 300);
  }

  function searchChannels(deviceId: string, keyword: string) {
    if (channelTimer) clearTimeout(channelTimer);
    channelTimer = setTimeout(
      () => void queryChannels(deviceId, keyword, true),
      300,
    );
  }

  function loadMoreDevices() {
    if (!deviceLoading.value && devices.value.length < deviceTotal.value) {
      void queryDevices(deviceKeyword, false);
    }
  }

  function loadMoreChannels() {
    if (!channelLoading.value && channels.value.length < channelTotal.value) {
      void queryChannels(channelDeviceId, channelKeyword, false);
    }
  }

  async function resolveDevice(deviceId: string) {
    if (!deviceId || devices.value.some((item) => item.value === deviceId)) {
      return;
    }
    try {
      const result = await getDevicePage({ page: 1, size: 1 }, { deviceId });
      const exact = result?.items?.find((item) => item.deviceId === deviceId);
      devices.value = mergeOptions(
        devices.value,
        exact
          ? [deviceOption(exact)]
          : [
              {
                label: `${deviceId} · ${$t('image.collections.camera.missing')}`,
                missing: true,
                online: false,
                value: deviceId,
              },
            ],
        false,
      );
    } catch {
      deviceError.value = true;
    }
  }

  async function resolveChannel(deviceId: string, channelId: string) {
    if (!channelId || channels.value.some((item) => item.value === channelId)) {
      return;
    }
    try {
      const result = await getDeviceChannelPage(
        { page: 1, size: 1 },
        { channelId, deviceId },
      );
      const exact = result?.items?.find((item) => item.channelId === channelId);
      channels.value = mergeOptions(
        channels.value,
        exact
          ? [channelOption(exact)]
          : [
              {
                disabled: true,
                label: `${channelId} · ${$t('image.collections.camera.missing')}`,
                missing: true,
                online: false,
                value: channelId,
              },
            ],
        false,
      );
    } catch {
      channelError.value = true;
    }
  }

  function clearChannels() {
    channelRequest?.abort();
    channels.value = [];
    channelTotal.value = 0;
    channelDeviceId = '';
    channelKeyword = '';
  }

  onBeforeUnmount(() => {
    deviceRequest?.abort();
    channelRequest?.abort();
    if (deviceTimer) clearTimeout(deviceTimer);
    if (channelTimer) clearTimeout(channelTimer);
  });

  return {
    channelError,
    channelLoading,
    channels,
    clearChannels,
    deviceError,
    deviceLoading,
    devices,
    loadMoreChannels,
    loadMoreDevices,
    queryChannels,
    queryDevices,
    resolveChannel,
    resolveDevice,
    searchChannels,
    searchDevices,
  };
}
