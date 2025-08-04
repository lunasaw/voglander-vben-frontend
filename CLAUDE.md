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
pnpm test:e2e-ui       # 交互式 UI 模式
pnpm test:e2e-codegen  # 生成测试
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

**样式和模式参考**: `playground/src/views/` 包含权威示例：

- 组件使用模式
- UI/UX 设计标准
- 布局结构
- 交互行为

**API 集成**: 所有 API 定义在 `apps/web-antd/api/Voglander.openapi.json` 中

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

1. 检查 `apps/web-antd/api/Voglander.openapi.json` 中的 OpenAPI 定义
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

## 媒体播放器架构

项目包含位于 `apps/web-antd/src/views/media/` 的综合媒体流系统：

### 核心组件

- **MediaPlayerManager.vue**: 处理播放器类型检测和切换的中央管理器
- **BasePlayer.vue**: 所有播放器实现的抽象基类
- **HlsPlayer.vue**: HLS 流播放器实现
- **FlvPlayer.vue**: FLV 流播放器实现
- **VideoJsPlayer.vue**: 基于 VideoJS 的播放器实现

### 媒体播放器功能

- **自动检测**: 基于流格式的自动播放器类型选择
- **格式支持**: HLS (.m3u8)、FLV (.flv) 和标准视频格式
- **实时更新**: 实时观看人数显示与刷新功能
- **错误恢复**: 播放器故障的回退机制
- **URL 管理**: 流 URL 的复制到剪贴板功能
- **响应式设计**: 自适应播放器大小和控件

### 媒体组件开发模式

- 使用 `MediaPlayerManager` 作为所有媒体播放的入口点
- 实现适当的错误边界和回退处理
- 遵循既定的播放器接口以保持一致性
- 在适用的地方包含观看人数集成
- 确保组件卸载时媒体资源的适当清理
