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
        meta: {
          fullPathKey: false,
          icon: 'lucide:images',
          title: $t('image.assets.title'),
        },
        component: () => import('#/views/image/assets/list.vue'),
      },
      {
        path: '/image/assets/:assetId',
        name: 'ImageAssetDetail',
        meta: {
          fullPathKey: false,
          hideInMenu: true,
          title: $t('image.assets.detail.title'),
        },
        component: () => import('#/views/image/assets/list.vue'),
      },
      {
        path: '/image/collection',
        name: 'ImageCollections',
        meta: { icon: 'lucide:camera', title: $t('image.collection.title') },
        component: () => import('#/views/image/collection/list.vue'),
      },
      {
        path: '/image/collections',
        name: 'ImageCollectionsAlias',
        meta: {
          hideInMenu: true,
          title: $t('image.collection.title'),
        },
        component: () => import('#/views/image/collection/list.vue'),
      },
    ],
  },
];

export default routes;
