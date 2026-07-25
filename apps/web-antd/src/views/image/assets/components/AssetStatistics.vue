<script lang="ts" setup>
import type { ImageApi, ImageAssetStatus } from '#/api/image';

import { computed } from 'vue';

import { Card, Statistic } from 'ant-design-vue';

import { $t } from '#/locales';

const props = defineProps<{
  activeStatus?: ImageAssetStatus;
  loading?: boolean;
  statistics: ImageApi.AssetStatisticsVO;
}>();

const emit = defineEmits<{
  select: [status?: ImageAssetStatus];
}>();

const cards = computed(() => [
  {
    key: 'total',
    label: $t('image.assets.stats.total'),
    status: undefined,
    value: props.statistics.total ?? 0,
  },
  {
    key: 'available',
    label: $t('image.assets.stats.available'),
    status: 'AVAILABLE' as const,
    value: props.statistics.available ?? 0,
  },
  {
    key: 'today',
    label: $t('image.assets.stats.today'),
    value: props.statistics.today ?? 0,
  },
  {
    danger: (props.statistics.deleteFailed ?? 0) > 0,
    key: 'deleteFailed',
    label: $t('image.assets.stats.deleteFailed'),
    status: 'DELETE_FAILED' as const,
    value: props.statistics.deleteFailed ?? 0,
  },
]);

function isActive(status?: ImageAssetStatus) {
  return status ? props.activeStatus === status : !props.activeStatus;
}
</script>

<template>
  <section
    class="asset-statistics"
    :aria-label="$t('image.assets.stats.label')"
  >
    <Card
      v-for="card in cards"
      :key="card.key"
      size="small"
      :loading="loading"
      :class="{
        'asset-statistics__card--active':
          card.key !== 'today' && isActive(card.status),
        'asset-statistics__card--danger': card.danger,
        'asset-statistics__card--interactive': card.key !== 'today',
      }"
      :role="card.key === 'today' ? undefined : 'button'"
      :tabindex="card.key === 'today' ? undefined : 0"
      @click="card.key !== 'today' && emit('select', card.status)"
      @keydown.enter.prevent="
        card.key !== 'today' && emit('select', card.status)
      "
      @keydown.space.prevent="
        card.key !== 'today' && emit('select', card.status)
      "
    >
      <Statistic :title="card.label" :value="card.value" />
    </Card>
  </section>
</template>

<style scoped>
.asset-statistics {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 12px;
}

.asset-statistics__card--interactive {
  cursor: pointer;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.asset-statistics__card--interactive:hover {
  transform: translateY(-1px);
}

.asset-statistics__card--interactive:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.asset-statistics__card--active {
  border-color: var(--primary);
}

.asset-statistics__card--danger :deep(.ant-statistic-content) {
  color: var(--destructive);
}

@media (min-width: 640px) {
  .asset-statistics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .asset-statistics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .asset-statistics__card--interactive {
    transition: none;
  }
}
</style>
