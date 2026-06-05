# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

> **架构文档集（单一事实来源）**：`apps/web-antd/doc/1.0.6/`
> - [01-系统架构总览.md](apps/web-antd/doc/1.0.6/01-系统架构总览.md) — 产品定位、多仓库依赖链、端到端数据流、技术栈、部署形态
> - [02-后端架构.md](apps/web-antd/doc/1.0.6/02-后端架构.md) — voglander 分层、Controller 模板方法、AjaxResult、鉴权、控制器与端点全表（22 个 Controller）
> - [03-前端架构.md](apps/web-antd/doc/1.0.6/03-前端架构.md) — web-antd 布局、API 层、请求客户端、适配器、Schema 驱动页面、路由权限、状态、i18n、SSE、播放器
> - [04-前后端集成与接口契约.md](apps/web-antd/doc/1.0.6/04-前后端集成与接口契约.md) — 契约规则、URL 重写代理、AjaxResult↔requestClient、X-Node-Key、时间戳、SSE 鉴权、字段映射
>
> 接口字段级明细见 [`apps/web-antd/api/voglander-api.md`](apps/web-antd/api/voglander-api.md)。本文件只覆盖日常开发要点，细节以上述文档集为准。

## 版本基线

| 组件 | 版本 | 说明 |
|------|------|------|
| 产品文档版本 | **1.0.6** | 当前迭代 |
| web-antd 前端 | `5.5.8` | 基于 Vben Admin 5.x |
| voglander 后端 | `1.0.2-SNAPSHOT` | REST 提供方 |
| sip-gateway / gb28181 | `1.8.0` | command 出站 + 统一回调 |
| zlm-spring-boot-starter | `1.0.10-SNAPSHOT` | ZLMediaKit 集成 |

**一句话架构**：Vue 3（web-antd）通过统一 `requestClient` 调用 voglander REST（`AjaxResult{code,msg,data}`、`code=0` 成功）；voglander 以 **Controller → Manager → Service → Repository** 分层编排业务���向上集成 **GB28181（sip-proxy）** 与 **ZLMediaKit（zlm starter）**，通过 **SSE** 向前端推送实时事件。

## 常用命令

### 开发环境

```bash
# 启动交互式开发服务器选择
pnpm dev

# 启动特定应用程序
pnpm dev:antd          # Ant Design Vue 版本 (主要开发目标，端口 5666)
pnpm dev:ele           # Element Plus 版本
pnpm dev:naive         # Naive UI 版本
pnpm dev:docs          # 文档站点
pnpm dev:play          # 测试环境
```

> dev 下 `VITE_GLOB_API_URL=/api`，vite `server.proxy['/api']` → `http://0.0.0.0:8081`，rewrite 剥离 `^/api` 前缀、`ws:true`。详见前后端契约一节。

### 构建

```bash
# 构建所有应用程序
pnpm build

# 构��特定应用程序
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

- **`/apps/`** - Web 应用程序：
  - `web-antd/` - **主要开发目标** (Ant Design Vue)
  - `web-ele/` - Element Plus 版本
  - `web-naive/` - Naive UI 版本
  - `backend-mock/` - Nitro mock 服务（`VITE_NITRO_MOCK=true` 时启用）
- **`/packages/`** - 按领域组织的共享库
- **`/internal/`** - 开发工具和配置
- **`/playground/`** - **样式和组件参考** 用于开发
- **`/docs/`** - VitePress 文档

### web-antd 源码结构

```
apps/web-antd/src/
├── api/           # API 层（按领域分目录，namespace 聚合类型 + 请求函数）
├── views/         # 业务页面
├── router/routes/modules/   # 模块路由
├── store/         # Pinia（auth + node）
├── adapter/       # 组件 / 表单 / 表格适配器
├── components/    # 业务组件 NodeSelector / MediaPlayer / StreamDetailModal
├── composables/   # useSseEvents 等组合式函数
├── utils/         # node-state（全局 ZLM 节点，供请求拦截器读取）
└── locales/langs/ # i18n（zh-CN / en-US）
```

### 关键开发规则

**主要开发位置**: 所有新开发工作都在 `apps/web-antd/` 中进行

**作用域限制**: 所有修改只能在当前所属页面内进行，禁止修改共享组件和其他模块的内容（除非明确要求）

**样式和模式参考**: `playground/src/views/` 包含权威示例：

- 组件使用模式
- UI/UX 设计标准
- 布局结构
- 交互行为

**API 集成**: API 层位于 `apps/web-antd/src/api/`，按领域分目录，每个文件用 TypeScript `namespace` 聚合类型 + 请求函数：

- `core/` - 认证、菜单、用户（`auth.ts` / `menu.ts` / `user.ts`）
- `media/` - 流媒体：`medianode.ts`（ZLM 节点）、`stream-proxy.ts`（拉流代理）、`push-proxy.ts`（推流代理）、`zlm-media.ts`、`zlm-query.ts`
- `system/` - 系统管理：`dept.ts` / `menu.ts` / `role.ts` / `user.ts`
- `protocol-lab.ts` - GB28181 协议验证台
- `request.ts` - 请求客户端配置（见下）；各目录 `index.ts` 做桶导出，根 `index.ts` 再聚合

> ⚠️ `api/media/index.ts` 当前仅桶导出 `medianode` + `stream-proxy`；`push-proxy` / `zlm-media` / `zlm-query` 由页面**按文件路径直接导入**（如 `#/api/media/push-proxy`），未走桶。

> 后端 OpenAPI 规范见 `voglander/` 后端仓库；前端不再保存本地 `*.openapi-*.json` 副本。新增/变更字段须前后端契约一致（参考 `.cursorrules`）。

#### API 文件清单（namespace → 主要函数 → 端点）

| 文件 | namespace | 主要函数 → 端点 |
|------|-----------|----------------|
| `core/auth.ts` | `AuthApi` | `loginApi`→`POST /auth/login`；`refreshTokenApi`→`POST /auth/refresh`；`logoutApi`→`POST /auth/logout`；`getAccessCodesApi`→`GET /auth/codes` |
| `core/menu.ts` | — | `getAllMenusApi`→`GET /menu/all`；`getUserPermissionMenusApi`→`GET /menu/permissions` |
| `core/user.ts` | — | `getUserInfoApi`→`GET /user/info` |
| `media/medianode.ts` | `MediaNodeApi` | get/getByServerId/list/listEnabled/listOnline/pageList → `/api/v1/mediaNode/*`；insert/update/updateStatus/delete/deleteIds/deleteByCondition |
| `media/stream-proxy.ts` | `StreamProxyApi` | `getStreamProxyPageList`→`POST /api/v1/proxy/getPage`；add/createStreamProxy/update/updateStatus/deleteOne/deleteBatch |
| `media/push-proxy.ts` | `PushProxyApi` | getPage/add/createPushProxy/createPushProxyWithNode/update/updateStatus/start/stop/checkSource → `/api/v1/push-proxy/*` |
| `media/zlm-media.ts` | `ZlmMediaApi` | getZlmMediaList/closeZlmMedia/checkOnline/getInfo/getPlayUrls/getSnapshotUrl → `/zlm/api/media/*`（带 `X-Node-Key`） |
| `media/zlm-query.ts` | `ZlmQueryApi` | getZlmVersion/ApiList/ThreadsLoad/Statistic/ServerConfig/setServerConfig/restartServer → `/zlm/api/*`（带 `X-Node-Key`） |
| `system/dept.ts` | `SystemDeptApi` | list/create/update/delete → `/system/dept*` |
| `system/menu.ts` | `SystemMenuApi` | list/nameExists/pathExists/create/update/delete → `/system/menu*` |
| `system/role.ts` | `SystemRoleApi` | list/create/update/delete → `/system/role*` |
| `system/user.ts` | `SystemUserApi` | getUserInfo/getUserList/getUserById/create/update/delete/check-* → `/user*` |
| `protocol-lab.ts` | `ProtocolLabApi` | labRegister/labUnregister/labKeepaliveAuto/labPushCatalog/labPushAlarm → `/api/v1/lab/client/*`；ptzControl→`/api/v1/ptz/control`；queryCatalog/rebootDevice→`/api/v1/device-cmd/*`；liveStart→`/api/v1/live/start` |

**请求客户端约定** (`src/api/request.ts`)：

`requestClient`（`responseReturn:'data'`）对接后端 `AjaxResult`，四个拦截器：

| 拦截器 | 作用 |
|--------|------|
| 请求拦截器 | 注入 `Authorization: Bearer <token>`（来自 `accessStore`）、`Accept-Language`（`preferences.app.locale`）；URL 含 `/zlm/api` 时从 `utils/node-state.ts` 注入 `X-Node-Key` |
| `defaultResponseInterceptor` | `codeField:'code'` / `dataField:'data'` / **`successCode:0`** → API 函数直接拿到 `data` 本体 |
| `authenticateResponseInterceptor` | token 过期自动 `doRefreshToken()`（`/auth/refresh`），失败 `doReAuthenticate()` 登出/弹窗 |
| `errorMessageResponseInterceptor` | 兜底错误用 `message.error(msg)` 提示 |

> `baseRequestClient`（不解包）用于 refresh/logout 等需要原始响应的场景。

### 适配器层（`src/adapter/`）

统一不同 UI 库接口，提供一致开发体验。**Schema 驱动**：表单/表格行为由配置定义，不写命令式代码。

| 文件 | 作用 |
|------|------|
| `component/index.ts` | 注册 Ant Design Vue 组件（异步导入）+ 自定义业务组件 `NodeSelector`；`withDefaultPlaceholder` 注入默认 placeholder |
| `form.ts` | `setupVbenForm`：`baseModelPropName:'value'`，`Checkbox/Radio/Switch`→`checked`、`Upload`→`fileList`；国际化校验规则 `required`/`selectRequired`；导出 `useVbenForm` / `VbenFormSchema` / `z` |
| `vxe-table.ts` | `setupVbenVxeTable`：全局 grid 配置（居中、可调列宽、`proxyConfig.autoLoad`）；内置 `CellSwitch`（状态切换）、Tag、Image、Popconfirm 渲染器 |

### 技术栈

- **前端**: Vue 3 + TypeScript + Composition API
- **UI 框架**: Ant Design Vue (主要)、Element Plus、Naive UI
- **构建工具**: Vite 与自定义插件系统（`@vben/vite-config`）
- **路由**: Vue Router 4 与后端驱动的权限（`/menu/all`、`/menu/permissions`）
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

### 业务模块页面

| 模块 | 路径 | 页面 |
|------|------|------|
| 媒体-节点 | `views/media/node/` | `list.vue` · `detail.vue`（ZLM 节点诊断：version/threads/statistic/config）· `modules/form.vue` |
| 媒体-在线流 | `views/media/list/` | `list.vue` · `modules/detail-modal.vue` |
| 媒体-拉流代理 | `views/media/stream-proxy/` | `list.vue` · `data.ts` · `modules/form.vue` |
| 媒体-推流代理 | `views/media/push-proxy/` | `list.vue` · `data.ts` · `modules/form.vue` |
| 媒体-播放器 | `views/media/media-player/` | `MediaPlayerManager.vue` + `players/{Base,Hls,Flv,VideoJs}Player.vue` + `composables/usePlayerDetection.ts` |
| 协议验证台 | `views/protocol-lab/` | `index.vue` + `components/{ClientPanel,ServerPanel,SipTimeline}.vue` |
| 系统-用户/角色/菜单/部门 | `views/system/{user,role,menu,dept}/` | 标准 CRUD 三件套 |

## 前后端集成与契约

> 字段级明细见 [`apps/web-antd/api/voglander-api.md`](apps/web-antd/api/voglander-api.md) 与 [04-前后端集成与接口契约.md](apps/web-antd/doc/1.0.6/04-前后端集成与接口契约.md)。

### 1. 契约总原则

前端必须**精确镜像后端**——不得自造字段或端点（见 `voglander/.cursor/rules/project-rule.mdc` 与 `.cursorrules`）：新增/变更字段须先登记、**后端先行实现**，再做前端；所有面向用户文本国际化。

### 2. URL 重写与代理（易踩坑）

`requestClient` 的 `baseURL = /api`。vite 代理剥离 `^/api` 前缀后转发 :8081：

| API 函数里的 URL | 后端实际收到（:8081） |
|------------------|----------------------|
| `/api/v1/proxy/getPage` | `/api/v1/proxy/getPage` ✅ |
| `/auth/login` | `/auth/login` ✅ |
| `/user/info` | `/user/info` ✅ |
| `/system/menu/all` | `/system/menu/all` ✅ |
| `/zlm/api/media/list` | `/zlm/api/media/list` ✅ |

> 业务端点写后端真实路径即可（`/api/v1/*` 因后端 `@RequestMapping` 自带该前缀；`/auth`、`/user`、`/system` 后端不带 `/api/v1`），vite 代理只剥离开发期 `/api` 网关前缀。

### 3. 响应契约 · AjaxResult

后端统一 `{ "code": 0, "msg": "...", "data": <T> }`：`code=0` 成功 / `300` 警告 / `500` 错误。`requestClient` 配 `successCode:0`、`dataField:'data'`，成功直接返回 `data`；token 失效进重认证拦截器，其它失败码进错误拦截器 `message.error(msg)`。

### 4. 鉴权流转

```
登录 POST /auth/login → AjaxResult.data.accessToken → accessStore.setAccessToken
后续请求：拦截器加 Authorization: Bearer <token>
token 过期：authenticateResponseInterceptor → POST /auth/refresh（baseRequestClient）→ 写回新 token；失败则登出
权限码：GET /auth/codes → string[] → hasAccessByCodes(['Module:Entity:Action'])
动态菜单：GET /menu/all（树形）、GET /menu/permissions（前端路由格式）
```

### 5. ZLM 多节点路由 · X-Node-Key

1. 页面用 `NodeSelector` 选节点 → 同步 `nodeStore.setCurrentNodeKey()` **和** `utils/node-state.ts` 的 `setCurrentNodeKey()`
2. 请求拦截器检测 URL 含 `/zlm/api` → 读 `getCurrentNodeKey()` → 注入请求头 `X-Node-Key: <nodeKey>`
3. 后端据 `X-Node-Key` 路由到对应 ZLM 服务器（zlm starter 的 `NodeSupplier`/`LoadBalancer`）
4. 未选节点时 `/zlm/api` 请求会 `console.error` 告警

> **双轨原因**：请求拦截器是普通模块函数、无 Vue setup 上下文，不能直接用 Pinia store，故 `utils/node-state.ts` 持有模块级镜像。

### 6. 时间戳约定

后端 DO/DTO 用 `LocalDateTime`，**VO 出参统一 Unix 毫秒时间戳**，字段名以 `Time` 结尾（`createTime`/`updateTime`/`keepaliveTime`）。前端拿到的是 `number`（毫秒），负责本地时区转换与格式化。不要假设后端发的是 ISO 字符串。

### 7. 分页契约

列表分页统一 `POST .../getPage`，body 为查询条件 + `page`/`size`；返回 `*ListResp`（`{ total: number, items: T[] }`，后端默认 `createTime` 降序）；前端 VXE Grid `proxyConfig.ajax.query` 直接对接。

### 8. 新增/变更接口的协作流程

1. 后端：对应 Controller 按**模板方法规范**加端点（`*Req` 入参 → `WebAssembler` → DTO → Manager），统一 `AjaxResult` 返回。
2. 登记契约：在 cursor-rule 文件登记新增/变更字段。
3. 前端：在 `api/[module]/[entity].ts` 的 `namespace XxxApi` 内补类型与请求函数，必要时更新桶导出 `index.ts`。
4. 页面：`data.ts` 补 Schema / 列，`list.vue`/`form.vue` 接入；补 i18n。
5. 校验：`pnpm check` + 类型检查通过。

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

实现 **双重权限保护**（权限码模式 `Module:Entity:Action`，`hasAccessByCodes` 来自 `@vben/access` 的 `useAccess()`）：

```typescript
// 1. 按钮可见性控制
{
  code: 'edit',
  show: () => hasAccessByCodes(['Media:StreamProxy:Edit']),
}

// 2. 操作时验证
function onEdit(row: any) {
  if (!hasAccessByCodes(['Media:StreamProxy:Edit'])) {
    message.error('您没有编辑权限');
    return;
  }
  // 执行编辑逻辑
}
```

### 状态管理（Pinia）

| Store | 文件 | 作用 |
|-------|------|------|
| `authStore` | `store/auth.ts` | 登录/登出编排（配合 `@vben/stores` 的 `accessStore` 存 token） |
| `nodeStore` | `store/modules/node.ts` | 当前选中 ZLM 节点 Key（`currentNodeKey`，set/get/clear） |

页面级模式：
- **状态切换**: 使用 `CellSwitch` 渲染器进行直接状态更改
- **确认对话框**: 总是确认破坏性操作
- **错误处理**: 一致的错误消息和用户反馈
- **加载状态**: 对异步操作使用 message.loading

### API 集成

- **基础 URL**: 通过环境变量配置（`VITE_GLOB_API_URL=/api`）
- **身份验证**: Bearer token 与自动刷新
- **错误处理**: 集中化的用户友好消息
- **类型安全**: 所有响应的完整 TypeScript 接口（`namespace` 内聚合）
- **时间格式**: 后端发送时间戳（毫秒），前端处理时区转换

### 实时事件 (SSE)

后端通过 SSE 推送实时事件（`composables/useSseEvents.ts` + `views/protocol-lab/`）。关键约定（与后端 `SseController` 对齐）：

- **鉴权**：`EventSource` 不支持自定义 header，token 走 URL `?token=`
- **URL**：`${apiURL}/api/v1/stream/events?topics=<前缀域>&token=<token>`；dev 下 `apiURL=/api`，由 vite 代理剥离首段转发到 `:8081`（与 `requestClient` 同构）
- **分流**：后端 SSE `event:` 名 = **完整 topic**（如 `device.register`），需逐个 `addEventListener(完整topic)`；订阅参数用**前缀域**（`device,session,clientcmd,alarm`）缩短 URL，完整 topic 列表由 `GET /api/v1/lab/client/config` 提供
- **去重**：按 `(topic|ts|业务id)` 去重，规避单机 Redis 回环双投
- **方向**：`clientcmd.*` = 平台→设备（`in`）；其余 `device.*`/`session.*`/`alarm.*` = 设备→平台（`out`）→ 渲染为 SIP 时间线左右两侧
- **重连**：`onerror` 后 3s 自动重连；`shallowRef` 整体替换触发刷新，事件上限 500 条防内存增长

### i18n

- **框架**: Vue I18n 与动态加载
- **结构**: 按功能区域的模块化 JSON 文件
- **命名**: `module.entity.action` 模式（如 `media.streamProxy.app`、`system.user.edit`）
- **必需**: 所有面向用户的文本必须国际化
- **位置**: `apps/web-antd/src/locales/langs/{zh-CN,en-US}/{media,system,protocol-lab,page,demos}.json`

## 文件结构约定

### 页面组织

```
apps/web-antd/src/views/[module]/[entity]/
├── list.vue           # 主列表/表格页面（VXE Grid + 工具栏 + 抽屉）
├── detail.vue         # 详情/查看页面 (如需要)
├── data.ts           # useFormSchema / useColumns / useGridFormSchema
└── modules/
    └── form.vue      # 创建/编辑表单组件
```

`data.ts` 三件套：
- `useFormSchema(isEditMode)` → 编辑表单字段（`component`/`componentProps`/`fieldName`/`label`/`rules`/`dependencies`）
- `useColumns(onActionClick, onStatusChange)` → 表格列（含操作列、`CellSwitch` 状态列）
- `useGridFormSchema()` → 顶部搜索条件

### API 组织

```
apps/web-antd/src/api/[module]/
├── [entity].ts       # 实体 API：用 `export namespace XxxApi { ... }` 聚合类型 + 请求函数
└── index.ts          # 桶导出 (export * from './[entity]')
```

约定：请求函数从 `#/api/request` 导入 `requestClient`；类型与函数同放在该实体的 `namespace` 内，无独立 `types.ts`。

### 路由组织

```
apps/web-antd/src/router/routes/modules/
├── media.ts          # /media 下 node / node/detail / list / stream-proxy / push-proxy
├── protocol-lab.ts   # /protocol-lab/gb28181
├── system.ts / dashboard.ts / demos.ts / vben.ts
```

路由 `meta.title` 走 `$t()` 国际化；后端 `/menu/all`、`/menu/permissions` 提供动态菜单/权限路由。

## 配置文件

### 环境变量

- **开发**: `VITE_GLOB_API_URL=/api`，API 代理到 `http://0.0.0.0:8081`
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

1. 对照 `voglander/` 后端的 REST 接口与字段（契约前后端一致，参考文档集 02 / 04）
2. 在 `playground/src/views/examples/` 中找到类似模式
3. 在 `apps/web-antd/src/views/[module]/[entity]/` 中创建页面结构
4. 在 `apps/web-antd/src/api/[module]/` 中实现 API 层（`namespace` 模式）
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
