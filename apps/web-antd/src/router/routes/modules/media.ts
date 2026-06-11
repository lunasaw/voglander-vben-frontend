import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:server-network',
      order: 9996,
      title: $t('media.title'),
    },
    name: 'Media',
    path: '/media',
    children: [
      {
        path: '/media/node',
        name: 'media.node',
        meta: {
          icon: 'mdi:server-network',
          title: $t('media.node.title'),
        },
        component: () => import('#/views/media/node/list.vue'),
      },
      {
        path: '/media/node/detail/:nodeKey',
        name: 'media.node.detail',
        meta: {
          hideInMenu: true,
          icon: 'mdi:server-network',
          title: $t('media.node.detail'),
        },
        component: () => import('#/views/media/node/detail.vue'),
      },
      {
        path: '/media/list',
        name: 'media.list',
        meta: {
          icon: 'mdi:video-outline',
          title: $t('media.list.title'),
        },
        component: () => import('#/views/media/list/list.vue'),
      },
      {
        path: '/media/stream-proxy',
        name: 'media.streamProxy',
        meta: {
          icon: 'mdi:video-switch',
          title: $t('media.streamProxy.title'),
        },
        component: () => import('#/views/media/stream-proxy/list.vue'),
      },
      {
        path: '/media/push-proxy',
        name: 'media.pushProxy',
        meta: {
          icon: 'mdi:video-switch-outline',
          title: $t('media.pushProxy.title'),
        },
        component: () => import('#/views/media/push-proxy/list.vue'),
      },
    ],
  },
];

export default routes;
