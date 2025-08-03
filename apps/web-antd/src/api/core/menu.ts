import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi() {
  return requestClient.get<RouteRecordStringComponent[]>('/menu/all');
}

/**
 * 获取用户权限菜单（前端路由格式）
 */
export async function getUserPermissionMenusApi() {
  return requestClient.get<RouteRecordStringComponent[]>(
    '/system/menu/permissions',
  );
}
