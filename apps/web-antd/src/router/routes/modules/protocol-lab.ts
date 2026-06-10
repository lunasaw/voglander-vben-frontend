import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:lan-connect',
      order: 9995,
      title: $t('protocolLab.category'),
    },
    name: 'ProtocolLab',
    path: '/protocol-lab',
    children: [
      {
        path: '/protocol-lab/gb28181',
        name: 'protocolLab.gb28181',
        meta: {
          icon: 'mdi:lan-connect',
          title: $t('protocolLab.menu'),
        },
        component: () => import('#/views/protocol-lab/index.vue'),
      },
    ],
  },
];

export default routes;
