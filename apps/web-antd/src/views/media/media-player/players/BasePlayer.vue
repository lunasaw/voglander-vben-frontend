<script lang="ts">
// 通用播放器接口
export interface BasePlayerProps {
  url: string;
  format: string;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  controls?: boolean;
  fluid?: boolean;
}

export interface BasePlayerEmits {
  playerReady: [];
  playerError: [error: { code?: number; message: string }];
  formatNotSupported: [data: { format: string; message: string }];
}

// 通用播放器方法接口
export interface BasePlayerMethods {
  play: () => Promise<void>;
  pause: () => void;
  destroy: () => void;
  getPlayer: () => any | null;
}
</script>

<script lang="ts" setup>
// 空的setup部分用于保持SFC结构
</script>

<template>
  <!-- 基础播放器模板，子组件继承 -->
  <div class="base-player">
    <slot></slot>
  </div>
</template>

<style scoped>
.base-player {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #000;
  border-radius: 8px;
}
</style>
