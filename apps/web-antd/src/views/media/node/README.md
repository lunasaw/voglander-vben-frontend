# 流媒体节点管理功能

## 功能概述

基于提供的OpenAPI接口，实现了完整的流媒体节点管理功能，包括节点的创建、编辑、删除、查询和状态管理。

## 技术栈
- Vue 3 + TypeScript
- Ant Design Vue
- VxeTable 表格组件
- Vben Admin 框架

## 文件结构

```
apps/web-antd/src/views/media/node/
├── list.vue              # 主页面 - 节点列表和管理
├── data.ts               # 数据配置 - 表格列和表单定义
├── modules/
│   └── form.vue          # 表单组件 - 创建/编辑节点
└── README.md             # 说明文档
```

## 主要功能

### 1. 节点列表展示
- 分页查询节点列表
- 支持多条件搜索筛选
- 显示节点状态（在线/离线）
- 显示启用状态和Hook状态

### 2. 节点管理操作
- **创建节点**：支持添加新的流媒体节点
- **编辑节点**：修改节点信息（节点ID不可修改）
- **删除节点**：删除指定节点
- **状态管理**：显示节点在线状态

### 3. 权限控制
- 创建权限：`Media:Node:Create`
- 编辑权限：`Media:Node:Edit`
- 删除权限：`Media:Node:Delete`
- 按钮显示和点击时双重权限校验

### 4. 国际化支持
- 完整的中英文国际化配置
- 所有UI文本均支持多语言切换

## 数据字段说明

### MediaNode 实体字段

| 字段名 | 类型 | 说明 | 必填 |
|--------|------|------|------|
| id | number | 数据库主键ID | 系统生成 |
| serverId | string | 节点服务ID | 是 |
| name | string | 节点名称 | 否 |
| host | string | 节点地址 | 是 |
| secret | string | API密钥 | 否 |
| enabled | boolean | 是否启用 | 是 |
| hookEnabled | boolean | 是否启用Hook | 是 |
| weight | number | 节点权重(1-1000) | 否 |
| status | number | 节点状态(1在线/0离线) | 系统设置 |
| description | string | 节点描述 | 否 |
| extend | string | 扩展字段 | 否 |
| createTime | string | 创建时间 | 系统生成 |
| updateTime | string | 更新时间 | 系统生成 |

## API接口映射

### 查询接口
- `GET /api/v1/medianode/pageListByEntity/{page}/{size}` - 分页查询节点

### 创建接口
- `POST /api/v1/medianode/insert` - 创建节点

### 更新接口
- `PUT /api/v1/medianode/update` - 更新节点

### 删除接口
- `DELETE /api/v1/medianode/delete/{id}` - 删除节点

## 路由配置

- **访问路径**：`/media/node`
- **路由名称**：`MediaNode`
- **菜单位置**：媒体管理 → 流媒体节点管理

## 使用说明

1. **访问页面**：进入媒体管理 → 流媒体节点管理
2. **查看列表**：系统自动加载节点列表，支持分页
3. **搜索筛选**：使用搜索栏进行条件筛选
4. **创建节点**：点击"新增节点"按钮，填写表单信息
5. **编辑节点**：点击操作列的"编辑"按钮
6. **删除节点**：点击操作列的"删除"按钮

## 权限控制说明

### 双重权限验证机制
1. **按钮显示控制**：在表格列定义中使用 `show` 属性控制按钮是否显示
2. **点击时权限校验**：在事件处理函数中进行权限检查并给出用户提示

### 权限编码
- `Media:Node:Create` - 创建节点权限
- `Media:Node:Edit` - 编辑节点权限
- `Media:Node:Delete` - 删除节点权限

### 权限失败提示
- 创建权限不足：您没有创建流媒体节点的权限
- 编辑权限不足：您没有编辑流媒体节点的权限
- 删除权限不足：您没有删除流媒体节点的权限

## 注意事项

1. **节点ID唯一性**：serverId字段必须唯一，编辑时不可修改
2. **权重范围**：节点权重必须在1-1000之间
3. **权限控制**：确保用户拥有相应的操作权限
4. **数据验证**：表单提交时会进行数据格式验证
5. **状态显示**：节点状态由系统维护，显示实时在线状态

## 国际化键值

### 中文键值（media.json）
```json
{
  "node": {
    "title": "流媒体节点管理",
    "list": "节点列表",
    "name": "流媒体节点",
    "serverId": "节点服务ID",
    "host": "节点地址",
    "secret": "API密钥",
    "enabled": "启用状态",
    "hookEnabled": "Hook状态",
    "weight": "节点权重",
    "status": "在线状态",
    "description": "节点描述",
    "extend": "扩展字段"
  }
}
```

## 扩展功能

可以基于现有接口扩展以下功能：
- 批量操作（批量创建、更新、删除）
- 节点状态实时监控
- 节点性能统计
- 节点分组管理
- 节点健康检查
- 节点负载均衡配置
