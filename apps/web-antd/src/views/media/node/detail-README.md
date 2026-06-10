# 流媒体节点详情页面功能

## 功能概述

基于提供的ZLM查询OpenAPI接口，实现了完整的流媒体节点详情查询功能，通过HTTP header携带X-Node-Key来指定要查询的节点，展示节点的实时状态、性能监控、配置信息等详细数据。

## 功能特点

### 1. 动态节点选择

- 通过URL参数传递节点Key（nodeKey）
- 所有API请求都会自动携带 `X-Node-Key` header
- 支持根据不同节点查询相应的数据

### 2. 多维度数据展示

- **概览信息**：版本信息、构建时间、分支名称、提交哈希
- **性能监控**：网络线程负载、后台线程负载
- **对象统计**：各种重要对象的实时计数
- **API列表**：当前节点可用的API接口列表
- **服务器配置**：完整的服务器配置参数

### 3. 实时数据刷新

- 支持一键刷新所有数据
- 每个模块独立的加载状态
- 异步并发加载，提升用户体验

## 页面结构

```
apps/web-antd/src/views/media/node/
├── detail.vue               # 详情页面主组件
├── detail-README.md         # 详情页面说明文档
└── ...                      # 其他文件
```

## API接口映射

### ZLM查询接口

| 接口路径                     | 功能描述         | 返回数据类型       |
| ---------------------------- | ---------------- | ------------------ |
| `/zlm/api/version`           | 获取版本信息     | Version            |
| `/zlm/api/api/list`          | 获取API列表      | string[]           |
| `/zlm/api/threads/load`      | 获取网络线程负载 | ThreadLoad[]       |
| `/zlm/api/work-threads/load` | 获取后台线程负载 | ThreadLoad[]       |
| `/zlm/api/statistic`         | 获取主要对象个数 | ImportantObjectNum |
| `/zlm/api/server/config`     | 获取服务器配置   | ServerNodeConfig   |

### 请求Header

所有API请求都会自动携带以下header：

```
X-Node-Key: {nodeKey}
```

## 路由配置

- **路由路径**：`/media/node/detail/:nodeKey`
- **路由名称**：`MediaNodeDetail`
- **参数说明**：
  - `nodeKey`：节点的唯一标识符（通常是serverId）
  - `nodeName`（query参数）：节点显示名称

## 访问方式

### 1. 从列表页面跳转

在流媒体节点列表页面，点击任意节点的"节点服务ID"列，即可跳转到该节点的详情页面。

### 2. 直接访问

通过URL直接访问：

```
/media/node/detail/{nodeKey}?nodeName={nodeName}
```

## 权限控制

### 访问权限

- 权限编码：`Media:Node:List`
- 说明：详情页面复用节点列表的查询权限
- 如需独立权限，可创建 `Media:Node:Detail` 权限

### 权限检查机制

1. **页面访问时**：检查是否有查看权限
2. **权限不足时**：显示错误提示并自动跳转回列表页面

## 数据展示组件

### 1. 概览信息（Descriptions）

展示节点版本信息，包括构建时间、分支名称、提交哈希等基础信息。

### 2. 性能监控（Table）

使用双列布局展示：

- 左侧：网络线程负载
- 右侧：后台线程负载

负载数据使用颜色标签表示：

- 绿色：负载 ≤ 40%
- 蓝色：40% < 负载 ≤ 60%
- 橙色：60% < 负载 ≤ 80%
- 红色：负载 > 80%

### 3. 对象统计（Table）

展示各种重要对象的实时计数，包括Buffer、RtpPacket、Frame等。

### 4. API列表（Table）

展示当前节点可用的所有API接口列表。

### 5. 服务器配置（Table）

展示完整的服务器配置参数，支持搜索和分页。

## 错误处理

### 1. 权限检查

```typescript
if (!hasAccessByCodes(['Media:Node:List'])) {
  message.error('您没有查看节点详情的权限');
  router.push('/media/node');
}
```

### 2. API请求错误

```typescript
try {
  const response = await getZlmVersion(nodeKey.value);
  if (response.code === 0) {
    versionData.value = response.data;
  } else {
    message.error(`获取版本信息失败: ${response.msg}`);
  }
} catch (error) {
  console.error('获取版本信息失败:', error);
  message.error('获取版本信息失败');
}
```

### 3. 数据加载状态

每个数据模块都有独立的加载状态，在数据获取时显示Spin组件。

## 国际化支持

### 中文键值

```json
{
  "query": {
    "version": "版本信息",
    "apiList": "API列表",
    "threadsLoad": "网络线程负载",
    "workThreadsLoad": "后台线程负载",
    "statistic": "对象统计",
    "serverConfig": "服务器配置",
    "backToList": "返回列表",
    "refreshData": "刷新数据"
  }
}
```

### 英文键值

```json
{
  "query": {
    "version": "Version Info",
    "apiList": "API List",
    "threadsLoad": "Network Threads Load",
    "workThreadsLoad": "Work Threads Load",
    "statistic": "Object Statistics",
    "serverConfig": "Server Configuration",
    "backToList": "Back to List",
    "refreshData": "Refresh Data"
  }
}
```

## 技术实现

### 1. API调用

```typescript
// 自动携带X-Node-Key header
export async function getZlmVersion(nodeKey?: string) {
  const headers: Record<string, string> = {};
  if (nodeKey) {
    headers['X-Node-Key'] = nodeKey;
  }

  return requestClient.get<ZlmQueryApi.ServerResponseVersion>(
    '/zlm/api/version',
    {
      headers,
    },
  );
}
```

### 2. 数据状态管理

```typescript
// 独立的加载状态
const versionLoading = ref(false);
const versionData = ref<ZlmQueryApi.Version | null>(null);

// 并发加载所有数据
async function refreshAllData() {
  loading.value = true;
  try {
    await Promise.all([
      fetchVersion(),
      fetchApiList(),
      fetchThreadsLoad(),
      fetchWorkThreadsLoad(),
      fetchStatistic(),
      fetchServerConfig(),
    ]);
    message.success('数据刷新成功');
  } finally {
    loading.value = false;
  }
}
```

### 3. 响应式设计

使用Ant Design Vue的栅格系统，支持不同屏幕尺寸：

```vue
<Row :gutter="16">
  <Col :span="12">
    <!-- 网络线程负载 -->
  </Col>
  <Col :span="12">
    <!-- 后台线程负载 -->
  </Col>
</Row>
```

## 使用说明

### 1. 查看节点详情

1. 进入流媒体节点列表页面（`/media/node`）
2. 点击任意节点的"节点服务ID"列
3. 系统会自动跳转到该节点的详情页面
4. 页面会自动加载该节点的所有详细信息

### 2. 刷新数据

点击页面右上角的"刷新数据"按钮，可以重新获取最新的节点信息。

### 3. 返回列表

点击页面左上角的"返回列表"按钮，可以返回到节点列表页面。

## 扩展功能

基于当前架构，可以轻松扩展以下功能：

### 1. 实时监控

- 定时自动刷新数据
- WebSocket实时数据推送
- 性能图表展示

### 2. 历史数据

- 性能数据历史记录
- 趋势分析图表
- 数据导出功能

### 3. 节点操作

- 节点重启
- 配置修改
- 服务管理

### 4. 告警监控

- 性能阈值设置
- 异常状态告警
- 邮件/短信通知

## 注意事项

1. **节点选择**：确保传递的nodeKey是有效的节点标识符
2. **权限控制**：用户必须具有相应的查看权限
3. **错误处理**：API调用失败时会显示具体的错误信息
4. **性能考虑**：大量配置项展示时使用分页和搜索功能
5. **数据实时性**：页面数据不会自动刷新，需要手动点击刷新按钮

## 数据库配置

使用提供的SQL文件配置菜单权限：

```sql
-- 执行 media-node-detail-menu-insert.sql
-- 为相应角色分配权限
```

这个详情页面提供了完整的节点监控和管理功能，通过清晰的数据展示和友好的用户界面，帮助用户快速了解和管理流媒体节点的状态。
