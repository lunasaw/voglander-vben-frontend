<script lang="ts" setup>
import type { DeviceApi } from '#/api/device';
import type { LabEvent } from '#/composables/useSseEvents';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Divider,
  message,
} from 'ant-design-vue';

import {
  broadcast,
  controlAlarm,
  controlRecordStart,
  controlRecordStop,
  downloadConfig,
  liveStart,
  ptzControl,
  queryAlarm,
  queryCatalog,
  queryDeviceInfo,
  queryDeviceStatus,
  queryMobilePosition,
  queryPreset,
  queryRecord,
  rebootDevice,
} from '#/api/device';
import DeviceCommandPanel from '#/components/DeviceCommandPanel.vue';
import MediaPlayer from '#/components/MediaPlayer.vue';
import PtzControl from '#/components/PtzControl.vue';
import { $t } from '#/locales';
import SipTimeline from '#/views/protocol-lab/components/SipTimeline.vue';

/**
 * 设备操作面板（§4.3）。
 *
 * 复用红线（去重核心）：
 *  - PTZ / 点播 直接调既有 /ptz、/live 端点（与协议台 ServerPanel 同源），不重建。
 *  - PtzControl / MediaPlayer / SipTimeline 一律 import 复用。
 *  - 支链命令（query-status/preset/mobile-position、config、record、alarm、broadcast）调 S2 新端点。
 *
 * 本组件 prop 驱动（device），由 device-detail.vue 抽屉包裹，便于单测。
 */
const props = withDefaults(
  defineProps<{
    /** 挂载即自动点播（列表「实时点播」入口）。 */
    autoLive?: boolean;
    /** 选中设备；null 时命令禁用。 */
    device?: DeviceApi.DeviceVO | null;
    /** 设备相关 SSE 事件（已按 deviceId 过滤），用于时间线。 */
    events?: LabEvent[];
  }>(),
  { autoLive: false, device: null, events: () => [] },
);

const { hasAccessByCodes } = useAccess();

const loading = ref(false);

/** 点播播放器弹窗。 */
const playerOpen = ref(false);
const playerUrls = ref<DeviceApi.LivePlayVO['playUrls']>(undefined);
const playerTitle = ref('');

const deviceId = computed(() => props.device?.deviceId ?? '');
/** catalog 通道命名规则：deviceId + 两位序号；缺省回退 deviceId+'01'（与协议台一致）。 */
const channelId = computed(() => (deviceId.value ? `${deviceId.value}01` : ''));
const hasDevice = computed(() => !!deviceId.value);

/**
 * 统一命令执行：校验设备在线 + 权限码，再调 fn，最后 toast。
 * 任一前置不满足直接 return（权限双重防护 §4.3）。
 */
async function run(
  code: string,
  fn: () => Promise<unknown>,
  okKey = 'device.msg.cmdSent',
) {
  if (!hasDevice.value) {
    return;
  }
  if (!hasAccessByCodes([code])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  loading.value = true;
  try {
    await fn();
    message.success($t(okKey));
  } catch {
    message.error($t('device.msg.cmdFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 设备命令分发（DeviceCommandPanel emit）。
 *
 * 命令集与协议验证台对等（验证台「验协议」、设备页「管设备」）；此处注入的是
 * 设备页实现：权限码门禁（Device:Cmd:*）+ #/api/device 端点。
 */
function onCommand({
  code,
  configType,
}: {
  code: string;
  configType?: string;
}) {
  const id = deviceId.value;
  // 录像 / 报警查询后端强制时间范围（Unix 毫秒），默认最近 24h。
  // G1：录像结果走 device.recordinfo 通知，列表本体暂无读端点 → 仅触发 + 提示。
  const endTime = Date.now();
  const startTime = endTime - 24 * 60 * 60 * 1000;
  const map: Record<
    string,
    { fn: () => Promise<unknown>; ok?: string; perm: string }
  > = {
    queryCatalog: { perm: 'Device:Cmd:Query', fn: () => queryCatalog(id) },
    queryInfo: { perm: 'Device:Cmd:Query', fn: () => queryDeviceInfo(id) },
    queryStatus: { perm: 'Device:Cmd:Query', fn: () => queryDeviceStatus(id) },
    queryPreset: { perm: 'Device:Cmd:Query', fn: () => queryPreset(id) },
    queryMobilePosition: {
      perm: 'Device:Cmd:Query',
      fn: () => queryMobilePosition(id),
    },
    configDownload: {
      perm: 'Device:Cmd:Config',
      fn: () => downloadConfig(id, configType ?? 'BASIC'),
    },
    recordStart: {
      perm: 'Device:Cmd:Record',
      fn: () => controlRecordStart(id),
    },
    recordStop: { perm: 'Device:Cmd:Record', fn: () => controlRecordStop(id) },
    recordQuery: {
      perm: 'Device:Cmd:Record',
      ok: 'device.msg.recordQuerySent',
      fn: () => queryRecord({ deviceId: id, startTime, endTime }),
    },
    alarmQuery: {
      perm: 'Device:Cmd:Alarm',
      fn: () => queryAlarm({ deviceId: id, startTime, endTime }),
    },
    // 报警复位默认 alarmMethod=1（电话报警）alarmType=0（全部），后端强制非空。
    alarmControl: {
      perm: 'Device:Cmd:Alarm',
      fn: () =>
        controlAlarm({ deviceId: id, alarmMethod: '1', alarmType: '0' }),
    },
    broadcast: { perm: 'Device:Cmd:Broadcast', fn: () => broadcast(id) },
    reboot: { perm: 'Device:Cmd:Config', fn: () => rebootDevice(id) },
  };
  const entry = map[code];
  if (!entry) {
    return;
  }
  run(entry.perm, entry.fn, entry.ok);
}

/* ----------------------------- PTZ（复用 /ptz） ----------------------------- */
function onPtz(payload: {
  channelId?: string;
  command: string;
  deviceId: string;
  speed: number;
}) {
  run('Device:Cmd:Ptz', () => ptzControl(payload), 'device.msg.ptzSent');
}

/* ----------------------------- 点播（复用 /live） ----------------------------- */
function onLiveStart() {
  if (!hasDevice.value) {
    return;
  }
  if (!hasAccessByCodes(['Device:Cmd:Live'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  loading.value = true;
  liveStart({ deviceId: deviceId.value, channelId: channelId.value })
    .then((vo) => {
      message.success($t('device.msg.liveSent'));
      // GB 直播首选 HTTP-FLV（首帧快）；有可播地址才开弹窗，失败不打扰。
      if (vo?.playUrls && Object.keys(vo.playUrls).length > 0) {
        playerUrls.value = vo.playUrls;
        playerTitle.value = `${deviceId.value} · ${channelId.value}`;
        playerOpen.value = true;
      }
    })
    .finally(() => {
      loading.value = false;
    });
}

function onPlayerClose() {
  playerOpen.value = false;
}

onMounted(() => {
  if (props.autoLive && hasDevice.value) {
    onLiveStart();
  }
});
</script>

<template>
  <div class="device-ops">
    <!-- 基础信息 -->
    <Descriptions size="small" :column="2" bordered>
      <DescriptionsItem :label="$t('device.field.deviceId')">
        {{ device?.deviceId ?? '-' }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('device.field.status')">
        {{ device?.statusName ?? '-' }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('device.field.channelCount')">
        {{ device?.channelCount ?? 0 }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('device.field.name')">
        {{ device?.name ?? '-' }}
      </DescriptionsItem>
    </Descriptions>

    <!-- PTZ 方向盘（复用共享组件） -->
    <Divider>{{ $t('device.section.ptz') }}</Divider>
    <PtzControl
      :device-id="deviceId"
      :channel-id="channelId"
      :disabled="!hasDevice || loading"
      @command="onPtz"
    />

    <!-- 全协议命令面板（与协议验证台同源组件，能力对等）。 -->
    <DeviceCommandPanel
      :disabled="!hasDevice || loading"
      @command="onCommand"
    />

    <!-- 点播留在父页：返回 playUrls 后由本页管理 MediaPlayer 弹窗。 -->
    <Divider>{{ $t('device.section.media') }}</Divider>
    <Button
      type="primary"
      :disabled="!hasDevice || loading"
      @click="onLiveStart"
    >
      {{ $t('device.action.live') }}
    </Button>

    <!-- 实时事件时间线（复用 SipTimeline，过滤当前设备 device.*） -->
    <Divider>{{ $t('device.section.events') }}</Divider>
    <div class="timeline-wrap">
      <SipTimeline
        :events="events"
        :empty-text="$t('device.msg.eventsEmpty')"
      />
    </div>

    <!-- 点播播放器弹窗：liveStart 返回 playUrls 后自动起播。 -->
    <MediaPlayer
      :open="playerOpen"
      :play-urls="playerUrls"
      :title="playerTitle"
      format="httpFlv"
      @close="onPlayerClose"
    />
  </div>
</template>

<style scoped>
.device-ops {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-wrap {
  min-height: 200px;
  max-height: 320px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
