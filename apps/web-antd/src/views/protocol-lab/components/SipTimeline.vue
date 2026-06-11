<script lang="ts" setup>
import type { LabEvent } from '#/composables/useSseEvents';

import { computed } from 'vue';

import { Empty, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

import { topicColor, topicLabel } from '../data';

/**
 * SIP / 事件阶梯时间线。
 *
 * 以"设备"为参照系渲染方向箭头：
 * - `out`（device / session / alarm 事件）：设备 → 平台，⬆ 上行
 * - `in` （clientcmd.*）：平台 → 设备，⬇ 下行
 *
 * 用于左侧"收到指令"与右侧"平台事件"两条时间线，靠 events 过滤后传入。
 */
const props = defineProps<{
  /** 空态提示文案。 */
  emptyText?: string;
  events: LabEvent[];
}>();

/** 最新事件在顶部。 */
const ordered = computed(() =>
  [...props.events].toSorted((a, b) => b.seq - a.seq),
);

function timeOf(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 摘要：PTZ 带方向+速度+hex，其它取关键字段。 */
function summaryOf(ev: LabEvent): string {
  const d = ev.data ?? {};
  if (ev.topic === 'clientcmd.ptz') {
    const parsed = d.parsed ?? {};
    const dir = parsed.direction ?? '?';
    const speed = parsed.speed ?? '';
    const hex = d.ptzCmd ?? parsed.hex ?? '';
    return `${dir} speed=${speed}  hex=${hex}`;
  }
  if (ev.topic === 'device.catalog') {
    return `${$t('protocolLab.field.channelCount')}: ${d.channelCount ?? 0}`;
  }
  if (ev.topic === 'device.info') {
    return `${d.manufacturer ?? ''} / ${d.model ?? ''} / ${d.firmware ?? ''}`;
  }
  if (ev.topic === 'device.register') {
    return `${d.remoteIp ?? ''}:${d.remotePort ?? ''} ${d.transport ?? ''} expire=${
      d.expire ?? ''
    }`;
  }
  if (ev.topic === 'clientcmd.register.fail') {
    return `statusCode=${d.statusCode ?? ''}`;
  }
  if (ev.topic.startsWith('clientcmd.query.')) {
    return `sn=${d.sn ?? ''}`;
  }
  if (ev.topic === 'clientcmd.invite' || ev.topic === 'session.invite_ok') {
    return `callId=${d.callId ?? ''}`;
  }
  // 兜底：deviceId / clientId / platformId
  return d.deviceId ?? d.clientId ?? d.platformId ?? '';
}
</script>

<template>
  <div class="sip-timeline">
    <Empty
      v-if="ordered.length === 0"
      :description="emptyText || $t('protocolLab.timeline.empty')"
      class="py-8"
    />
    <ul v-else class="timeline-list">
      <li
        v-for="ev in ordered"
        :key="ev.seq"
        class="timeline-item"
        :class="ev.dir === 'in' ? 'dir-in' : 'dir-out'"
      >
        <span class="arrow">{{ ev.dir === 'in' ? '⬇' : '⬆' }}</span>
        <span class="time">{{ timeOf(ev.ts) }}</span>
        <Tag :color="topicColor(ev.topic)" class="topic-tag">
          {{ topicLabel(ev.topic) }}
        </Tag>
        <span class="summary" :title="summaryOf(ev)">{{ summaryOf(ev) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sip-timeline {
  height: 100%;
  overflow-y: auto;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.timeline-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
  border-left: 3px solid transparent;
  border-radius: 4px;
}

.timeline-item.dir-in {
  background-color: hsl(var(--accent) / 30%);
  border-left-color: #2f54eb;
}

.timeline-item.dir-out {
  background-color: hsl(var(--accent) / 15%);
  border-left-color: #52c41a;
}

.arrow {
  font-size: 14px;
  font-weight: bold;
}

.time {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

.topic-tag {
  margin: 0;
}

.summary {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-mono, monospace);
  white-space: nowrap;
}
</style>
