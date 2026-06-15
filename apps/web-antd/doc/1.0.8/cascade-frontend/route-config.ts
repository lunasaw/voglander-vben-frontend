/**
 * 级联管理路由配置
 *
 * 位置: src/router/routes/modules/cascade.ts
 *
 * 使用说明:
 * 1. 将此文件放到 src/router/routes/modules/ 目录下
 * 2. 路由会自动注册到系统
 */

import type { RouteRecordRaw } from 'vue-router';

const cascade: RouteRecordRaw = {
  path: '/cascade',
  name: 'Cascade',
  component: () => import('#/layouts/index.vue'),
  meta: {
    title: 'cascade.platform.title',
    icon: 'ant-design:cluster-outlined',
    orderNo: 50,
  },
  children: [
    {
      path: 'platform',
      name: 'CascadePlatform',
      component: () => import('#/views/cascade/platform/index.vue'),
      meta: {
        title: 'cascade.platform.title',
        icon: 'ant-design:cloud-server-outlined',
      },
    },
    {
      path: 'channel',
      name: 'CascadeChannel',
      component: () => import('#/views/cascade/channel/index.vue'),
      meta: {
        title: 'cascade.channel.title',
        icon: 'ant-design:api-outlined',
      },
    },
  ],
};

export default cascade;
