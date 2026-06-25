# GB28181-2022 级联下级平台前端技术方案（实施版）

> 版本：1.0.8 ｜ 更新日期：2026-06-16 ｜ 分支：`feat/protocol-lab-external-register`
> 对应后端方案：
> - `voglander/doc/1.0.8/GB28181-CASCADE-CLIENT-TECH-PLAN.md`（级联客户端总方案）
> - `voglander/doc/1.0.8/CASCADE-WEB-LAYER-REFACTOR-PLAN.md`（**Web 层规范重构，本文前置依赖**）
> 前端基线：Vue 3 + Vben Admin 5.x + Ant Design Vue

---

## 0. 修订说明（重要）

本文档此前版本基于**错误的字段假设**（`serverIp`/`serverPort`/`platformName` 等），与后端实际不符，页面无法正常工作。经核验后端 `tb_cascade_platform` 与 device 模块权威范式，已完整重构前后端契约。本版本反映**已落地的实际实现**，所有字段/路径/结构均经编译、类型检查、构建、后端测试验证。

**根因**：cascade 后端 Web 层原先违反项目规范（直接返回 `DTO`/`Page{records}`、`GET /page`、时间 `LocalDateTime`），前端据此臆造了不存在的字段。本次按 device 模块范式（VO + Assembler + ListResp + 毫秒时间 + `POST /getPage`）重构后端，前端镜像新 VO。详见后端 `CASCADE-WEB-LAYER-REFACTOR-PLAN.md`。

---

## 1. 字段契约（唯一事实来源 = 后端 VO）

### 1.1 平台 CascadePlatformVO（镜像 `tb_cascade_platform`）

| 前端 TS 字段 | 类型 | 说明 | 旧错误字段 |
|---|---|---|---|
| `platformId` | string | 上级平台国标 ID（20 位） | — |
| `platformIp` | string | 上级平台 IP | ~~serverIp~~ |
| `platformPort` | number | 上级平台端口（默认 5060） | ~~serverPort~~ |
| `platformDomain` | string | 上级平台域 | ~~serverDomain~~ |
| `username` / `password` | string | 认证 | — |
| `localClientId` | string | 本端客户端国标 ID | — |
| `localIp` | string | 本端 IP | ~~localClientIp~~ |
| `localPort` | number | 本端端口 | ~~localClientPort~~ |
| `enabled` | number | 0停用 1启用 | — |
| `registerStatus` | number | 0离线 1在线 2注册中 3失败 | （新增） |
| `registerStatusName` | string | 注册状态中文名（后端派生） | （新增） |
| `keepaliveInterval` | number | 心跳间隔(秒) | — |
| `registerExpires` | number | 注册有效期(秒) | — |
| `charset` | string | 编码 GB2312/UTF-8 | （新增） |
| `transport` | string | UDP/TCP | — |
| `createTime` / `updateTime` | number | **Unix 毫秒** | ~~string~~ |

> ⚠️ 后端**无** `platformName` 字段——已从前端全部移除。列表/下拉/提示统一用 `platformId` 标识。

### 1.2 通道 CascadeChannelVO（前后端原本一致，无字段错位）

| 字段 | 类型 | 说明 |
|---|---|---|
| `platformId` | string | 所属上级平台 |
| `localDeviceId` / `localChannelId` | string | 本地设备/通道国标 ID |
| `cascadeChannelId` | string | 对上级暴露的级联编码（20 位） |
| `cascadeName` | string | 对上级暴露的通道名称 |
| `enabled` | number | 0停用 1启用 |
| `createTime` / `updateTime` | number | Unix 毫秒 |

---

## 2. API 层（`api/cascade/`）

### 2.1 平台 API（`platform.ts`）

| 函数 | 方法 | 路径 | 说明 |
|---|---|---|---|
| `createCascadePlatform(data)` | POST | `/api/v1/cascade/platform` | 新增 → 返回 id |
| `updateCascadePlatform(id,data)` | PUT | `/api/v1/cascade/platform/{id}` | 更新 |
| `deleteCascadePlatform(id)` | DELETE | `/api/v1/cascade/platform/{id}` | 删除 |
| `getCascadePlatformById(id)` | GET | `/api/v1/cascade/platform/{id}` | 详情（VO） |
| `getCascadePlatformPage(params)` | **POST** | **`/api/v1/cascade/platform/getPage`** | 分页：`page`/`size` 走 query，条件走 body；返回 `{total, items}` |
| `enableCascadePlatform(id)` | POST | `/api/v1/cascade/platform/{id}/enable` | 启用 + 启动注册调度 |
| `disableCascadePlatform(id)` | POST | `/api/v1/cascade/platform/{id}/disable` | 停用 + 停止调度 |
| `refreshCascadeScheduler()` | POST | `/api/v1/cascade/platform/refresh` | 批量刷新调度 |

**分页调用约定**（关键）：

```typescript
export async function getCascadePlatformPage(params: {
  page: number; size: number;
  platformId?: string; platformIp?: string; enabled?: number; registerStatus?: number;
}) {
  const { page, size, ...body } = params;
  return requestClient.post<CascadePlatformApi.PlatformListResp>(
    `/api/v1/cascade/platform/getPage`, body, { params: { page, size } },
  );
}
```

### 2.2 通道 API（`channel.ts`）

| 函数 | 方法 | 路径 |
|---|---|---|
| `createCascadeChannel(data)` | POST | `/api/v1/cascade/channel` |
| `updateCascadeChannel(id,data)` | PUT | `/api/v1/cascade/channel/{id}` |
| `deleteCascadeChannel(id)` | DELETE | `/api/v1/cascade/channel/{id}` |
| `getCascadeChannelById(id)` | GET | `/api/v1/cascade/channel/{id}` |
| `getCascadeChannelPage(params)` | **POST** | **`/api/v1/cascade/channel/getPage`** |

> 分页同平台：`page`/`size` 走 query，条件（platformId/localDeviceId/localChannelId/cascadeChannelId）走 body，返回 `{total, items}`。

---

## 3. 页面实现（`views/cascade/`）

### 3.1 平台列表（`platform/list.vue` + `data.ts` + `modules/form.vue`）

- **列**：platformId、platformIp、platformPort、localClientId、transport(Tag)、enabled(Tag)、**registerStatus(Tag)**、createTime、操作
- **registerStatus Tag 配色**：在线绿(success)/离线灰(default)/注册中蓝(processing)/失败红(error)
- **筛选**：platformId、platformIp、enabled、registerStatus
- **表单**（双列 Schema）：platformId(编辑只读)、platformIp、platformPort、platformDomain、localClientId、localIp、localPort、transport、charset、username、password、registerExpires、keepaliveInterval
- **操作**：新增/编辑/删除 + 启用/停用（条件显示）+ 刷新调度
- **权限**：`Cascade:Platform:Create|Edit|Delete|Status`（双重保护：按钮 `show` + 操作函数校验）

### 3.2 通道列表（`channel/list.vue` + `data.ts` + `modules/form.vue`）

- **列**：platformId、localDeviceId、localChannelId、cascadeChannelId、cascadeName、createTime、操作
- **筛选**：platformId(下拉，选项来自已启用平台)、localDeviceId、localChannelId、cascadeChannelId
- **平台下拉选项**：`label` 与 `value` 均用 `platformId`（后端无 platformName）
- **权限**：`Cascade:Channel:Create|Edit|Delete`

### 3.3 路由（`router/routes/modules/cascade.ts`）

- name 用 PascalCase：`Cascade` / `CascadePlatform` / `CascadeChannel`（对齐后端 `/menu/all` 下发的 route name）
- component 末段为 `list`：`cascade/platform/list` / `cascade/channel/list`
- web-antd `accessMode='backend'`，运行时路由由后端 `/menu/all` 下发，静态定义仅开发期占位

---

## 4. 国际化（`locales/langs/{zh-CN,en-US}/cascade.json`）

- `platform.field.*` 字段标签已对齐新字段（platformIp/platformPort/platformDomain/localIp/localPort/charset/registerStatus）
- 新增 `platform.registerStatus.{offline,online,registering,failed}`
- 移除 `platformName`/`serverIp`/`serverPort`/`serverDomain`/`localClientIp`/`localClientPort` 相关键
- 命名遵循 `module.entity.action` 模式

---

## 5. 时间与分页契约（与 device 模块一致）

| 约定 | 实现 |
|---|---|
| 时间格式 | 后端 VO 出参 **Unix 毫秒**（number），前端 `formatDateTime` 列格式化 |
| 分页方法 | `POST .../getPage`，`page`/`size` 走 query，条件走 body |
| 分页返回 | `{ total: number, items: VO[] }`（非 MyBatis-Plus `Page{records}`） |
| 响应解包 | `requestClient` 配 `successCode:0`/`dataField:'data'`，函数直接拿 `data` |

---

## 6. 验证结果

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端 Controller 单测 | `mvn test -Dtest=CascadePlatformControllerTest,CascadeChannelControllerTest` | ✅ 14/14 绿 |
| 后端 Manager 集成测试 | `mvn test -Dtest=CascadePlatformManagerTest,CascadeChannelManagerTest` | ✅ 11/11 绿 |
| 前端类型检查 | `pnpm --filter @vben/web-antd run typecheck` | ✅ 无错误 |
| 前端构建 | `pnpm build:antd` | ✅ 构建成功 |

> 注：后端集成测试曾因 `.m2` 里 `voglander-service` 是 IDE(ECJ) 编译的坏 jar（`Map.entry` Unresolved compilation problems）而失败，与 cascade 无关；`mvn -pl voglander-service clean install` 刷新后全绿。参见 memory `voglander-module-classpath-trap`。

---

## 7. 后续可选增强（未纳入本次）

| 项 | 说明 | 优先级 |
|---|---|---|
| 注册状态实时刷新 | SSE 推送 `cascade.register` topic（需后端补 `CascadeRegisterStatusEvent` + SseController 监听）或定时轮询 `getPage` | 中 |
| 通道批量绑定 | 从本地设备批量生成级联通道映射（需后端批量 API） | 中 |
| 订阅状态可视化 | 展示上级订阅清单（目录/告警/位置，对应后端 `tb_cascade_subscribe`） | 低 |
| 单元/E2E 测试 | `views/cascade/__tests__/` Schema + 组件测试；Playwright 流程测试 | 低 |

---

## 8. 改动文件清单

**前端**：
- `api/cascade/platform.ts`（字段对齐 VO + 分页改 POST /getPage + 补 registerStatus/charset）
- `api/cascade/channel.ts`（分页改 POST /getPage + 补 enabled）
- `views/cascade/platform/data.ts`（字段改名 + 删 platformName + 补 registerStatus 列/筛选）
- `views/cascade/platform/list.vue`（删除/启停提示改用 platformId）
- `views/cascade/channel/list.vue`（平台下拉 label 改 platformId）
- `locales/langs/{zh-CN,en-US}/cascade.json`（字段标签 + registerStatus 键）

**后端**（详见 `CASCADE-WEB-LAYER-REFACTOR-PLAN.md`）：
- DTO 补 `createTimeToEpochMilli`/`updateTimeToEpochMilli`
- 新增 `web/api/cascade/vo/`（CascadePlatformVO/CascadeChannelVO）
- 新增 `web/api/cascade/resp/`（两个 ListResp）
- 新增 `web/api/cascade/req/`（6 个 Req）
- 新增 `web/api/cascade/assembler/CascadeWebAssembler`
- 重构两个 Controller（POST /getPage + VO/ListResp）
- Manager.getPage 扩展过滤条件
- 同步更新两个 ControllerTest

---

**文档状态**：实施版，与代码一致（已编译/类型检查/构建/测试验证）。字段以后端 `tb_cascade_platform`/`tb_cascade_channel` 为唯一事实来源。
