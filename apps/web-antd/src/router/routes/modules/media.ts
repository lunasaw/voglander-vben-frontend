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
    ],
  },
];

export default routes;
