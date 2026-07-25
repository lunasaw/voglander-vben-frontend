# GB28181 设备通道层级 + 订阅 — 前端（S5）实现技术方案

> 版本 1.0.7 · 分支 `feat/protocol-lab-external-register` · 文档日期 2026-06-13 前置资产：[`GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md`](GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md)（S4 设备管理列表 + 操作面板，已落地）、[`GB28181-COMMAND-PANEL-SHARED-PLAN.md`](GB28181-COMMAND-PANEL-SHARED-PLAN.md)（共享命令面板）。本文为 S5 增量：**通道层级钻取（设备→通道列表）** + **设备级订阅入口（位置/目录/告警）**。所有契约严格对齐后端**已落地**的 `DeviceChannelController` 与既有命令端点，**严禁发明字段或端点**（`.cursorrules` 铁律）。

---

## 0. TL;DR

在已落地的设备管理页（S4）之上，补两块能力：

1. **通道层级钻取**：设备列表的「通道数」单元格可点击 → path 导航到**独立通道列表页** `/device/channel/:deviceId`，按 `deviceId` 过滤 `POST /api/v1/deviceChannel/getPage`，展示该设备下全部通道（channelId / 名称 / 状态 / 创建时间），通道行可直接点播该 channel。
2. **设备级订阅入口**：在设备操作面板（`device-operations.vue`）新增「订阅 SUBSCRIBE」分区，3 个醒目快捷按钮——订阅目录 / 订阅位置 / 订阅告警，**复用既有 GB query 端点**（`queryCatalog` / `queryMobilePosition` / `queryAlarm`，回包走 SSE）。

**复用红线（去重核心）**：

- 通道点播 **只调既有 `/live/start`**（`liveStart({deviceId, channelId})`），与设备页 / 协议台 ServerPanel 同源；`MediaPlayer.vue` import 复用，不另写。
- 订阅三件套 **不新增后端端点**——后端无独立 `SUBSCRIBE` 端点，GB 语义即 query+SSE 回包，前端镜像既有 `device-cmd/query-*` 即可。
- **不改共享组件**：`DeviceCommandPanel.vue`（协议台共享）零改动；订阅分区为 `device-operations.vue` 本地视图，下方完整命令 deck 保留。
- 前端真正新增：`api/device.ts`（+ 通道分页类型与函数）+ `views/device/channel/{list.vue,data.ts}` + 设备列表跳转 + 订阅分区 + 路由占位 + 菜单 SQL + i18n。

---

## 1. 与后端契约的精确对齐（实现依据，逐端点核对已落地代码）

> 下表逐一核对后端**已实现**的真实代码。所有响应经 `requestClient`（`responseReturn:'data'` / `successCode:0`）自动解包 `AjaxResult.data`。

### 1.1 通道列表（`DeviceChannelController`，已落地）

| 端点 | 方法 | 入参 | 返回（解包后） |
| --- | --- | --- | --- |
| `/api/v1/deviceChannel/getPage` | POST | body=`DeviceChannelQueryReq`（可空）+ query `page`/`size` | `DeviceChannelListResp { total, items: DeviceChannelVO[] }` |

**`DeviceChannelQueryReq` 字段**（全部可选）：

```
id?: number
channelId?: string       // 通道 Id
deviceId?: string         // 设备 ID（钻取按此过滤）
name?: string             // 通道名称
status?: number           // 1在线 / 0离线
```

**`DeviceChannelVO` 字段**（出参，时间为 **Unix 毫秒**，字段以 `Time` 结尾）：

```
id: number
channelId: string
deviceId: string
name?: string
status: number            // 1/0
statusName: string        // "在线"/"离线"（后端已派生，前端直接用）
createTime?: number       // Unix 毫秒
updateTime?: number
extend?: string
extendInfo?: { channelInfo?: string }   // 通道扩展信息（JSON 字符串）
```

> ⚠️ **筛选维度只能按 `channelId / name / status`**（QueryReq 真实字段 + 路由注入的 `deviceId`）。VO 无 `ip/port` 等设备级字段，通道页不展示这些。⚠️ `getPage` 的 `page`/`size` 走 **query string**（`@RequestParam`），body 是查询条件——与 `/device/getPage` 同构。

### 1.2 通道点播（既有端点，复用）

| 端点 | 方法 | 入参 | 返回 |
| --- | --- | --- | --- |
| `/api/v1/live/start` | POST | `{ deviceId, channelId, protocol?, streamMode? }` | `LivePlayVO { playUrls, streamId, ... }` |

通道行点播 = `liveStart({ deviceId: row.deviceId, channelId: row.channelId })`，与设备页 `onLiveStart` 同源；有 `playUrls` 才开 `MediaPlayer` 弹窗。

### 1.3 设备级订阅（既有 GB query 端点，复用；**无独立 SUBSCRIBE 端点**）

| 订阅项 | 复用端点 | 方法 | 入参 | 权限码 | 回包 SSE topic |
| --- | --- | --- | --- | --- | --- |
| 订阅目录 | `/api/v1/device-cmd/query-catalog` | POST | `{ deviceId }` | `Device:Cmd:Query` | `device.catalog` |
| 订阅位置 | `/api/v1/device-cmd/query-mobile-position` | POST | `{ deviceId, interval? }` | `Device:Cmd:Query` | `device.ptz_position` |
| 订阅告警 | `/api/v1/device-cmd/alarm/query` | POST | `{ deviceId, startTime, endTime }` | `Device:Cmd:Alarm` | `device.alarm`（如有） |

> ⚠️ GB28181 的「订阅」在该后端实现为 **query 指令 + 设备应答经 SSE 回投**，并非长连订阅端点。前端文案用「订阅」但实现镜像既有 query 端点——**不得自造 `/subscribe`**。三端点入参均为**设备级 `deviceId`**，不接收 `channelId`，故订阅放设备层（见 §2 决策）。

---

## 2. 设计目标与范围

### 2.1 已定决策（来自需求澄清）

| 决策点 | 选定方案 | 理由 |
| --- | --- | --- |
| 通道列表承载形式 | **独立通道列表页** `/device/channel/:deviceId` | 最贴合「点击跳转通道列表」字面意图，可深链接、可后退；代价是需配后端菜单 SQL（已纳入本方案 §4.5） |
| 订阅操作层级 | **设备级**（位置/目录/告警） | 后端三端点只接收 `deviceId`、不接收 `channelId`；通道级会传不下去 |

### 2.2 范围

- ✅ 设备列表「通道数」单元格可点击钻取 + 操作列回退「通道」按钮。
- ✅ 独立通道列表页（条件筛选 + 分页 + 通道点播）。
- ✅ 设备操作面板新增「订阅」快捷分区。
- ✅ 路由占位 + 菜单 SQL（ID 502）+ i18n + 单测。
- ❌ 通道 CRUD（新增/编辑/删除通道）——后端有端点但本期需求未涉及，不做。
- ❌ 通道级订阅——后端不支持，不做。

### 2.3 视觉语言

通道列表页延续设备列表页的 **Sentinel / Fleet Console** 指挥台美学（`--mono` 等宽读数、HSL 主题令牌、发丝边框、脉冲雷达），形成「设备列表 → 通道列表」连贯钻取叙事。订阅分区延续操作面板的序号化 deck 风格。

---

## 3. 文件改动清单

| # | 文件 | 改动 | 类型 |
| --- | --- | --- | --- |
| F1 | `apps/web-antd/src/api/device.ts` | `+ DeviceChannelVO / DeviceChannelQueryReq / DeviceChannelListResp` 类型；`+ getDeviceChannelPage()` | 改 |
| F2 | `apps/web-antd/src/views/device/channel/list.vue` | 通道列表页（读 route.params.deviceId + Grid + 点播 + 返回） | **新增** |
| F3 | `apps/web-antd/src/views/device/channel/data.ts` | `useColumns / useGridFormSchema / buildChannelPageBody` | **新增** |
| F4 | `apps/web-antd/src/views/device/data.ts` | channelCount 列改可点击单元格（slot）；操作列加 `channels` 回退按钮 | 改 |
| F5 | `apps/web-antd/src/views/device/list.vue` | `+ useRouter`；`+ onChannelClick(row)` path 导航；channelCount slot 模板 | 改 |
| F6 | `apps/web-antd/src/views/device/modules/device-operations.vue` | `+「订阅」deck`（3 快捷按钮，复用既有端点） | 改 |
| F7 | `apps/web-antd/src/router/routes/modules/device.ts` | `+ /device/channel/:deviceId` 静态路由占位（hideInMenu） | 改 |
| F8 | `apps/web-antd/sql/device-menu-insert.sql` | `+ ID 502 DeviceChannelList` 菜单 + role 授权 | 改 |
| F9 | `apps/web-antd/src/locales/langs/{zh-CN,en-US}/device.json` | `+ channel.* / field.channelId / action.channels / action.subscribe* / section.subscribe / msg.subscribeSent` | 改 |
| F10 | `apps/web-antd/src/views/device/channel/__tests__/data.test.ts` | 通道列/schema/纯函数单测 | **新增** |
| F11 | `apps/web-antd/src/views/device/__tests__/i18n.test.ts` | 扫描源文件列表纳入 channel 页 | 改 |

---

## 4. 各子任务实现细节

### 4.1 F1 — `api/device.ts` 通道分页

在 `namespace DeviceApi` 内补类型（镜像 §1.1，零自造）：

```ts
/** 通道查询请求（全部可选；deviceId 由钻取路由注入）。 */
export interface DeviceChannelQueryReq {
  id?: number;
  channelId?: string;
  deviceId?: string;
  name?: string;
  status?: number; // 1在线 / 0离线
}

/** 通道出参（时间 Unix 毫秒）。 */
export interface DeviceChannelVO {
  id: number;
  channelId: string;
  deviceId: string;
  name?: string;
  status: number;
  statusName: string;
  createTime?: number;
  updateTime?: number;
  extend?: string;
  extendInfo?: { channelInfo?: string };
}

export interface DeviceChannelListResp {
  total: number;
  items: DeviceChannelVO[];
}
```

请求函数（page/size 走 query，body 空时发 `{}`，与 `getDevicePage` 同构）：

```ts
/** 通道分页：按 deviceId 过滤该设备下通道。 */
export async function getDeviceChannelPage(
  params: { page: number; size: number },
  body?: DeviceApi.DeviceChannelQueryReq,
) {
  return requestClient.post<DeviceApi.DeviceChannelListResp>(
    `/api/v1/deviceChannel/getPage?page=${params.page}&size=${params.size}`,
    body ?? {},
  );
}
```

### 4.2 F2 + F3 — 独立通道列表页（`views/device/channel/`）

**`data.ts`**（纯函数 + Schema，便于单测）：

```ts
/** 通道筛选 body：透传 channelId/name/status，强制注入 deviceId。 */
export function buildChannelPageBody(
  formValues: Record<string, any>,
  deviceId: string,
): DeviceApi.DeviceChannelQueryReq {
  return { ...formValues, deviceId };
}

/** 顶部筛选：channelId / name / status。 */
export function useGridFormSchema(): VbenFormSchema[] {
  /* Input/Input/Select(1/0) */
}

/** 列：channelId(mono) / name / statusName(CellTag) / createTime / 操作(liveStart)。 */
export function useColumns<T = DeviceApi.DeviceChannelVO>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  /* ... */
}
```

**`list.vue`** 要点：

- `const route = useRoute(); const router = useRouter();`
- `const deviceId = computed(() => route.params.deviceId as string);`
- `const deviceName = computed(() => (route.query.deviceName as string) || deviceId.value);`
- 顶部迷你身份带：返回按钮（`router.push('/device/list')`）+ 设备号 + 设备名（Sentinel 风格）。
- Grid `proxyConfig.ajax.query` → `getDeviceChannelPage({page,size}, buildChannelPageBody(formValues, deviceId.value))`。
- 操作列 `liveStart` → `liveStart({deviceId: row.deviceId, channelId: row.channelId})`，复用 `MediaPlayer.vue` 弹窗（与 `device-operations.vue` 同套逻辑）。
- 权限：列表查看 `Device:Device:Query`，点播 `Device:Cmd:Live`。
- 无 deviceId（直接访问该 path 无参）时显示空态提示 + 返回设备列表。

### 4.3 F4 + F5 — 设备列表「通道数」钻取

**channelCount 单元格可点击**（`views/device/data.ts`）——VXE 列 slot 渲染：

```ts
{
  field: 'channelCount',
  title: $t('device.field.channelCount'),
  width: 90,
  align: 'center',
  className: 'device-cell-count',
  slots: { default: 'channelCount' }, // list.vue 提供具名插槽
}
```

`list.vue` 模板内 `<Grid>` 加插槽：

```vue
<template #channelCount="{ row }">
  <a
    v-if="(row.channelCount ?? 0) > 0"
    class="channel-link"
    @click="onChannelClick(row)"
  >
    {{ row.channelCount }}
  </a>
  <span v-else class="channel-zero">{{ row.channelCount ?? 0 }}</span>
</template>
```

`onChannelClick`（**path 导航**，绕开 backend route name 耦合，见 [[backend-access-mode-route-names]]）：

```ts
function onChannelClick(row: DeviceApi.DeviceVO) {
  if (!hasAccessByCodes(['Device:Device:Query'])) {
    message.error($t('device.msg.noPermission'));
    return;
  }
  router.push({
    path: `/device/channel/${row.deviceId}`,
    query: { deviceName: row.name || row.deviceId },
  });
}
```

**回退方案**：若 VXE 列 slot 转发在本项目不生效（当前代码库无 channelCount slot 先例，构建期验证），改用操作列加 `channels` 按钮（`CellOperation` 已验证的 `attrs.onClick` 范式），保证可点。两方案择一落地，以构建期实测为准。

### 4.4 F6 — 设备级订阅 deck（`device-operations.vue`）

在「概览瓦片」与「01 云台」之间插入订阅分区（本地视图，不动共享 `DeviceCommandPanel`）：

```vue
<section class="deck">
  <div class="deck-label"><span class="deck-no">SUB</span>{{ $t('device.section.subscribe') }}</div>
  <div class="sub-actions">
    <Button :disabled="!hasDevice || loading" @click="onSubscribe('catalog')">
      {{ $t('device.action.subscribeCatalog') }}
    </Button>
    <Button :disabled="!hasDevice || loading" @click="onSubscribe('position')">
      {{ $t('device.action.subscribePosition') }}
    </Button>
    <Button :disabled="!hasDevice || loading" @click="onSubscribe('alarm')">
      {{ $t('device.action.subscribeAlarm') }}
    </Button>
  </div>
</section>
```

```ts
function onSubscribe(kind: 'alarm' | 'catalog' | 'position') {
  const id = deviceId.value;
  const end = Date.now();
  const start = end - 24 * 60 * 60 * 1000;
  const map = {
    catalog: { perm: 'Device:Cmd:Query', fn: () => queryCatalog(id) },
    position: { perm: 'Device:Cmd:Query', fn: () => queryMobilePosition(id) },
    alarm: {
      perm: 'Device:Cmd:Alarm',
      fn: () => queryAlarm({ deviceId: id, startTime: start, endTime: end }),
    },
  } as const;
  const e = map[kind];
  run(e.perm, e.fn, 'device.msg.subscribeSent'); // 复用既有 run() 权限+toast 包装
}
```

> 复用既有 `run(code, fn, okKey)` 包装（设备在线/权限双重校验 + toast），与下方命令 deck 同源。订阅是「常用查询」的醒目快捷分组，下方完整命令面板保留不变。

### 4.5 F7 + F8 — 路由占位 + 菜单 SQL

**`router/routes/modules/device.ts`** 加子路由（静态占位，hideInMenu）：

```ts
{
  path: '/device/channel/:deviceId',
  name: 'DeviceChannel',
  meta: { hideInMenu: true, icon: 'mdi:video-input-component', title: $t('device.channel.title') },
  component: () => import('#/views/device/channel/list.vue'),
}
```

**`sql/device-menu-insert.sql`** 加 ID 502（沿用 500 段，menu_type=2 列表页，hideInMenu）：

```sql
-- 设备通道列表（钻取页，隐藏于菜单）
(502, 500, 'DeviceChannelList', 'device.channel.title', 2, '/device/channel/:deviceId', '/device/channel/list',
 'mdi:video-input-component', 2, 1, 'Device:Device:Query',
 '{"icon": "mdi:video-input-component", "title": "device.channel.title", "hideInMenu": true}');
-- role 授权追加 502
INSERT OR IGNORE INTO tb_role_menu (role_id, menu_id)
SELECT 1, id FROM tb_menu WHERE id = 502;
```

> ⚠️ **运行前提**：web-antd `accessMode:'backend'`，运行时路由由 `/menu/all` 下发。本 SQL 须**并入后端权威库** `voglander/sql/voglander-sqlite.sql`（及 `voglander.sql`）的 Device 500 段、重新导库，跳转才生效；前端静态路由仅作开发期占位/类型参考。

### 4.6 F9 — i18n（zh / en 双语，key 严格一致）

新增 key（节选）：

| key | zh-CN | en-US |
| --- | --- | --- |
| `channel.title` | 通道列表 | Channels |
| `channel.back` | 返回设备列表 | Back to devices |
| `channel.deviceLabel` | 所属设备 | Device |
| `channel.empty` | 未指定设备，无法加载通道 | No device specified |
| `field.channelId` | 通道编号 | Channel ID |
| `action.channels` | 通道 | Channels |
| `action.subscribeCatalog` | 订阅目录 | Subscribe Catalog |
| `action.subscribePosition` | 订阅位置 | Subscribe Position |
| `action.subscribeAlarm` | 订阅告警 | Subscribe Alarm |
| `section.subscribe` | 订阅 | Subscribe |
| `msg.subscribeSent` | 订阅指令已下发 | Subscribe command sent |

---

## 5. 已知缺口与依赖后端的待办（落地前必读）

| # | 缺口 | 影响 | 处置 |
| --- | --- | --- | --- |
| G1 | 通道页路由依赖后端菜单记录 | 未导库时 `router.push` 命中静态占位但运行时未注册 → 可能 404 | SQL 须并入 `voglander/sql/*` 重新导库（§4.5） |
| G2 | 「订阅」无长连端点 | 文案为「订阅」但实现是 query+SSE 回包 | 已镜像既有端点；如后端将来加真订阅端点，仅换 F6 的 `fn` 即可 |
| G3 | 告警订阅强制时间范围 | 后端 `alarm/query` 需 startTime/endTime | 默认最近 24h（与设备页 `alarmQuery` 一致） |
| G4 | channelCount slot 转发未验证 | 本库无 channelCount slot 先例 | 构建期实测；不生效则走 §4.3 回退按钮方案 |
| G5 | 通道在线态实时刷新 | 通道页暂不订阅 SSE 增量（本期范围外） | 用刷新按钮重查；后续可复用 `mergeDeviceEvents` 模式扩展 |

---

## 6. 实施顺序与质量门禁

### 6.1 推荐顺序（每步独立可验）

1. **F1** API 类型 + `getDeviceChannelPage`（先建契约）。
2. **F3 → F2** 通道页 data.ts（纯函数先行）→ list.vue。
3. **F10** 通道 data 单测（红→绿）。
4. **F4 + F5** 设备列表钻取（slot 优先，回退按钮兜底）。
5. **F6** 订阅 deck。
6. **F7 + F8** 路由占位 + 菜单 SQL。
7. **F9 + F11** i18n + i18n 测试扫描扩展。

### 6.2 质量门禁（与 1.0.6 / S4 同标准）

- `pnpm vitest run apps/web-antd/src/views/device apps/web-antd/src/api/__tests__/device.test.ts`（设备 + 通道 + i18n 全绿）。
- i18n 测试从**仓库根目录**跑（`process.cwd()` 拼 `apps/web-antd/src`，子目录跑会 ENOENT）。
- `cd apps/web-antd && pnpm vue-tsc --noEmit -p tsconfig.json` 零报错。
- `pnpm check`（type / dep / circular / cspell）。

### 6.3 验收（Definition of Done）

- [ ] 设备列表通道数可点击（>0），跳转 `/device/channel/:deviceId?deviceName=...`。
- [ ] 通道页按 deviceId 过滤展示通道，可筛选、分页、点播该通道。
- [ ] 通道页可返回设备列表；无 deviceId 显示空态。
- [ ] 操作面板「订阅」分区 3 按钮可下发（权限门禁 + toast）。
- [ ] zh/en key 一致；i18n 测试纳入 channel 页源文件。
- [ ] 菜单 SQL（ID 502）写入并随后端导库说明备注。
- [ ] `DeviceCommandPanel.vue` 等共享组件零改动。
- [ ] 全部单测 + vue-tsc + check 通过。

---

## 7. 复用关系总览（一图胜千言）

```
设备列表 list.vue ──(点 channelCount / 通道按钮)──► path 导航 /device/channel/:deviceId
                                                          │
                                                          ▼
                                    通道列表 channel/list.vue
                                      ├─ getDeviceChannelPage(deviceId)  ← 后端 deviceChannel/getPage
                                      ├─ 点播通道 ─► liveStart({deviceId, channelId})  ← 既有 /live/start（复用）
                                      └─ MediaPlayer.vue（复用，不另写）

设备操作面板 device-operations.vue
  └─「订阅」deck ─► queryCatalog / queryMobilePosition / queryAlarm  ← 既有 device-cmd/*（复用，无新端点）
                    回包 ─► SSE device.catalog / device.ptz_position / device.alarm

不改：DeviceCommandPanel.vue（协议台共享）· MediaPlayer.vue · SipTimeline.vue · useSseEvents.ts
```

---

> **本期前端净新增**：`api/device.ts` 通道分页（~40 行）+ `views/device/channel/{list,data}.vue/ts`（~2 文件）+ 设备列表钻取（~20 行）+ 订阅 deck（~30 行）+ 路由/SQL/i18n/测试。**所有数据动作复用既有端点，零后端契约新增**（仅消费已落地的 `deviceChannel/getPage`）。
