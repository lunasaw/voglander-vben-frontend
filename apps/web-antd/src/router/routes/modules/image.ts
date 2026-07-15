import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:image',
      order: 7,
      title: $t('image.management.title'),
    },
    name: 'ImageManagement',
    path: '/image',
    children: [
      {
        path: '/image/assets',
        name: 'ImageAssets',
        meta: { icon: 'lucide:images', title: $t('image.assets.title') },
        component: () => import('#/views/image/assets/list.vue'),
      },
      {
        path: '/image/assets/:assetId',
        name: 'ImageAssetDetail',
        meta: { hideInMenu: true, title: $t('image.assets.detail.title') },
        component: () => import('#/views/image/assets/list.vue'),
      },
      {
        path: '/image/collection',
        name: 'ImageCollections',
        meta: { icon: 'lucide:camera', title: $t('image.collections.title') },
        component: () => import('#/views/image/collections/list.vue'),
      },
      {
        path: '/image/collections',
        name: 'ImageCollectionsLegacy',
        meta: {
          hideInMenu: true,
          title: $t('image.collections.title'),
        },
        component: () => import('#/views/image/collections/list.vue'),
      },
    ],
  },
];

export default routes;
