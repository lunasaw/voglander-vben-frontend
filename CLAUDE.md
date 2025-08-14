# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 常用命令

### 开发环境

```bash
# 启动交互式开发服务器选择
pnpm dev

# 启动特定应用程序
pnpm dev:antd          # Ant Design Vue 版本 (主要开发目标)
pnpm dev:ele           # Element Plus 版本
pnpm dev:naive         # Naive UI 版本
pnpm dev:docs          # 文档站点
pnpm dev:play          # 测试环境
```

### 构建

```bash
# 构建所有应用程序
pnpm build

# 构建特定应用程序
pnpm build:antd        # 主要目标 - Ant Design 版本
pnpm build:ele         # Element Plus 版本
pnpm build:naive       # Naive UI 版本
pnpm build:analyze     # 带包分析的构建

# Docker 构建
pnpm build:docker
```

### 代码质量检查

```bash
# 运行所有质量检查
pnpm check

# 单独检查
pnpm check:type        # TypeScript 类型检查
pnpm check:dep         # 依赖验证
pnpm check:circular    # 循环依赖检测
pnpm check:cspell      # 拼写检查

# 代码检查和格式化
pnpm lint              # 运行代码检查
pnpm format            # 格式化代码
```

### 测试

```bash
# 单元测试
pnpm test:unit

# E2E 测试
pnpm test:e2e          # 运行 Playwright 测试
```

### 媒体播放器开发

使用媒体播放器组件时：

- **管理组件**: `MediaPlayerManager.vue` 处理播放器类型检测和切换
- **播放器类型**: 支持 HLS、FLV 和 VideoJS 播放器，具有自动格式检测功能
- **错误处理**: 为不支持的格式实现回退机制
- **观看人数**: 支持实时观看人数更新和刷新功能
- **URL 复制**: 提供媒体 URL 的复制到剪贴板功能

### 包管理

```bash
# 清理并重新安装
pnpm reinstall

# 更新依赖
pnpm update:deps

# 检查未使用的依赖
pnpm check:dep

# 预览构建结果
pnpm preview
```

## 架构概览

### Monorepo 结构

这是一个 **pnpm workspace monorepo**，使用 **Turborepo** 进行编排：

- **`/apps/`** - 三个使用不同 UI 框架的 Web 应用程序：
  - `web-antd/` - **主要开发目标** (Ant Design Vue)
  - `web-ele/` - Element Plus 版本
  - `web-naive/` - Naive UI 版本
- **`/packages/`** - 按领域组织的共享库
- **`/internal/`** - 开发工具和配置
- **`/playground/`** - **样式和组件参考** 用于开发
- **`/docs/`** - VitePress 文档

### 关键开发规则

**主要开发位置**: 所有新开发工作都在 `apps/web-antd/` 中进行

**作用域限制**: 所有修改只能在当前所属页面内进行，禁止修改共享组件和其他模块的内容（除非明确要求）

**样式和模式参考**: `playground/src/views/` 包含权威示例：

- 组件使用模式
- UI/UX 设计标准
- 布局结构
- 交互行为

**API 集成**: API 定义分布在 `apps/web-antd/api/` 目录的多个 OpenAPI JSON 文件中：

- `Voglander.openapi-menu.json` - 菜单管理 API
- `Voglander.openapi-user.json` - 用户管理 API
- `Voglander.openapi-stream-proxy.json` - 流代理 API
- `Voglander.openapi-zlm.json` - ZLM 媒体服务器 API
- `Voglander.openapi-zlm-node.json` - ZLM 节点管理 API
- `Voglander.openapi-zlm-query.json` - ZLM 查询 API

### 技术栈

- **前端**: Vue 3 + TypeScript + Composition API
- **UI 框架**: Ant Design Vue (主要)、Element Plus、Naive UI
- **构建工具**: Vite 与自定义插件系统
- **路由**: Vue Router 4 与后端驱动的权限
- **状态管理**: Pinia 与持久化和加密
- **样式**: Tailwind CSS + CSS 自定义属性
- **表格**: VXE Table 用于复杂数据网格
- **表单**: 基于模式的动态表单与验证
- **图标**: 统一的 `@vben/icons` 系统 (Lucide 图标)
- **媒体播放**: Video.js、FLV.js、HLS.js 支持多种视频流格式

### 包组织结构

```
packages/
├── @core/               # 核心框架
│   ├── base/           # 基础工具
│   ├── composables/    # Vue 组合式函数
│   ├── preferences/    # 用户偏好
│   └── ui-kit/         # 共享 UI 组件
├── effects/            # 功能包
│   ├── access/         # 权限控制
│   ├── common-ui/      # 通用 UI 组件
│   ├── request/        # HTTP 客户端
│   └── layouts/        # 布局组件
└── [business]/         # 特定领域包
    ├── icons/          # 统一图标系统
    ├── locales/        # 国际化
    ├── stores/         # 状态管理
    └── utils/          # 工具函数
```

## 开发模式

### 组件开发

1. **优先参考**: 总是检查 `playground/src/views/examples/` 中的现有模式
2. **VXE Table**: 用于数据网格并配置适当的滚动：
   ```typescript
   scrollX: { enabled: true },
   scrollY: { enabled: true }
   ```
3. **表单**: 使用 `@vben/common-ui` 中基于模式的动态表单
4. **模态框/抽屉**: 遵循 playground 示例中的模式

### 图标使用

- **仅使用**: `@vben/icons` (基于 Lucide)
- **禁止使用**: `@ant-design/icons-vue`、`@iconify/vue` 等
- **导入模式**: `import { Search, Plus, Settings } from '@vben/icons'`
- **可用图标**: 检查 `packages/@core/base/icons/src/lucide.ts`

### 权限控制

实现 **双重权限保护**：

```typescript
// 1. 按钮可见性控制
{
  code: 'edit',
  show: () => hasAccessByCodes(['Module:Entity:Edit']),
}

// 2. 操作时验证
function onEdit(row: any) {
  if (!hasAccessByCodes(['Module:Entity:Edit'])) {
    message.error('您没有编辑权限');
    return;
  }
  // 执行编辑逻辑
}
```

### 状态管理模式

- **状态切换**: 使用 `CellSwitch` 渲染器进行直接状态更改
- **确认对话框**: 总是确认破坏性操作
- **错误处理**: 一致的错误消息和用户反馈
- **加载状态**: 对异步操作使用 message.loading

### API 集成

- **基础 URL**: 通过环境变量配置
- **身份验证**: Bearer token 与自动刷新
- **错误处理**: 集中化的用户友好消息
- **类型安全**: 所有响应的完整 TypeScript 接口
- **时间格式**: 后端发送时间戳（毫秒），前端处理时区转换

### 国际化

- **框架**: Vue I18n 与动态加载
- **结构**: 按功能区域的模块化 JSON 文件
- **命名**: `module.entity.action` 模式 (例如: `system.user.edit`)
- **必需**: 所有面向用户的文本必须国际化
- **位置**: `apps/web-antd/src/locales/langs/`

## 文件结构约定

### 页面组织

```
apps/web-antd/src/views/[module]/[entity]/
├── list.vue           # 主列表/表格页面
├── detail.vue         # 详情/查看页面 (如需要)
├── data.ts           # 列定义、模式、工具函数
└── modules/
    └── form.vue      # 创建/编辑表单组件
```

### API 组织

```
apps/web-antd/src/api/[module]/
├── [entity].ts       # 实体特定的 API 调用
└── types.ts          # TypeScript 接口
```

### 路由组织

```
apps/web-antd/src/router/routes/modules/
├── [module].ts       # 模块路由定义
```

## 配置文件

### 环境变量

- **开发**: API 代理到 `http://0.0.0.0:8081`
- **安全**: 存储持久化的加密密钥
- **功能**: 切换开发工具、分析等

### 构建配置

- **Vite**: `/internal/vite-config/` 中的自定义插件系统
- **TypeScript**: `/internal/tsconfig/` 中的共享配置
- **Tailwind**: `/internal/tailwind-config/` 中的共享配置

### 质量工具

- **ESLint**: Vue 3 + TypeScript 规则与自动修复
- **Prettier**: 集成 Tailwind 类排序
- **Stylelint**: SCSS 支持与 Recess 排序
- **Commitlint**: 需要规范提交

### 代码规范配置

项目使用自定义 ESLint 配置位于 `/internal/lint-configs/eslint-config`，确保代码符合项目标准：

#### 核心规范要求

**Vue 组件规范**:

- 组件名使用 PascalCase：`<MyComponent>`
- 属性使用 kebab-case：`my-prop`
- 事件名使用 camelCase：`myEvent`
- 模板中必须使用双引号：`<div class="container">`
- 组件块顺序：`<script>` → `<template>` → `<style>`
- defineOptions 宏顺序：`defineOptions` → `defineProps` → `defineEmits` → `defineSlots`

**TypeScript 规范**:

- 禁用 `any` 类型检查（项目需要灵活性）
- 禁用显式返回类型要求
- 未使用变量必须以 `_` 开头：`_unusedParam`
- 允许 `ts-expect-error` 和 `ts-ignore` 但需要描述
- 禁用非空断言操作符 `!`

**JavaScript 基础规范**:

- 使用 `===` 和 `!==` 进行比较
- 优先使用 `const` 声明
- 优先使用模板字符串而非字符串拼接
- 禁用 `console.log`（允许 `console.warn` 和 `console.error`）
- 禁用 `debugger` 语句
- 删除未使用的导入
- 对象属性使用简写语法

**命名约定**:

- 文件名：kebab-case (`my-component.vue`)
- 变量/函数：camelCase (`myFunction`)
- 常量：UPPER_SNAKE_CASE (`MY_CONSTANT`)
- 类型/接口：PascalCase (`MyInterface`)
- 组件：PascalCase (`MyComponent`)

## 测试方法

### 单元测试

- **框架**: Vitest 与 Happy DOM
- **位置**: 协同定位的 `*.test.ts` 文件
- **覆盖率**: 集成报告

### E2E 测试

- **框架**: Playwright
- **位置**: `/playground/__tests__/e2e/`
- **浏览器**: Chromium 主要，跨浏览器支持

## 常见开发工作流程

### 创建新的管理页面

1. 检查 `apps/web-antd/api/` 目录中的相关 OpenAPI 定义文件
2. 在 `playground/src/views/examples/` 中找到类似模式
3. 在 `apps/web-antd/src/views/[module]/[entity]/` 中创建页面结构
4. 在 `apps/web-antd/src/api/[module]/` 中实现 API 层
5. 在 `apps/web-antd/src/router/routes/modules/` 中添加路由定义
6. 创建国际化文件
7. 生成数据库菜单记录 SQL (参考 `apps/web-antd/sql/menu-data-insert.sql`)

### 添加新功能

1. **规划**: 检查 playground 中的现有模式
2. **实现**: 遵循既定约定
3. **测试**: 运行类型检查和单元测试
4. **检查**: 确保代码质量标准
5. **文档**: 更新国际化文件

### 使用表格

- 对复杂数据网格使用 VXE Table
- 为宽表格配置滚动选项
- 实现适当的列宽设置
- 对操作使用固定列 (`fixed: 'right'`)
- 遵循操作按钮的权限模式

### Git 工作流程

- **规范提交**: 通过 commitlint 要求
- **预提交钩子**: 自动代码检查和格式化
- **分支命名**: 遵循规范模式
- **代码质量**: 提交前所有检查必须通过

## 组件化开发规范

基于企业级Vue 3项目的完整组件化开发规范和模式。

### 核心组件化思想

**1. 分层组件架构**

```
├── 适配器层 (Adapter Layer)        # 统一组件接口和默认配置
│   ├── component/index.ts          # 组件注册和类型定义
│   ├── form.ts                     # 表单适配器配置
│   └── vxe-table.ts               # 表格适配器配置
├── 业务组件层 (Business Layer)      # 特定业务逻辑的复用组件
│   ├── NodeSelector.vue           # 节点选择器
│   └── MediaPlayerManager.vue     # 媒体播放器管理器
└── 页面组件层 (Page Layer)          # 组合各种组件的页面级组件
    ├── list.vue                   # 列表页面
    ├── data.ts                    # 页面配置和数据逻辑
    └── modules/form.vue           # 表单子组件
```

**2. Schema驱动的组件设计**

所有复杂组件都采用配置驱动的方式，通过Schema定义组件行为：

```typescript
// 表单Schema示例
export function useFormSchema(isEditMode = false): VbenFormSchema[] {
  return [
    {
      component: 'Input', // 组件类型
      componentProps: {
        /* ... */
      }, // 组件属性
      fieldName: 'app', // 字段名
      label: $t('media.streamProxy.app'), // 国际化标签
      rules: 'required', // 验证规则
      dependencies: {
        // 依赖关系
        show: (values) => !!values.showAdvanced,
        triggerFields: ['showAdvanced'],
      },
    },
  ];
}
```

**3. 组件适配器模式**

统一不同UI库的组件接口，提供一致的开发体验：

```typescript
// 组件适配器注册
const components: Partial<Record<ComponentType, Component>> = {
  Input: withDefaultPlaceholder(Input, 'input'),
  Select: withDefaultPlaceholder(Select, 'select'),
  NodeSelector, // 自定义业务组件
};
```

### 组件开发标准规范

**1. 组件文件组织**

```
component-name/
├── index.vue          # 主组件文件
├── data.ts           # 配置数据和逻辑函数
├── composables/      # 组合式函数
│   └── useFeature.ts
├── components/       # 子组件
│   └── SubComponent.vue
└── types.ts          # TypeScript类型定义
```

**2. 组件接口设计规范**

```typescript
// Props接口定义
export interface ComponentProps {
  modelValue?: string | number | null;
  loading?: boolean;
  disabled?: boolean;
  // ... 其他属性
}

// Emits事件定义
export interface ComponentEmits {
  (e: 'update:modelValue', value: string | number | null): void;
  (e: 'change', value: string | number | null, extra?: any): void;
}

// 组件暴露的方法
defineExpose({
  refresh,
  validate,
  reset,
});
```

**3. 组合式函数封装**

将复用逻辑抽取为组合式函数：

```typescript
// composables/usePlayerDetection.ts
export function usePlayerDetection() {
  const getBestFormat = (playUrls: PlayUrls) => {
    // 格式检测逻辑
  };

  const getPlayerForFormat = (format: string) => {
    // 播放器选择逻辑
  };

  return {
    getBestFormat,
    getPlayerForFormat,
  };
}
```

**4. 响应式状态管理**

```typescript
// 状态定义
const nodeListData = ref<MediaNodeVO[]>([]);
const nodeListLoading = ref(false);

// 计算属性
const sortedNodeList = computed(() => {
  return [...nodeListData.value].sort((a, b) => {
    // 排序逻辑
  });
});

// 监听器
watch(
  () => props.playUrls,
  () => {
    // 响应逻辑
  },
  { immediate: true, deep: true },
);
```

### 业务组件开发模式

**1. 管理器组件模式** - `MediaPlayerManager`

用于管理多个相关组件的中央协调器：

```typescript
// 组件映射
const playerComponents = {
  VideoJsPlayer,
  FlvPlayer,
  HlsPlayer,
};

// 动态组件渲染
const currentPlayerComponent = shallowRef();

// 组件切换逻辑
function switchPlayer(format: string) {
  const playerInfo = getPlayerForFormat(format);
  currentPlayerComponent.value = playerComponents[playerInfo.component];
}
```

**2. 选择器组件模式** - `NodeSelector`

具有数据获取、过滤、排序功能的选择组件：

```typescript
// 数据获取
async function fetchNodeList() {
  nodeListLoading.value = true;
  try {
    const response = await getEnabledMediaNodeList();
    nodeListData.value = response;
    emit('nodeListLoaded', response);
  } finally {
    nodeListLoading.value = false;
  }
}

// 定时刷新
onMounted(() => {
  fetchNodeList();
  startRefreshTimer();
});
```

**3. 数据配置组件模式** - `data.ts`

将组件配置和业务逻辑分离：

```typescript
// 表单配置
export function useFormSchema(): VbenFormSchema[] {
  /* ... */
}

// 表格列配置
export function useColumns(onActionClick, onStatusChange): VxeTableColumn[] {
  /* ... */
}

// 搜索表单配置
export function useGridFormSchema(): VbenFormSchema[] {
  /* ... */
}
```

### 页面组件组合模式

**1. 标准CRUD页面结构**

```vue
<script setup>
// 1. 导入适配器和API
import { useVbenVxeGrid, useVbenDrawer } from '#/adapter';
import { getPageList, deleteItem } from '#/api';

// 2. 配置表格和表单
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useColumns(onActionClick),
    proxyConfig: { ajax: { query: getPageList } },
  },
});

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
});

// 3. 事件处理
function onActionClick(e) {
  switch (e.code) {
    case 'edit':
      onEdit(e.row);
      break;
    case 'delete':
      onDelete(e.row);
      break;
  }
}
</script>

<template>
  <Page>
    <!-- 操作工具栏 -->
    <template #header>
      <Button @click="onCreate" v-if="hasAccess(['Create'])">
        <Plus /> {{ $t('common.create') }}
      </Button>
    </template>

    <!-- 数据表格 -->
    <Grid />

    <!-- 表单抽屉 -->
    <FormDrawer />
  </Page>
</template>
```

**2. 权限控制模式**

```typescript
// 双重权限保护
const showEdit = () => hasAccessByCodes(['Module:Entity:Edit']);

function onEdit(row: any) {
  if (!hasAccessByCodes(['Module:Entity:Edit'])) {
    message.error('您没有编辑权限');
    return;
  }
  // 执行编辑逻辑
}
```

### 组件通信和状态管理

**1. Props Down / Events Up**

```vue
<!-- 父组件向子组件传递数据 -->
<NodeSelector
  v-model="selectedNode"
  :loading="loading"
  @change="onNodeChange"
  @nodeListLoaded="onNodeListLoaded"
/>
```

**2. 全局状态管理**

```typescript
// utils/node-state.ts
const currentNodeKey = ref<string | null>(null);

export function setCurrentNodeKey(key: string) {
  currentNodeKey.value = key;
}

export function getCurrentNodeKey() {
  return currentNodeKey.value;
}
```

**3. 组件间通信**

```typescript
// 暴露方法给父组件
defineExpose({
  refresh: refreshCurrentPlayer,
  destroy: destroyCurrentPlayer,
  getCurrentPlayer: () => currentPlayerRef.value,
});

// 父组件调用子组件方法
const playerRef = ref();
playerRef.value?.refresh();
```

### 组件性能优化

**1. 懒加载和异步组件**

```typescript
const AsyncComponent = defineAsyncComponent(
  () => import('./HeavyComponent.vue'),
);
```

**2. 响应式优化**

```typescript
// 使用shallowRef避免深度响应式
const currentPlayerComponent = shallowRef();

// 使用computed缓存计算结果
const sortedData = computed(() => {
  return expensiveComputation(rawData.value);
});
```

**3. 组件缓存和复用**

```typescript
// 组件映射缓存
const componentCache = new Map();
function getComponent(type: string) {
  if (!componentCache.has(type)) {
    componentCache.set(type, createComponent(type));
  }
  return componentCache.get(type);
}
```

### 媒体播放器架构实例

项目中的媒体播放器系统是组件化思想的典型应用：

**核心组件**：

- **MediaPlayerManager.vue**: 中央管理器，处理播放器类型检测和切换
- **BasePlayer.vue**: 抽象基类，定义播放器接口
- **HlsPlayer.vue/FlvPlayer.vue/VideoJsPlayer.vue**: 具体播放器实现

**设计特点**：

- **策略模式**: 根据媒体格式自动选择合适的播放器
- **适配器模式**: 统一不同播放器的接口
- **组合模式**: 播放器管理器组合多个播放器实例
- **观察者模式**: 事件驱动的播放器状态管理

### 组件开发最佳实践

1. **单一职责**: 每个组件只负责一个明确的功能
2. **接口一致**: 使用统一的Props和Events接口
3. **配置驱动**: 通过配置而非代码控制组件行为
4. **类型安全**: 完整的TypeScript类型定义
5. **可测试性**: 逻辑与视图分离，便于单元测试
6. **可访问性**: 支持键盘导航和屏幕阅读器
7. **国际化**: 所有用户界面文本支持多语言
8. **性能优化**: 合理使用缓存和懒加载策略
