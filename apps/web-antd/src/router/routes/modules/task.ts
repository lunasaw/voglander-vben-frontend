import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

/** Backend tb_menu.component for TaskCenter. */
export const TASK_CENTER_COMPONENT = '/task/center/list';
export const TASK_CENTER_PATH = '/task/center/list';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:list-checks',
      order: 6,
      title: $t('task.management.title'),
    },
    name: 'TaskManagement',
    path: '/task',
    children: [
      {
        component: () => import('#/views/task/center/list.vue'),
        meta: {
          icon: 'lucide:activity',
          title: $t('task.center.title'),
        },
        name: 'TaskCenter',
        path: TASK_CENTER_PATH,
      },
    ],
  },
];

export default routes;
