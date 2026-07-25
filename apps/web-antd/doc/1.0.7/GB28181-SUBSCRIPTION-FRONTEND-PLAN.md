# GB28181-2022 设备订阅 — 前端实现技术方案（设备列表 3 个开关）

> 版本 1.0.7 · 分支 `feat/protocol-lab-external-register` · 文档日期 2026-06-14 配套后端方案：[`../../../../voglander/doc/1.0.7/GB28181-SUBSCRIPTION-TECH-PLAN.md`](../../../../voglander/doc/1.0.7/GB28181-SUBSCRIPTION-TECH-PLAN.md)（§7「前端实现」）前置前端资产：[`GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md`](GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md)（S4 设备管理列表，已落地）、[`GB28181-DEVICE-CHANNEL-SUBSCRIBE-FRONTEND-PLAN.md`](GB28181-DEVICE-CHANNEL-SUBSCRIBE-FRONTEND-PLAN.md)（S5 通道钻取 + 旧订阅入口）契约依据：后端 `DeviceSubscriptionController` + `DeviceVO.subscription` 字段，**严禁发明字段或端点**（`.cursorrules` 铁律）

---

## 0. TL;DR

后端 1.0.7 把订阅从「query + SSE 回包的瞬时语义」升级为**有持久化意图 + 运行态的常驻订阅**（`tb_device_subscription`）。前端对应只做一件事（需求 5）：

> 在已落地的设备管理列表（S4）每一行增加 **3 个开关**——目录订阅 / 位置订阅 / 告警订阅，开关即下发/撤销 SUBSCRIBE，列表回显当前订阅意图。

**不做**：独立订阅详情页 / 弹窗、订阅参数（expires/interval/告警过滤）前端可配、订阅审计报表、历史轨迹回放。

**与旧方案（S5 `DEVICE-CHANNEL-SUBSCRIBE`）的本质区别（必读，避免混淆）**：

| 维度 | 旧 S5 订阅入口 | 本方案（1.0.7 常驻订阅） |
| --- | --- | --- |
| 触发 | 设备操作面板的「订阅」快捷按钮 | **设备列表行内 3 个 CellSwitch 开关** |
| 端点 | 复用 `device-cmd/query-*`（无独立 SUBSCRIBE 端点） | **新增 `PUT /api/v1/device/subscription/toggle`** |
| 语义 | 一次性 query，SSE 回包即结束 | 持久化意图，注册即重订阅 + 定时续订，开关=改意图 |
| 状态回显 | 无（按钮无状态） | 列表回显 `DeviceVO.subscription{catalog,position,alarm}` |

> 旧 S5 的「订阅」快捷按钮与本方案的开关**语义不同、可共存**：按钮 = 临时主动查询一次；开关 = 常驻订阅意图。本方案不动旧按钮。

**前端真正改动**（4 个文件 + 1 处登记）：

1. `api/device.ts` — 加 `SubscriptionVO` / `SubscriptionType` 类型 + `toggleDeviceSubscription` 函数
2. `views/device/data.ts` — `useColumns` 加 3 个 `subColumn`（CellSwitch + beforeChange）
3. `views/device/list.vue` — query 拍平订阅意图为顶层布尔 + `onSubscriptionToggle` 回调
4. `locales/langs/{zh-CN,en-US}/device.json` — `subscription` 段 + `msg.subscribeOn/Off`
5. `.cursorrules` 登记新增字段/端点（**当前缺口，见 §6**）

---

## 1. 与后端契约的精确对齐（实现依据）

> 所有响应经 `requestClient`（`responseReturn:'data'` / `successCode:0`）自动解包 `AjaxResult.data`。

### 1.1 开关订阅端点（新增，`DeviceSubscriptionController`）

| 端点 | 方法 | 入参 body | 返回（解包后） |
| --- | --- | --- | --- |
| `/api/v1/device/subscription/toggle` | **PUT** | `{ deviceId: string, type: SubscriptionType, enabled: boolean }` | `boolean`（下发/撤销是否成功受理） |

**`SubscriptionToggleReq` 字段**（后端 `@Valid`）：

```
deviceId: string   // @NotBlank
type: string       // @NotNull，枚举 CATALOG / MOBILE_POSITION / ALARM
enabled: boolean   // @NotNull
```

> ⚠️ `type` 必须逐字对齐后端 `SubscriptionConstant.Type` 枚举名：`CATALOG` / `MOBILE_POSITION` / `ALARM`（**不是** `POSITION`/`catalog` 等变体）。前端 i18n key 里用 `position` 仅作展示别名，下发到后端的 `type` 始终是 `MOBILE_POSITION`。

**离线容忍语义（前端须知）**：设备离线时开订阅，后端仅持久化意图（`status=PENDING`），返回仍 `success`，等下次设备注册由钩子补发 SUBSCRIBE。**故开关成功 ≠ 订阅已激活**——前端不主动探测运行态，只反映意图开关；运行态变化（设备真正推送）通过 SSE `device.*` 反映在列表行（在线态/通道数/心跳）。

### 1.2 列表订阅意图回显（`DeviceVO` 扩展）

设备分页 `POST /api/v1/device/getPage` 的 `DeviceVO` 新增 `subscription` 字段（后端按 `deviceId` 批量回填，避免 N+1）：

```
subscription?: {
  catalog: boolean;    // 目录订阅意图
  position: boolean;   // 位置订阅意图（对应后端 MOBILE_POSITION）
  alarm: boolean;      // 告警订阅意图
}
```

> 字段缺省（老设备/未建订阅行）时为 `undefined`，前端拍平时统一回退 `false`（见 §3.2）。`subscription.position` 对应后端 `MOBILE_POSITION` 类型——后端 VO 已做映射，前端不再转换。

---

## 2. API 层（`apps/web-antd/src/api/device.ts`）

在 `DeviceApi` namespace 内补类型，文件末尾补请求函数。**已实现**，对齐如下：

```typescript
export namespace DeviceApi {
  // DeviceVO 扩展（§1.2）
  export interface DeviceVO {
    // ...既有字段
    /** GB28181-2022 §9.11 订阅意图开关状态（后端批量回填）。 */
    subscription?: SubscriptionVO;
  }

  /** 订阅意图开关状态（目录/位置/告警）。 */
  export interface SubscriptionVO {
    catalog: boolean;
    position: boolean;
    alarm: boolean;
  }

  /** 订阅类型（与后端 SubscriptionConstant.Type 一致）。 */
  export type SubscriptionType = 'ALARM' | 'CATALOG' | 'MOBILE_POSITION';
}

/**
 * 开关设备订阅（GB28181-2022 §9.11：目录/位置/告警）。
 * 开关即下发/撤销 SUBSCRIBE。
 */
export async function toggleDeviceSubscription(
  deviceId: string,
  type: DeviceApi.SubscriptionType,
  enabled: boolean,
) {
  return requestClient.put<boolean>('/api/v1/device/subscription/toggle', {
    deviceId,
    type,
    enabled,
  });
}
```

> 路径用完整 `/api/v1/...` 前缀（与 `device.ts` 既有函数一致）：`requestClient` baseURL=`/api`，dev 下 vite 代理剥离首段转 `:8081`，无 404 风险。

---

## 3. 列表集成（`views/device/`）

### 3.1 列定义（`data.ts` · `useColumns`）

`useColumns` 增加第二个可选参数 `onSubscriptionToggle`，内部 `subColumn` 工厂构造 3 个 CellSwitch 列。**复用既有 `CellSwitch` 渲染器 + `beforeChange` 模式**（与 `media/stream-proxy` 同源）：

```typescript
export function useColumns<T = DeviceApi.DeviceVO>(
  onActionClick: OnActionClickFn<T>,
  onSubscriptionToggle?: (
    type: DeviceApi.SubscriptionType,
    enabled: boolean,
    row: T,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  const { hasAccessByCodes } = useAccess();

  /** 构造一个订阅开关列（CellSwitch + beforeChange）。 */
  function subColumn(
    field: 'subAlarm' | 'subCatalog' | 'subPosition',
    type: DeviceApi.SubscriptionType,
    titleKey: string,
  ) {
    return {
      field,
      title: $t(titleKey),
      width: 110,
      align: 'center' as const,
      cellRender: {
        name: 'CellSwitch',
        attrs: {
          beforeChange: (newVal: boolean, row: T) =>
            onSubscriptionToggle
              ? onSubscriptionToggle(type, newVal, row)
              : Promise.resolve(false),
          disabled: () => !hasAccessByCodes(['Device:Subscription:Edit']),
        },
        props: { checkedValue: true, unCheckedValue: false },
      },
    };
  }

  return [
    // ...既有列（checkbox / deviceId / name / status / type / ... / registerTime）
    subColumn('subCatalog', 'CATALOG', 'device.subscription.catalog'),
    subColumn('subPosition', 'MOBILE_POSITION', 'device.subscription.position'),
    subColumn('subAlarm', 'ALARM', 'device.subscription.alarm'),
    // ...操作列（detail / edit / delete）
  ];
}
```

**关键设计决策**：

- **拍平为顶层布尔字段**（`subCatalog`/`subPosition`/`subAlarm`），而非用 `subscription.catalog` 点路径。后端方案 §7.2 提示嵌套字段「更稳，推荐」拍平——`CellSwitch` 取 `row[column.field]`，顶层字段对 vxe 响应式/`setGridOptions` 替换更可靠，避免嵌套对象 diff 边界问题。
- **权限双重保护**：列 `disabled` 用 `hasAccessByCodes(['Device:Subscription:Edit'])` 控制开关可点；回调内再校验一次（§3.3），符合 CLAUDE.md「双重权限保护」规范。
- **列宽 110 + 居中**：与机群指挥台等宽读数视觉对齐。

### 3.2 query 拍平（`list.vue` · proxyConfig.ajax.query）

分页查询拿到 `items` 后，把 `subscription` 意图拍平为三个顶层布尔，供 CellSwitch 读取：

```typescript
query: async ({ page }, formValues) => {
  const body = buildDevicePageBody(formValues ?? {});
  const resp = await getDevicePage(
    { page: page.currentPage, size: page.pageSize },
    body,
  );
  totalDevices.value = resp?.total ?? 0;
  // 拍平订阅意图为顶层布尔字段，供 CellSwitch 读取（vxe 列 field=subXxx）。
  const items = (resp?.items ?? []).map((row) => ({
    ...row,
    subCatalog: row.subscription?.catalog ?? false,
    subPosition: row.subscription?.position ?? false,
    subAlarm: row.subscription?.alarm ?? false,
  }));
  pageRows.value = items;
  return { ...resp, items };
},
```

> `?? false` 兜底：`subscription` 缺省（老设备/未建订阅行）时开关默认关闭。

### 3.3 开关回调（`list.vue` · onSubscriptionToggle）

`CellSwitch` 的 `beforeChange` 约定：返回 `true` 提交开关、`false` 回退。**下发成功才提交**：

```typescript
/**
 * 订阅开关回调（CellSwitch beforeChange）：下发/撤销 SUBSCRIBE，成功才提交开关。
 * 返回 true 提交、false 回退（vxe CellSwitch 约定）。
 */
async function onSubscriptionToggle(
  type: DeviceApi.SubscriptionType,
  enabled: boolean,
  row: DeviceApi.DeviceVO,
): Promise<boolean> {
  if (!hasAccessByCodes(['Device:Subscription:Edit'])) {
    message.error($t('device.msg.noPermission'));
    return false;
  }
  const labelMap: Record<DeviceApi.SubscriptionType, string> = {
    CATALOG: $t('device.subscription.catalog'),
    MOBILE_POSITION: $t('device.subscription.position'),
    ALARM: $t('device.subscription.alarm'),
  };
  try {
    await toggleDeviceSubscription(row.deviceId, type, enabled);
    message.success(
      $t(enabled ? 'device.msg.subscribeOn' : 'device.msg.subscribeOff', [
        labelMap[type],
      ]),
    );
    return true;
  } catch {
    return false; // 下发失败 → 开关回退，列表意图不变
  }
}
```

并在 grid 装配时把回调透传给列定义：

```typescript
columns: useColumns(onActionClick, onSubscriptionToggle),
```

**交互语义**：

- 开（`enabled=true`）→ 下发 SUBSCRIBE（在线即刻、离线持久化意图），toast「已开启目录订阅」。
- 关（`enabled=false`）→ 撤销 unsubscribe + 关闭意图，toast「已关闭目录订阅」。
- 失败（网络/后端 4xx）→ 开关视觉回退到原值，不弹成功 toast（错误由 `requestClient` 的 `errorMessageResponseInterceptor` 兜底 `message.error`）。

---

## 4. i18n（`locales/langs/{zh-CN,en-US}/device.json`）

`subscription` 段 + `msg.subscribeOn/Off` 已补齐：

| key | zh-CN | en-US |
| --- | --- | --- |
| `device.subscription.catalog` | 目录订阅 | Catalog Sub. |
| `device.subscription.position` | 位置订阅 | Position Sub. |
| `device.subscription.alarm` | 告警订阅 | Alarm Sub. |
| `device.msg.subscribeOn` | 已开启{0} | {0} enabled |
| `device.msg.subscribeOff` | 已关闭{0} | {0} disabled |
| `device.msg.noPermission` | 您没有执行该操作的权限 | You do not have permission for this operation |

> `{0}` 占位由 `labelMap[type]` 注入（如「目录订阅」），故 toast 读作「已开启目录订阅」。命名遵循 `module.entity.action` 模式（CLAUDE.md i18n 规范）。

---

## 5. 权限码

新增按钮级权限码 **`Device:Subscription:Edit`**（`Module:Entity:Action` 模式）：

- 列 `disabled`：无此码时开关不可点（置灰）；
- 回调首行：无此码 `message.error` + 返回 `false` 回退。

> 权限码须在后端菜单/权限表登记，并由 `GET /auth/codes` 下发到 `hasAccessByCodes`。前端不自造权限码语义——若后端未登记该码，所有用户开关将被置灰（fail-safe，符合最小权限）。**实施时确认后端菜单 SQL 已含 `Device:Subscription:Edit`**。

---

## 6. 契约登记缺口（实施必办）

CLAUDE.md / `.cursorrules` 前后端契约铁律要求**新增字段/端点须登记**。当前核验：

- ❌ `.cursorrules` 未登记 `DeviceVO.subscription` 字段与 `/api/v1/device/subscription/toggle` 端点（`grep -i subscription .cursorrules` 无命中）。
- ❌ 同步 `voglander/.cursor/rules/project-rule.mdc` 亦需登记。

**实施动作**：在两处 cursor-rule 文件登记：

1. 新端点 `PUT /api/v1/device/subscription/toggle`（入参 `{deviceId,type,enabled}`，返回 `boolean`）；
2. `DeviceVO.subscription{catalog,position,alarm}` 字段；
3. 权限码 `Device:Subscription:Edit`。

---

## 7. 验收标准

对齐后端方案 §11 P7 + 总体验收：

1. **可开关**：设备列表每行三个开关可独立开/关，下发成功弹对应 toast；
2. **状态回显**：刷新列表（`gridApi.query()`）后开关状态正确反映后端订阅意图；
3. **失败回退**：后端返回错误时开关视觉回退、不误标成功；
4. **权限隔离**：无 `Device:Subscription:Edit` 码时开关置灰、点击拦截；
5. **离线容忍**：离线设备开订阅仍返回成功（意图持久化），开关保持 ON——前端不因「未激活」而回退；
6. **质量门禁**：`pnpm check`（type/dep/circular/cspell）+ `pnpm build:antd` 通过。

> 联调依赖 lab 模拟设备应答 SUBSCRIBE/推 NOTIFY（后端 §6.8 `LabSubscribeListener`），届时设备变更经 SSE `device.catalog`/`device.*` 刷新列表行，与开关状态共同验证全链路。

---

## 8. 改动文件清单

**改**

- `apps/web-antd/src/api/device.ts` — `SubscriptionVO` / `SubscriptionType` 类型 + `DeviceVO.subscription` + `toggleDeviceSubscription`
- `apps/web-antd/src/views/device/data.ts` — `useColumns` 加 `onSubscriptionToggle` 参数 + 3 个 `subColumn`
- `apps/web-antd/src/views/device/list.vue` — query 拍平订阅意图 + `onSubscriptionToggle` 回调 + 透传列定义
- `apps/web-antd/src/locales/langs/zh-CN/device.json` — `subscription` 段 + `msg.subscribeOn/Off`
- `apps/web-antd/src/locales/langs/en-US/device.json` — 同上

**登记（缺口，§6）**

- `vue-vben-admin/.cursorrules`
- `voglander/.cursor/rules/project-rule.mdc`

**不改**（复用红线）

- `CellSwitch` 渲染器（`adapter/vxe-table.ts` 内置，零改动）
- 旧 S5 订阅快捷按钮（`device-operations.vue`，语义不同，保留）
- 共享命令面板 `DeviceCommandPanel.vue`（零改动）
