# GB28181 设备命令面板 — 共享抽象与双页全覆盖技术方案

> 版本 1.0.7 · 文档日期 2026-06-13 关联：[`GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md`](./GB28181-DEVICE-MANAGEMENT-FRONTEND-PLAN.md)（设备管理 S4 前端）前置资产：[`1.0.6/GB28181-PROTOCOL-LAB-FRONTEND-PLAN.md`](../1.0.6/GB28181-PROTOCOL-LAB-FRONTEND-PLAN.md)（协议验证台前端）

---

## 0. TL;DR

把 GB28181 设备命令按钮抽象成**一层共享展示组件** `DeviceCommandPanel.vue`，承载**全部协议功能**。协议验证台（ServerPanel）与设备管理页（device-operations）都引用同一组件，**两页覆盖完全相同的协议能力**，区别只在**用途与门禁语义**：

| 维度 | 协议验证台 ServerPanel | 设备管理页 device-operations |
| --- | --- | --- |
| **用途** | 验证 GB28181 协议链路是否跑通 | 生产环境对真实设备做日常管理 |
| **设备来源** | 模拟设备（lab SSE 实时 upsert） | 后端 `/device/getPage` 分页列表 |
| **门禁语义** | ��备**在线态**门禁（C2 时序约束） | **权限码**门禁（`Device:Cmd:*`） |
| **调用 API** | `#/api/protocol-lab` | `#/api/device` |
| **协议命令集** | **全部** | **全部**（与左侧完全一致） |

**一句话**：命令按钮只有一份（共享组件），命令实现按页注入；验证台用来"验协议"，设备页用来"管设备"，能力对等。

---

## 1. 现状与问题

### 1.1 问题陈述

协议验证台 `ServerPanel.vue` 当前只暴露 4 个命令：查目录 / 查设备信息 / 重启 / 点播 + PTZ 方向盘。而 GB28181 的完整命令��（**查状态 / 查预置位 / 查移动位置 / 配置下载下发 / 录像开始停止查询 / 报警查询复位 / 语音广播**）只做在了设备管理页 `device-operations.vue`，**协议验证台无法验证这些协议**。

### 1.2 根因

两页各写一套命令按钮 + handler，导致：

- **能力漂移**：新协议命令只在一页落地，另一页缺失。
- **重复**：按钮 markup、disabled 门控、i18n 引用两份。
- **维护风险**：改一处忘改另一处。

### 1.3 已有的正确范本

`components/PtzControl.vue`（F4 已抽取）已是教科书式范本：

- **纯展示**：只渲染按钮 + `emit('command', payload)`，不直接调 API。
- **父级注入**：父组件接 `command` 事件后决定调 `/ptz/control` 或做权限/在线校验。
- **i18n 前缀可配**：`labelPrefix` 默认 `protocolLab.ptz`，设备页可换 `device.ptz`。
- **常量外置**：`PTZ_DIRECTIONS / PTZ_ZOOM` 放 `ptz-control.ts`，两页共用一份词表。

本方案把这套范本从"PTZ 方向盘"扩展到"全部设备命令"。

---

## 2. 设计目标

| 目标              | 说明                                               |
| ----------------- | -------------------------------------------------- |
| **G1 单一命令层** | 全部命令按钮只存在于 `DeviceCommandPanel.vue` 一处 |
| **G2 双页全覆盖** | 协议验证台 = 设备管理页，协议能力**逐项对等**      |
| **G3 用途分离**   | 命令**实现**（API/门禁/提示）由父页注入，互不耦合  |
| **G4 零契约变更** | 全部命令命中已存在后端端点，不发明字段/端点        |
| **G5 不回归**     | 协议台 / 设备页既有联调行为不变；测试守护          |

---

## 3. 架构：三层

```
┌────────────────────────────────────────────────────────────────┐
│  展示层（共享、纯 UI、无业务）                                    │
│  ├─ PtzControl.vue          ← 已存在：PTZ 方向盘                 │
│  └─ DeviceCommandPanel.vue  ← 新增：查询/配置/录像/报警/广播/重启 │
│       props: { disabled, labelPrefix }                          │
│       emit:  command({ code, configType? })                     │
│       常量:  device-commands.ts（命令描述符，单一词表）          │
└────────────────────────────────────────────────────────────────┘
                          ▲ emit command(code)          ▲
                          │                              │
┌─────────────────────────┴──────┐   ┌──────────────────┴──────────────┐
│  编排层（按页注入实现）          │   │  编排层（按页注入实现）           │
│  ServerPanel.vue               │   │  device-operations.vue           │
│  · 在线态门禁 canCommand        │   │  · 权限码门禁 hasAccessByCodes    │
│  · onCommand → #/api/protocol-lab│  │  · onCommand → #/api/device       │
│  · 点播 → MediaPlayer           │   │  · 点播 → MediaPlayer             │
└────────────────────────────────┘   └───────────────────────────────────┘
                          ▲                              ▲
                  协议验证台（验协议）            设备管理页（管设备）
```

> **复用红线**：`DeviceCommandPanel` / `PtzControl` / `MediaPlayer` / `SipTimeline` 一律 import 复用，**禁止任一页另写命令按钮**。

---

## 4. 命令全集（双页对等，逐项命中已落地端点）

> 全部 `requestClient` 自动解包 `AjaxResult.data`（`responseReturn:'data'` + `successCode:0`）。PTZ/点播复用 `/ptz`、`/live`（协议台 ServerPanel 已验证，勿重建）；其余命中 `/device-cmd/*`（S2 已落地）。

| 分组 | 命令 code | 端点 | 协议台调用（protocol-lab.ts） | 设备页调用（device.ts） |
| --- | --- | --- | --- | --- |
| **ptz** | （PtzControl 8 向+STOP+变倍） | `POST /api/v1/ptz/control` | `ptzControl` ✅ | `ptzControl` ✅ |
| **query** | `queryCatalog` | `/device-cmd/query-catalog` | `queryCatalog` ✅ | `queryCatalog` ✅ |
|  | `queryInfo` | `/device-cmd/query-info` | `queryDeviceInfo` ✅ | `queryDeviceInfo` ✅ |
|  | `queryStatus` | `/device-cmd/query-status` | **新增** `queryDeviceStatus` | `queryDeviceStatus` ✅ |
|  | `queryPreset` | `/device-cmd/query-preset` | **新增** `queryPreset` | `queryPreset` ✅ |
|  | `queryMobilePosition` | `/device-cmd/query-mobile-position` | **新增** `queryMobilePosition` | `queryMobilePosition` ✅ |
| **config** | `configDownload` | `/device-cmd/config/download` | **新增** `downloadConfig` | `downloadConfig` ✅ |
| **record** | `recordStart` | `/device-cmd/record/start` | **新增** `controlRecordStart` | `controlRecordStart` ✅ |
|  | `recordStop` | `/device-cmd/record/stop` | **新增** `controlRecordStop` | `controlRecordStop` ✅ |
|  | `recordQuery` | `/device-cmd/record` | **新增** `queryRecord` | `queryRecord` ✅ |
| **alarm** | `alarmQuery` | `/device-cmd/alarm/query` | **新增** `queryAlarm` | `queryAlarm` ✅ |
|  | `alarmControl` | `/device-cmd/alarm/control` | **新增** `controlAlarm` | `controlAlarm` ✅ |
| **other** | `broadcast` | `/device-cmd/broadcast` | **新增** `broadcast` | `broadcast` ✅ |
|  | `reboot` | `/device-cmd/reboot` | `rebootDevice` ✅ | `rebootDevice` ✅ |
| **live** | （点播，父页直调，不入面板） | `POST /api/v1/live/start` | `liveStart` ✅ | `liveStart` ✅ |

> **点播为何不入面板**：点播返回 `playUrls` 后要拉起 `MediaPlayer` 弹窗，是**父页职责**（验证台/设备页各自管理弹窗状态），故 `liveStart` + `MediaPlayer` 留在父页，与面板平级。面板只发"命令意图"，不持有播放器。
>
> **协议台需补的后端命令函数**：上表"新增"列共 10 个，均指向 `/device-cmd/*` **已存在端点**（与 `device.ts` 同源），加进 `protocol-lab.ts` 让验证台 API 模块自洽，**无新端点/新字段，不触发 `.cursorrules` 契约登记**。

### 4.1 参数约定（沿用 device-operations 已验证逻辑）

- `configDownload`：`configType` 后端 `@NotBlank`，面板内 `Select`（BASIC/VIDEO/AUDIO，默认 BASIC）→ emit 时随 `command` 带 `configType`。
- `recordQuery` / `alarmQuery`：后端强制 `startTime/endTime`（Unix 毫秒）非空，父页默认查**最近 24h**。
- `alarmControl`：后端强制 `alarmMethod/alarmType` 非空，父页默认 `alarmMethod='1'`（电话报警）`alarmType='0'`（全部）。

---

## 5. 组件契约

### 5.1 `components/device-commands.ts`（命令描述符，仿 ptz-control.ts）

```typescript
/**
 * GB28181 设备命令描述符（共享）。
 * 与后端 DeviceCmdController 端点一一对应，是前后端命令契约镜像，不得擅增删。
 * code = 命令标识（父页 switch 用）；section = 分组（渲染 Divider 用）。
 */
export interface DeviceCommand {
  /** 命令标识，父页 onCommand switch 据此调对应 API。 */
  code: string;
  /** 分组：query | config | record | alarm | other（决定 Divider 归属）。 */
  section: 'alarm' | 'config' | 'other' | 'query' | 'record';
  /** 是否危险动作（复位/重启等，渲染 danger 样式，可选）。 */
  danger?: boolean;
}

export const DEVICE_COMMAND_SECTIONS = [
  'query',
  'config',
  'record',
  'alarm',
  'other',
] as const;

export const DEVICE_COMMANDS: DeviceCommand[] = [
  { code: 'queryCatalog', section: 'query' },
  { code: 'queryInfo', section: 'query' },
  { code: 'queryStatus', section: 'query' },
  { code: 'queryPreset', section: 'query' },
  { code: 'queryMobilePosition', section: 'query' },
  { code: 'configDownload', section: 'config' },
  { code: 'recordStart', section: 'record' },
  { code: 'recordStop', section: 'record' },
  { code: 'recordQuery', section: 'record' },
  { code: 'alarmQuery', section: 'alarm' },
  { code: 'alarmControl', section: 'alarm', danger: true },
  { code: 'broadcast', section: 'other' },
  { code: 'reboot', section: 'other', danger: true },
];
```

### 5.2 `components/DeviceCommandPanel.vue`（纯展示）

```typescript
/**
 * 共享设备命令面板（查询/配置/录像/报警/广播/重启）。
 *
 * 范本同 PtzControl：只渲染按钮 + emit('command')，不调 API、不做权限/在线判断——
 * 由父页接 command 后注入实现（验证台调 protocol-lab、设备页调 device，门禁各异）。
 *
 * - 按 section 分组渲染（Divider + Space wrap），文案走 ${labelPrefix}.section.* / .action.*
 * - configDownload 前置一个 configType 下拉（面板内部 state），emit 时随 command 带出
 * - disabled 时整组禁用且点击不 emit（与 PtzControl 一致的自身门控）
 */
interface Props {
  /** 禁用整组（父页据在线态 / loading / 无设备决定）。 */
  disabled?: boolean;
  /** i18n 前缀，默认 device（两页共用 device.* 词表，与 PtzControl 同理）。 */
  labelPrefix?: string;
}
// emit: command(payload: { code: string; configType?: string })
```

> **emit 不带 deviceId**：命令的目标设备由父页持有（验证台 `selectedId`、设备页 `props.device`），面板只发"做什么"（code），父页决定"对谁做"。这与 PtzControl 不同（PTZ 需 channelId 随方向一起发），因命令面板的 code 是无参意图，更干净。

### 5.3 父页注入范式

**协议验证台 ServerPanel.vue**（在线态门禁）：

```typescript
import * as labApi from '#/api/protocol-lab';

function onCommand({
  code,
  configType,
}: {
  code: string;
  configType?: string;
}) {
  if (!canCommand.value) {
    message.warning($t('protocolLab.msg.selectOnlineDevice'));
    return;
  }
  const id = selectedId.value;
  const end = Date.now();
  const start = end - 24 * 60 * 60 * 1000;
  const map: Record<string, () => Promise<unknown>> = {
    queryCatalog: () => labApi.queryCatalog(id),
    queryInfo: () => labApi.queryDeviceInfo(id),
    queryStatus: () => labApi.queryDeviceStatus(id),
    queryPreset: () => labApi.queryPreset(id),
    queryMobilePosition: () => labApi.queryMobilePosition(id),
    configDownload: () => labApi.downloadConfig(id, configType ?? 'BASIC'),
    recordStart: () => labApi.controlRecordStart(id),
    recordStop: () => labApi.controlRecordStop(id),
    recordQuery: () =>
      labApi.queryRecord({ deviceId: id, startTime: start, endTime: end }),
    alarmQuery: () =>
      labApi.queryAlarm({ deviceId: id, startTime: start, endTime: end }),
    alarmControl: () =>
      labApi.controlAlarm({ deviceId: id, alarmMethod: '1', alarmType: '0' }),
    broadcast: () => labApi.broadcast(id),
    reboot: () => labApi.rebootDevice(id),
  };
  run(map[code]!, 'device.msg.cmdSent'); // 复用既有 run() 在线态包装
}
```

**设备管理页 device-operations.vue**（权限码门禁，保留现有 run(code,fn)）：

```typescript
const CMD_PERM: Record<string, string> = {
  queryCatalog: 'Device:Cmd:Query',
  queryInfo: 'Device:Cmd:Query',
  queryStatus: 'Device:Cmd:Query',
  queryPreset: 'Device:Cmd:Query',
  queryMobilePosition: 'Device:Cmd:Query',
  configDownload: 'Device:Cmd:Config',
  recordStart: 'Device:Cmd:Record',
  recordStop: 'Device:Cmd:Record',
  recordQuery: 'Device:Cmd:Record',
  alarmQuery: 'Device:Cmd:Alarm',
  alarmControl: 'Device:Cmd:Alarm',
  broadcast: 'Device:Cmd:Broadcast',
  reboot: 'Device:Cmd:Config',
};
// onCommand 据 code 取权限码 + 对应 device.ts 函数，复用现有 run(code, fn)
```

> 两页 `onCommand` 形状一致、实现注入不同 —— 正是"按钮一份、实现两份"的落点。

---

## 6. 文件改动清单

| # | 动作 | 文件 | 说明 |
| --- | --- | --- | --- |
| 1 | 新增 | `src/components/device-commands.ts` | 命令描述符 + 分组常量 |
| 2 | 新增 | `src/components/DeviceCommandPanel.vue` | 共享命令面板（纯展示） |
| 3 | 修改 | `src/api/protocol-lab.ts` | 补 10 个 device-cmd 包装（命中已存在端点） |
| 4 | 修改 | `src/views/protocol-lab/components/ServerPanel.vue` | 删内联命令、接 `DeviceCommandPanel`；**补齐全协议** |
| 5 | 修改 | `src/views/device/modules/device-operations.vue` | 删内联命令、接 `DeviceCommandPanel`；命令集不变 |
| 6 | 修改 | `src/locales/langs/zh-CN/device.json` | 加 `section.broadcast`、`section.other`、`action.reboot` |
| 7 | 修改 | `src/locales/langs/en-US/device.json` | 同上（zh/en 平行） |
| 8 | 新增 | `src/components/__tests__/DeviceCommandPanel.test.ts` | 渲染分组 / emit code / disabled / configType |
| 9 | 修改 | `src/views/protocol-lab/__tests__/ServerPanel.test.ts` | 加 Divider/Select mock + 新 api mock；命令断言对齐 |
| 10 | 修改 | `src/views/device/__tests__/i18n.test.ts` | 扫描 source 列表加 `DeviceCommandPanel.vue` |

**device-operations.test.ts 预期不改**：面板真挂载（不 stub），按钮文案仍 `device.action.*`，点击经 `onCommand` 调既有 device.ts 函数，现有断言（`queryCatalog('d1')` 等）继续命中。

---

## 7. i18n 增量

`device.json`（zh / en 平行）补：

```jsonc
// zh-CN
"section": {
  "ptz": "云台控制", "query": "设备查询", "config": "设备配置",
  "record": "录像控制", "alarm": "报警",
  "other": "其它",            // 新增（广播 / 重启归此）
  "media": "点播",            // 收窄：原"广播 / 点播"→"点播"
  "events": "实时事件"
},
"action": {
  // …既有…
  "reboot": "远程重启"        // 新增
}
```

```jsonc
// en-US
"section": { …, "other": "Other", "media": "Live", … },
"action": { …, "reboot": "Reboot" }
```

> **命名空间坑**（1.0.6 复盘 [[protocol-lab-tests]]）：`loadLocalesMapFromDir` 用**原始文件名**做命名空间且不转大小写。文件名 `device.json` → 命名空间 `device` → 引用 `device.*` 命中。两页共用 `device.*`（含验证台）—— 与 `PtzControl` 共用 `protocolLab.ptz.*` 同一手法。`typecheck/build` 不校验运行时 i18n key，须 `pnpm dev:antd` 实看。

---

## 8. 测试策略

### 8.1 新增 `DeviceCommandPanel.test.ts`

- 渲染：按 `DEVICE_COMMANDS` 渲出全部命令按钮（数量 = 描述符长度），按 section 分组
- emit：点 `queryCatalog` → `emit('command', { code: 'queryCatalog' })`
- configType：切 Select=VIDEO 后点 `configDownload` → `emit` 带 `configType:'VIDEO'`
- 门控：`disabled=true` 时按钮禁用 + 点击不 emit（仿 PtzControl 自身门控）
- labelPrefix：默认 `device.action.*`，可覆盖

### 8.2 更新 `ServerPanel.test.ts`

- 加 `Divider` / `Select` ant-design-vue mock
- 加 10 个 `#/api/protocol-lab` 新函数 mock
- 既有 `queryCatalog` 断言文案从 `protocolLab.server.queryCatalog` → `device.action.queryCatalog`（因移入共享面板，统一词表）
- 新增："查状态/报警复位/广播…经 onCommand 调对应 labApi 且携带 selectedId"；"离线时命令不下发"

### 8.3 守护既有

- `device-operations.test.ts`：不改，验证面板挂载后命令链路不回归
- `device i18n.test.ts`：source 列表加 `DeviceCommandPanel.vue`，守 key 覆盖（静态扫描命中数仍 >20）
- `PtzControl.test.ts`：不动（PTZ 不在本次范围）

### 8.4 门禁

```bash
pnpm test:unit                 # 相关 spec 全绿
pnpm check:type                # vue-tsc，新增文件 0 error
npx eslint <改动文件>           # 0 error / 0 warning
pnpm dev:antd                  # 实看协议台/设备页：命令对等、文案正确、点击连通
```

---

## 9. 验收（Definition of Done）

- [ ] `DeviceCommandPanel.vue` 承载**全部**设备命令，两页 import 复用，**无任一页另写命令按钮**
- [ ] 协议验证台命令集 == 设备管理页命令集（PTZ/查询五项/配置/录像三项/报警两项/广播/重启逐项对等）
- [ ] 验证台门禁=在线态、设备页门禁=权限码；`onCommand` 形状一致、实现注入不同
- [ ] 点播 `liveStart` + `MediaPlayer` 两页各自留在父页，行为不变
- [ ] `protocol-lab.ts` 新增 10 函数全部命中已存在 `/device-cmd/*` 端点，**0 新字段/端点**
- [ ] i18n `device.json` zh/en 平行，新增 `section.other/broadcast`、`action.reboot`
- [ ] 新增 `DeviceCommandPanel.test.ts`；`ServerPanel.test.ts` 命令断言对齐；`device-operations.test.ts` 不回归；i18n 守卫覆盖面板
- [ ] `pnpm check` 全绿；`pnpm dev:antd` 实看两页协议能力对等

---

## 10. 权衡与决策记录

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 命令面板是否含 deviceId | **不含**，父页持有目标设备 | code 是无参意图，父页据自身上下文（lab selectedId / device prop）定目标，最干净 |
| 点播是否入面板 | **不入**，父页直调 + MediaPlayer | 点播要管播放器弹窗状态，是父页职责，强行入面板会把弹窗状态泄进展示层 |
| protocol-lab.ts vs device.ts 的 device-cmd 函数 | **各自保留一份**（重复 ~10 个） | 代码库已容忍此类重复（queryCatalog/reboot 本就两份）；彻底去重需抽 `api/device-cmd.ts` 公共模块，属更大重构，本期留 TODO |
| 验证台命令 i18n 词表 | 统一切到 `device.*` | 与 PtzControl 共用 `protocolLab.ptz.*` 同一手法；命令语义两页一致，无须两份文案 |
| 门禁差异 | 父页注入，面板只发 `disabled` | 在线态 vs 权限码是"用途"差异，正是两页唯一该有的区别 |

> **未来 TODO（非本期）**：抽 `src/api/device-cmd.ts` 统一 `/device-cmd/*` 包装，protocol-lab.ts 与 device.ts 共享导入，彻底消除 10 个重复函数。 </content> </invoke>
