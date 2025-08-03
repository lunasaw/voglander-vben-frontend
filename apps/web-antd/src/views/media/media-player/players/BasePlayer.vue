<script lang="ts" setup generic="T = any">
import type { ZlmMediaApi } from '#/api/media/zlm-media';

// 通用播放器接口
interface BasePlayerProps {
  url: string;
  format: string;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  controls?: boolean;
  fluid?: boolean;
}

interface BasePlayerEmits {
  'player-ready': [];
  'player-error': [error: { code?: number; message: string }];
  'format-not-supported': [data: { format: string; message: string }];
}

// 通用播放器方法接口
interface BasePlayerMethods {
  play: () => Promise<void>;
  pause: () => void;
  destroy: () => void;
  getPlayer: () => T | null;
}

// 导出类型给子组件使用
export type { BasePlayerProps, BasePlayerEmits, BasePlayerMethods };
</script>

<template>
  <!-- 基础播放器模板，子组件继承 -->
  <div class="base-player">
    <slot />
  </div>
</template>

<style scoped>
.base-player {
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}
</style>