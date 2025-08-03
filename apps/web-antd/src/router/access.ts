import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { message } from 'ant-design-vue';

import { getUserPermissionMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  console.log('🚀 generateAccess 开始执行', options);
  console.log('🔧 当前访问模式:', preferences.app.accessMode);

  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      console.log('📡 开始获取用户菜单');
      message.loading({
        content: `${$t('common.loadingMenu')}...`,
        duration: 1.5,
      });

      try {
        const result = await getUserPermissionMenusApi();
        console.log('✅ 菜单获取成功', result);
        return result;
      } catch (error) {
        console.error('❌ 菜单获取失败', error);
        throw error;
      }
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
