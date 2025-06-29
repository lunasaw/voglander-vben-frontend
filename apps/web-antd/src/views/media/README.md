# 媒体管理模块

## 模块概述

媒体管理模块是独立的业务模块，主要负责流媒体相关功能的管理，包括节点管理、流媒体配置等功能。

## 技术栈
- Vue 3 + TypeScript
- Ant Design Vue
- VxeTable 表格组件
- Vben Admin 框架

## 模块结构

```
apps/web-antd/src/views/media/
├── node/                     # 流媒体节点管理
│   ├── list.vue             # 节点列表页面
│   ├── data.ts              # 数据配置
│   └── modules/
│       └── form.vue         # 节点表单组件
├── README.md                # 模块说明文档
└── ...                      # 其他功能模块（可扩展）
```

## API模块结构

```
apps/web-antd/src/api/media/
├── index.ts                 # API模块入口
├── medianode.ts             # 流媒体节点API
└── ...                      # 其他API文件（可扩展）
```

## 路由配置

位置：`apps/web-antd/src/router/routes/modules/media.ts`

- 根路径：`/media`
- 菜单图标：`mdi:server-network`
- 排序权重：9996

## 国际化配置

### 中文配置
位置：`apps/web-antd/src/locales/langs/zh-CN/media.json`

### 英文配置
位置：`apps/web-antd/src/locales/langs/en-US/media.json`

## 功能模块

### 1. 流媒体节点管理 (`/media/node`)
- **功能描述**：管理流媒体服务节点，包括节点的创建、编辑、删除和状态监控
- **权限控制**：
  - `Media:Node:List` - 节点列表查看
  - `Media:Node:Create` - 节点创建
  - `Media:Node:Edit` - 节点编辑
  - `Media:Node:Delete` - 节点删除

### 2. 可扩展功能
未来可以在此模块下扩展更多媒体相关功能：
- 流媒体配置管理
- 播放统计分析
- 内容分发网络(CDN)管理
- 媒体存储管理

## 数据库菜单配置

菜单SQL位置：`apps/web-antd/sql/media-menu-insert.sql`

### 菜单ID分配
- **媒体管理模块**：300-399
- **根目录菜单**：300
- **节点管理页面**：301
- **节点按钮权限**：30101-30103

## 开发规范

1. **API接口**：所有媒体相关API统一放在 `#/api/media/` 目录下
2. **页面组件**：所有媒体页面统一放在 `#/views/media/` 目录下
3. **权限编码**：使用 `Media:ModuleName:Action` 格式
4. **国际化键值**：使用 `media.moduleName.fieldName` 格式
5. **路由命名**：使用 `Media + ModuleName` 格式

## 注意事项

1. **模块独立性**：媒体管理模块与系统管理模块相互独立，避免耦合
2. **权限控制**：严格按照双重权限校验机制实现
3. **国际化完整性**：确保所有文本都有对应的中英文翻译
4. **代码复用**：充分利用 playground 中的组件和样式
5. **API规范**：遵循 RESTful API 设计规范

## 部署说明

1. **菜单权限**：执行 `media-menu-insert.sql` 初始化菜单数据
2. **角色分配**：为相应角色分配媒体管理权限
3. **功能测试**：确保所有CRUD操作正常工作
4. **权限验证**：验证权限控制机制有效性


