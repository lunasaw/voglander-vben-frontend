import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

/**
 * 级联管理路由配置。
 *
 * 注意：web-antd accessMode='backend'，运行时路由由后端 /menu/all 下发，
 * 此静态定义仅作开发期占位/类型参考。后端菜单 route name 用 PascalCase（Cascade / CascadePlatform / CascadeChannel）。
 */
const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:share-2',
      order: 50,
      title: $t('cascade.menu'),
    },
    name: 'Cascade',
    path: '/cascade',
    children: [
      {
        path: '/cascade/platform',
        name: 'CascadePlatform',
        meta: {
          icon: 'lucide:cloud-upload',
          title: $t('cascade.platform.title'),
        },
        component: () => import('#/views/cascade/platform/index.vue'),
      },
      {
        path: '/cascade/channel',
        name: 'CascadeChannel',
        meta: {
          icon: 'lucide:git-branch',
          title: $t('cascade.channel.title'),
        },
        component: () => import('#/views/cascade/channel/index.vue'),
      },
    ],
  },
];

export default routes;
