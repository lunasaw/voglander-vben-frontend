import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

/**
 * 设备管理路由（S4）。
 *
 * 注意：web-antd accessMode='backend'，运行时路由由后端 /menu/all 下发，
 * 此静态定义仅作开发期占位/类型参考。后端菜单 route name 用 PascalCase（Device / DeviceList）。
 */
const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:cctv',
      order: 100,
      title: $t('device.menu'),
    },
    name: 'Device',
    path: '/device',
    children: [
      {
        path: '/device/list',
        name: 'DeviceList',
        meta: {
          icon: 'mdi:cctv',
          title: $t('device.title'),
        },
        component: () => import('#/views/device/list.vue'),
      },
    ],
  },
];

export default routes;
