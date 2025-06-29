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
        name: 'MediaNode',
        meta: {
          icon: 'mdi:server-network',
          title: $t('media.node.title'),
        },
        component: () => import('#/views/media/node/list.vue'),
      },
      {
        path: '/media/node/detail/:nodeKey',
        name: 'MediaNodeDetail',
        meta: {
          hideInMenu: true,
          icon: 'mdi:server-network',
          title: $t('media.node.detail'),
        },
        component: () => import('#/views/media/node/detail.vue'),
      },
    ],
  },
];

export default routes;
