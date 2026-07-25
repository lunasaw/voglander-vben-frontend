# GB28181 设备管理 — 前端（S4）实现技术方案

> 版本 1.0.7 · 分支 `0608_dev` · 文档日期 2026-06-13 配套后端方案：[`../../../../voglander/doc/1.0.7/GB28181-DEVICE-MANAGEMENT-TECH-PLAN.md`](../../../../voglander/doc/1.0.7/GB28181-DEVICE-MANAGEMENT-TECH-PLAN.md) **后端 S1/S2/S3 已完整实现并核验通过（101 测试全绿，全量 reactor BUILD SUCCESS，2026-06-13）**，本文为前端 S4 实施方案，所有契约严格对齐后端**已落地**的真实代码。关联前端资产：[`1.0.6/GB28181-PROTOCOL-LAB-FRONTEND-PLAN.md`](../1.0.6/GB28181-PROTOCOL-LAB-FRONTEND-PLAN.md)（协议验证台前端，本期最大化复用其沉淀的播放器/SSE/时间线/PTZ）。

---

## 0. TL;DR

设备管理页 = **协议验证台已验证能力的生产化封装**，不另起炉灶。一个标准 CRUD 列表页 `/device/list` + 设备详情操作面板：

- **列表**：条件筛选（deviceId / 名称 / 状态 / 类型 / IP / 时间范围）+ 持久化分页（走后端 `POST /device/getPage`），展示在线状态、心跳、注册时间、通道数。
- **详情/操作面板**：复用协议台已验证的 PTZ 方向盘 / 实时点播 / 录像回放 + 新增支链按钮（查状态/预置位/配置/录像控制/报警/广播）+ SSE 实时事件时间线。
- **实时刷新**：复用 `useSseEvents` 订阅 `device.*`，列表行状态、扩展快照随设备应答实时更新。
- **数据通道**：REST（`requestClient`）触发动作 + 单条 SSE 长连接接收实时事件。

**复用红线（去重核心）**：实时点播 / PTZ / 录像回放前端**只调已存在的 `/live/*`、`/ptz/*`、`/playback/*`**，与 ServerPanel 同源；播放器（`MediaPlayer.vue`）、SSE（`useSseEvents.ts`）、时间线（`SipTimeline.vue`）一律 import 复用，**不另写一套**��前端真正新增的只有：设备列表页骨架 + `api/device.ts`（提取通用命令 + 新增支链）+ i18n + 路由。

---

## 1. 与后端契约的精确对齐（实现依据，逐端点核对已落地代码）

> 下表是前端逐一核对后端**已实现并测试通过**的真实代码，前端即按此实现，**严禁发明字段或端点**（.cursorrules 铁律）。所有响应经 `requestClient` 的 `responseReturn:'data'` 自动解包 `AjaxResult.data`。

### 1.1 设备列表（S1，`DeviceController`）

| 端点 | 方法 | 入参 | 返回（解包后） |
| --- | --- | --- | --- |
| `/api/v1/device/getPage` | POST | body=`DevicePageReq`（可空）+ query `page`/`size` | `DeviceListResp { total, items: DeviceVO[] }` |

**`DevicePageReq` 字段**（全部可选，时间为 **Unix 毫秒**）：

```
id?: number
deviceId?: string        // 精确
name?: string            // 模糊
status?: number          // 1在线/0离线
type?: number            // 协议类型 DeviceAgreementEnum
ip?: string              // 模糊
serverIp?: string        // 注册节点，精确
keepaliveTimeStart?: number  // 心跳时间范围（Unix 毫秒）
keepaliveTimeEnd?: number
registerTimeStart?: number   // 注册时间范围
registerTimeEnd?: number
```

> ⚠️ **筛选维度只能按 `type`**（DeviceDO 真实列）。`subType` / `protocol` 是 `DeviceVO` 的**派生展示字段**，DeviceDO 无对应列，**不可作筛选条件**（后端 §缺口 D，否则 wrapper 引用不存在的列）。

**`DeviceVO` 字段**（出参，时间均 Unix 毫秒，字段以 `Time` 结尾）：

```
id, deviceId, name, ip, port, serverIp, extend
status: number           // 1/0
statusName: string       // "在线"/"离线"（后端已派生，前端可直接用）
type, typeName
subType, subTypeName     // 派生展示
protocol, protocolName   // 派生展示
createTime, updateTime, registerTime, keepaliveTime  // Unix 毫秒
channelCount: number     // 【S1 新增】该设备下通道数（后端逐设备回填）
extendInfo: ExtendInfoVO // 见 1.3
```

### 1.2 设备命令下发（S2，`DeviceCmdController` 全部 Req 化 + 支链端点）

> 路径前缀 `/api/v1/device-cmd`。**S2 已把 4 个旧端点从 `Map<String,String>` 升级为类型化 Req**，并新增 GB 专属支链端点。所有端点返回 `AjaxResult<Boolean>`（解包后为 `boolean`）。

| 端点 | 方法 | 入参（JSON body） | 说明 |
| --- | --- | --- | --- |
| `/query-catalog` | POST | `{ deviceId }` | 查目录（Req 化） |
| `/query-info` | POST | `{ deviceId }` | 查设备信息（Req 化） |
| `/reboot` | POST | `{ deviceId }` | 重启（Req 化，记 [AUDIT]） |
| `/record` | POST | `{ deviceId, startTime?, endTime? }` | 触发录像查询（startTime/endTime Unix 毫秒） |
| `/query-status` | POST | `{ deviceId }` | 【新】查设备状态 |
| `/query-preset` | POST | `{ deviceId }` | 【新】查预置位 |
| `/query-mobile-position` | POST | `{ deviceId, interval? }` | 【新】查移动位置订阅 |
| `/config/download` | POST | `{ deviceId, configType }` | 【新】下载配置 BASIC/VIDEO/AUDIO |
| `/config/set` | POST | `{ deviceId, name?, expiration?, heartBeatInterval?, heartBeatCount? }` | 【新】下发配置，记 [AUDIT] |
| `/record/start` | POST | `{ deviceId }` | 【新】开始录像，记 [AUDIT] |
| `/record/stop` | POST | `{ deviceId }` | 【新】停止录像，记 [AUDIT] |
| `/alarm/query` | POST | `{ deviceId, startTime?, endTime?, startPriority?, endPriority?, alarmMethod?, alarmType? }` | 【新】查报警 |
| `/alarm/control` | POST | `{ deviceId, alarmMethod?, alarmType? }` | 【新】报警复位，记 [AUDIT] |
| `/broadcast` | POST | `{ deviceId }` | 【新】语音广播，记 [AUDIT] |

> **`config/download` 校验**：`configType` 后端 `@NotBlank`，缺失返回 **400**。`query-status/preset/mobile-position/broadcast` 的 `deviceId` 后端 `@NotBlank`，前端需先校验。

### 1.3 已存在端点（协议台已验证，设备页直接复用，严禁重建）

| 能力 | 端点 | 入参 | 返回 |
| --- | --- | --- | --- |
| **PTZ 控制** | `POST /api/v1/ptz/control` | `PtzControlReq { deviceId, channelId?, command, speed? }` | `boolean` |
| **PTZ 停止** | `POST /api/v1/ptz/stop` | `{ deviceId }` | `boolean` |
| **实时点播** | `POST /api/v1/live/start` | `LiveStartReq { deviceId, channelId, protocol?, streamMode? }` | `LivePlayVO { streamId, callId, status, playUrls, refCount }` |
| **停流** | `POST /api/v1/live/stop` | `{ streamId }` | `boolean` |
| **录像回放** | `POST /api/v1/playback/start` | `PlaybackStartReq` | `LivePlayVO` |
| **回放停止** | `POST /api/v1/playback/stop` | `{ streamId }` | `boolean` |
| **回放控制** | `POST /api/v1/playback/control` | `PlaybackControlReq`（仅 L1 pause/resume） | `boolean` |
| **录像查询** | `POST /api/v1/playback/records` | `RecordQueryReq` | 录像列表 |

> **去重红线**：上述 8 个端点协议台 ServerPanel 已验证跑通，设备页 PTZ/点播/回放**直接调它们**，不在 `device-cmd` 重复造。

### 1.4 入站响应回填 → SSE 主题（S3，`Gb28181ProtocolHandler`）

设备应答经后端落库/缓存后，按既有约定推 `device.*` SSE。前端 `useSseEvents` 订阅这些主题实时刷新：

| SSE topic | 触发 | payload 关键字段 | 前端用途 |
| --- | --- | --- | --- |
| `device.register` / `device.online` / `device.offline` | 生命周期 | `deviceId` | 列表行在线态刷新 |
| `device.keepalive` | 心跳（5s 节流） | `deviceId` | 心跳时间刷新 |
| `device.catalog` | 目录响应 | `deviceId`, `channelCount` | 通道数刷新 |
| `device.info` | 设备信息 | `deviceId`, `manufacturer` | 厂商/型号刷新 |
| `device.status` | 【S3】状态响应 | `deviceId`, `online` | 详情面板状态快照 |
| `device.ptz_position` | 【S3】云台位置 | `deviceId`, `pan` | 详情面板 PTZ 位置 |
| `device.preset` | 【S3】预置位 | `deviceId`, `sn` | 详情面板预置位列表 |
| `device.config` | 【S3】配置响应 | `deviceId`, `result` | 详情面板配置 |
| `device.config_download` | 【S3】配置下载 | `deviceId`, `result` | 详情面板配置下载 |
| `device.recordinfo` | 【S3】录像结果 | `deviceId`, `sumNum` | 提示前端拉取录像缓存结果 |

> **录像结果获取**：`device.recordinfo` 是**通知**（不含列表本体，列表在后端 RedisCache `device:record:result:{deviceId}:{sn}`，TTL 10min）。当前后端**未暴露**读缓存端点（方案 §5.4 标为 S2/S3 交界、实现放 S3，实际本期后端未落地读端点）——见 §5 缺口说明，前端本期录像结果展示**降级为占位/待后端补 `/record/result` 端点**。

---

## 2. 设计目标与范围

按"列表先行、操作复用、实时联动"推进：

| 子任务 | 主题 | 产出 | 验收 |
| --- | --- | --- | --- |
| **F1** | `api/device.ts` API 层 | 提取协议台通用命令 + 新增 S2 支链 + getPage | 类型对齐后端契约，0 臆造字段 |
| **F2** | 设备列表页 | `views/device/list.vue` + `data.ts`（VxeGrid 筛选 + 分页 + channelCount/statusName 列） | 各条件筛选返回正确，SSE 增量刷新行状态 |
| **F3** | 设备操作面板 | `views/device/modules/device-detail.vue`（复用 PtzControl + 查询/配置/报警按钮组 + MediaPlayer + SipTimeline） | PTZ/点播复用既有端点跑通，支链端点连通 |
| **F4** | 提取共享组件 | `components/PtzControl.vue`（从 ServerPanel 抽 PTZ 方向盘） | ServerPanel 与设备页共用，协议台不回归 |
| **F5** | 路由 + i18n + 菜单 | `router/routes/modules/device.ts` + `device.json`(zh/en) + 菜单 SQL | `pnpm check` 绿，菜单文案正确 |

---

## 3. 文件改动清单

| # | 动作 | 文件 | 子任务 |
| --- | --- | --- | --- |
| 1 | 新增 | `src/api/device.ts` | F1 |
| 2 | 新增 | `src/views/device/list.vue` | F2 |
| 3 | 新增 | `src/views/device/data.ts`（表单 schema + 列定义） | F2 |
| 4 | 新增 | `src/views/device/modules/device-detail.vue`（操作面板抽屉/弹窗） | F3 |
| 5 | 新增 | `src/components/PtzControl.vue`（从 ServerPanel 提取 PTZ 方向盘） | F4 |
| 6 | 修改 | `src/views/protocol-lab/components/ServerPanel.vue`（改用 `PtzControl` 组件，行为不变） | F4 |
| 7 | 新增 | `src/router/routes/modules/device.ts` | F5 |
| 8 | 新增 | `src/locales/langs/zh-CN/device.json` | F5 |
| 9 | 新增 | `src/locales/langs/en-US/device.json` | F5 |
| 10 | 新增（可选） | 菜单 SQL（设备管理菜单 + 按钮权限 `Device:*:*`） | F5 |

**直接 import 复用（勿重写）**：

- `src/components/MediaPlayer.vue` — 点播播放器（传 `playUrls` + `format="httpFlv"`）
- `src/composables/useSseEvents.ts` — SSE 事件流
- `src/views/protocol-lab/components/SipTimeline.vue` — 事件时间线

---

## 4. 各子任务实现细节

### 4.1 F1 — `api/device.ts`

提取协议台 `protocol-lab.ts` 中的通用设备命令（ptzControl/queryCatalog/queryDeviceInfo/rebootDevice/liveStart），新增 getPage + S2 支链。Lab 专属（labRegister/labPush\*）留在 `protocol-lab.ts`。

```typescript
import { requestClient } from '#/api/request';

export namespace DeviceApi {
  /** 设备分页筛选请求（时间 Unix 毫秒） */
  export interface DevicePageReq {
    id?: number;
    deviceId?: string;
    name?: string;
    status?: number; // 1在线/0离线
    type?: number; // 协议类型
    ip?: string;
    serverIp?: string;
    keepaliveTimeStart?: number;
    keepaliveTimeEnd?: number;
    registerTimeStart?: number;
    registerTimeEnd?: number;
  }

  export interface ExtendInfoVO {
    serialNumber?: string;
    transport?: string;
    expires?: number;
    password?: string;
    streamMode?: string;
    charset?: string;
    deviceInfo?: string;
    // S3 设备应答快照（JSON 字符串）
    deviceStatus?: string;
    ptzPosition?: string;
    presets?: string;
    config?: string;
    configDownload?: string;
    sdCardStatus?: string;
  }

  export interface DeviceVO {
    id: number;
    deviceId: string;
    name?: string;
    ip?: string;
    port?: number;
    serverIp?: string;
    status: number;
    statusName: string;
    type?: number;
    typeName?: string;
    subType?: number;
    subTypeName?: string;
    protocol?: number;
    protocolName?: string;
    createTime?: number;
    updateTime?: number;
    registerTime?: number;
    keepaliveTime?: number;
    channelCount?: number;
    extend?: string;
    extendInfo?: ExtendInfoVO;
  }

  export interface DeviceListResp {
    total: number;
    items: DeviceVO[];
  }
}

/** S1 分页条件查询：page/size 走 query，条件走 body */
export async function getDevicePage(
  params: { page: number; size: number },
  body?: DeviceApi.DevicePageReq,
) {
  return requestClient.post<DeviceApi.DeviceListResp>(
    `/api/v1/device/getPage?page=${params.page}&size=${params.size}`,
    body ?? {},
  );
}

// ============ 已存在端点（协议台同源，直接复用）============
export async function ptzControl(data: {
  deviceId: string;
  channelId?: string;
  command: string;
  speed?: number;
}) {
  return requestClient.post<boolean>('/api/v1/ptz/control', data);
}
export async function ptzStop(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/ptz/stop', { deviceId });
}
export async function queryCatalog(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/query-catalog', {
    deviceId,
  });
}
export async function queryDeviceInfo(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/query-info', {
    deviceId,
  });
}
export async function rebootDevice(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/reboot', { deviceId });
}
export async function liveStart(data: {
  deviceId: string;
  channelId: string;
  protocol?: string;
  streamMode?: string;
}) {
  return requestClient.post<any>('/api/v1/live/start', data); // 返回 LivePlayVO（含 playUrls）
}
export async function liveStop(streamId: string) {
  return requestClient.post<boolean>('/api/v1/live/stop', { streamId });
}

// ============ S2 新增支链 ============
export async function queryDeviceStatus(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/query-status', {
    deviceId,
  });
}
export async function queryPreset(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/query-preset', {
    deviceId,
  });
}
export async function queryMobilePosition(deviceId: string, interval?: string) {
  return requestClient.post<boolean>(
    '/api/v1/device-cmd/query-mobile-position',
    { deviceId, interval },
  );
}
export async function downloadConfig(deviceId: string, configType: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/config/download', {
    deviceId,
    configType,
  });
}
export async function setDeviceConfig(data: {
  deviceId: string;
  name?: string;
  expiration?: string;
  heartBeatInterval?: string;
  heartBeatCount?: string;
}) {
  return requestClient.post<boolean>('/api/v1/device-cmd/config/set', data);
}
export async function controlRecordStart(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/record/start', {
    deviceId,
  });
}
export async function controlRecordStop(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/record/stop', {
    deviceId,
  });
}
export async function queryRecord(data: {
  deviceId: string;
  startTime?: number;
  endTime?: number;
}) {
  return requestClient.post<boolean>('/api/v1/device-cmd/record', data);
}
export async function queryAlarm(data: {
  deviceId: string;
  startTime?: number;
  endTime?: number;
  startPriority?: string;
  endPriority?: string;
  alarmMethod?: string;
  alarmType?: string;
}) {
  return requestClient.post<boolean>('/api/v1/device-cmd/alarm/query', data);
}
export async function controlAlarm(data: {
  deviceId: string;
  alarmMethod?: string;
  alarmType?: string;
}) {
  return requestClient.post<boolean>('/api/v1/device-cmd/alarm/control', data);
}
export async function broadcast(deviceId: string) {
  return requestClient.post<boolean>('/api/v1/device-cmd/broadcast', {
    deviceId,
  });
}
```

> **路径前缀已确认**（2026-06-13 核对 `protocol-lab.ts`）：`requestClient` baseURL = `apiURL`（开发环境 `/api`，Vite 代理剥离首段转 `:8081`），通用命令在 api 内写**完整 `/api/v1/...` 前缀**（如 `protocol-lab.ts:253` 的 `ptzControl` 即 `/api/v1/ptz/control`）。上述 `device.ts` 全部已用同款完整前缀，与协议台一致，无 404 风险。`responseReturn:'data'` 自动解包 `AjaxResult.data`。

### 4.2 F2 — 设备列表页（`views/device/list.vue` + `data.ts`）

参考 `views/media/node/list.vue` 范式（`useVbenVxeGrid` + 查询表单 schema + 列定义）。

**`data.ts` 查询表单 schema**（筛选维度，仅 `type` 不含 subType/protocol）：

```typescript
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import { $t } from '#/locales';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'deviceId',
      label: $t('device.field.deviceId'),
    },
    { component: 'Input', fieldName: 'name', label: $t('device.field.name') },
    {
      component: 'Select',
      fieldName: 'status',
      label: $t('device.field.status'),
      componentProps: {
        options: [
          { label: $t('device.status.online'), value: 1 },
          { label: $t('device.status.offline'), value: 0 },
        ],
        allowClear: true,
      },
    },
    { component: 'Input', fieldName: 'ip', label: $t('device.field.ip') },
    // 时间范围：RangePicker 输出 [start,end]，提交前转 Unix 毫秒（见 list.vue query 适配）
    {
      component: 'RangePicker',
      fieldName: 'keepaliveTime',
      label: $t('device.field.keepaliveTime'),
    },
  ];
}

export function useColumns(onActionClick: any): VxeTableGridOptions['columns'] {
  return [
    { field: 'deviceId', title: $t('device.field.deviceId'), width: 220 },
    { field: 'name', title: $t('device.field.name'), minWidth: 140 },
    {
      field: 'statusName',
      title: $t('device.field.status'),
      width: 90,
      cellRender: {
        name: 'CellTag',
        options: [
          {
            label: $t('device.status.online'),
            value: '在线',
            color: 'success',
          },
          { label: $t('device.status.offline'), value: '离线', color: 'error' },
        ],
      },
    },
    { field: 'typeName', title: $t('device.field.type'), width: 120 },
    { field: 'ip', title: 'IP', width: 130 },
    {
      field: 'channelCount',
      title: $t('device.field.channelCount'),
      width: 90,
    },
    {
      field: 'keepaliveTime',
      title: $t('device.field.keepaliveTime'),
      width: 170,
      formatter: ({ cellValue }) =>
        cellValue ? new Date(cellValue).toLocaleString() : '-',
    },
    {
      field: 'registerTime',
      title: $t('device.field.registerTime'),
      width: 170,
      formatter: ({ cellValue }) =>
        cellValue ? new Date(cellValue).toLocaleString() : '-',
    },
    {
      title: $t('common.action'),
      width: 180,
      fixed: 'right',
      cellRender: {
        name: 'CellOperation',
        attrs: { onClick: onActionClick },
        options: [
          { code: 'detail', text: $t('device.action.detail') },
          { code: 'liveStart', text: $t('device.action.live') },
        ],
      },
    },
  ];
}
```

**`list.vue` 关键点**：

```typescript
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: false },
  gridOptions: {
    columns: useColumns(onActionClick),
    scrollX: { enabled: true }, // .cursorrules 铁律：防表头错位
    scrollY: { enabled: true },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          // RangePicker [start,end] → Unix 毫秒
          const body: DeviceApi.DevicePageReq = { ...formValues };
          if (formValues.keepaliveTime?.length === 2) {
            body.keepaliveTimeStart = +new Date(formValues.keepaliveTime[0]);
            body.keepaliveTimeEnd = +new Date(formValues.keepaliveTime[1]);
            delete (body as any).keepaliveTime;
          }
          const resp = await getDevicePage(
            { page: page.currentPage, size: page.pageSize },
            body,
          );
          return { items: resp.items, total: resp.total };
        },
      },
    },
  },
});

// SSE 实时刷新行状态（复用 useSseEvents）
const { events } = useSseEvents(() => [
  'device.online',
  'device.offline',
  'device.keepalive',
  'device.catalog',
]);
watch(events, (list) => {
  // 按 deviceId 在当前网格数据中 upsert online/keepalive/channelCount，参考 ServerPanel 第81-129行
  // gridApi.grid.updateRow / reloadData 局部刷新
});
```

> **时间格式铁律**（.cursorrules）：后端 Time 字段均 Unix 毫秒，前端 `new Date(ms).toLocaleString()` 按时区显示；筛选 RangePicker 提交前转毫秒。

### 4.3 F3 — 设备操作面板（`views/device/modules/device-detail.vue`）

用 `useVbenDrawer` 抽屉承载选中设备的操作区。复用 `PtzControl`（F4 提取）+ `MediaPlayer` + `SipTimeline`，命令按钮调 `api/device.ts`。

```vue
<template>
  <Drawer :title="$t('device.action.detail')">
    <!-- 基础信息：statusName/channelCount/keepaliveTime -->
    <!-- PTZ 方向盘（复用 F4 组件） -->
    <PtzControl
      :device-id="current.deviceId"
      :channel-id="selectedChannel"
      @command="onPtz"
    />
    <!-- 查询按钮组：查目录/查信息/查状态/查预置位/查移动位置 -->
    <!-- 配置：下载(BASIC/VIDEO/AUDIO 下拉) + 下发 -->
    <!-- 录像：开始/停止 + 查询(触发) -->
    <!-- 报警：查询 + 复位 -->
    <!-- 广播按钮 -->
    <!-- 点播：调 liveStart → 拿 playUrls → 打开 MediaPlayer -->
    <MediaPlayer
      :open="playerOpen"
      :play-urls="playerUrls"
      format="httpFlv"
      @close="playerOpen = false"
    />
    <!-- 实时事件时间线（复用 SipTimeline，过滤当前 deviceId 的 device.*） -->
    <SipTimeline :events="deviceEvents" />
  </Drawer>
</template>
```

按钮回调统一范式（权限双重防护 + 结果提示）：

```typescript
async function onQueryStatus() {
  if (!hasAccessByCodes(['Device:Cmd:Query'])) {
    message.error($t('common.noPermission'));
    return;
  }
  const ok = await queryDeviceStatus(current.deviceId);
  ok
    ? message.success($t('device.msg.cmdSent'))
    : message.error($t('device.msg.cmdFailed'));
}
```

> **点播复用红线**：详情面板点播**调 `liveStart('/live/start')` 拿 `playUrls` → 传 `MediaPlayer`（`format="httpFlv"`）**，与 ServerPanel 完全同源，不新造点播逻辑。GB 直播首选 HTTP-FLV（首帧快）。

### 4.4 F4 — 提取 `PtzControl.vue`（从 ServerPanel 抽 PTZ 方向盘）

ServerPanel 第 245-268 行的 3×3 PTZ 方向盘（8 向 + STOP + 变倍）提取为独立组件，供 ServerPanel 与设备页共用：

```typescript
// components/PtzControl.vue
interface Props {
  deviceId: string;
  channelId?: string;
  speed?: number; // 默认 128
  disabled?: boolean;
}
// emit: command(payload: { command: string; speed: number })
// 内部用 PTZ_DIRECTIONS / PTZ_ZOOM（从 protocol-lab/data.ts 迁移或共享）
// 按钮文本国际化：$t('device.ptz.<key>')（或保留 protocolLab.ptz.* 共用）
```

ServerPanel 改为 `<PtzControl :device-id="..." @command="onPtzCommand" />`，**行为不变**（协议台 ServerPanel 测试/联调不回归）。

> 提取时 PTZ 方向常量（`PTZ_DIRECTIONS`/`PTZ_ZOOM`）建议保留在公共 `data.ts`，避免两份。i18n key 可共用 `protocolLab.ptz.*` 或新建 `device.ptz.*`——二选一，文档建议**共用 protocolLab.ptz.\***减少重复。

### 4.5 F5 — 路由 + i18n + 菜单

**路由 `router/routes/modules/device.ts`**（参考 `system.ts`）：

```typescript
import type { RouteRecordRaw } from 'vue-router';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: { icon: 'mdi:cctv', order: 100, title: $t('device.menu') },
    name: 'Device',
    path: '/device',
    children: [
      {
        path: '/device/list',
        name: 'DeviceList',
        meta: { icon: 'mdi:cctv', title: $t('device.title') },
        component: () => import('#/views/device/list.vue'),
      },
    ],
  },
];
export default routes;
```

**i18n `device.json`**（zh-CN / en-US 平行，命名空间 = 文件名 `device`，引用 `device.*`）：

```json
{
  "menu": "设备管理",
  "title": "设备列表",
  "field": {
    "deviceId": "设备编号",
    "name": "名称",
    "status": "状态",
    "type": "协议类型",
    "ip": "IP",
    "channelCount": "通道数",
    "keepaliveTime": "心跳时间",
    "registerTime": "注册时间"
  },
  "status": { "online": "在线", "offline": "离线" },
  "action": {
    "detail": "详情",
    "live": "实时点播",
    "queryStatus": "查状态",
    "queryPreset": "查预置位",
    "configDownload": "下载配置",
    "configSet": "下发配置",
    "recordStart": "开始录像",
    "recordStop": "停止录像",
    "alarmQuery": "查报警",
    "alarmControl": "报警复位",
    "broadcast": "广播"
  },
  "msg": { "cmdSent": "指令已下发", "cmdFailed": "指令下发失败" }
}
```

> ⚠️ **i18n 命名空间坑（来自 1.0.6 复盘）**：`loadLocalesMapFromDir` 用**原始文件名**做命名空间且不转大小写。文件名 `device.json` → 命名空间 `device` → 引用 `device.*` 命中。**保持文件名与引用前缀一致**（本文件名 `device.json` 与 `$t('device.*')` 一致，无 1.0.6 的 camelCase 坑）。`typecheck`/`build` 不校验 i18n 运行时 key，须 `pnpm dev:antd` 实看文案。

**菜单 SQL**（可选，遵循 .cursorrules 权限编码 `Module:Entity:Action`，项目管理 ID 900-999）：设备管理菜单 + 按钮权限 `Device:Device:Query` / `Device:Cmd:Ptz` / `Device:Cmd:Live` / `Device:Cmd:Config` 等。

---

## 5. 已知缺口与依赖后端的待办（落地前必读）

| # | 缺口 | 影响 | 处置 |
| --- | --- | --- | --- |
| **G1** | **录像结果读端点缺失** | `device.recordinfo` SSE 只是通知，录像列表本体在后端 RedisCache（`device:record:result:{deviceId}:{sn}`），**后端本期未暴露 `/record/result` 读端点**（方案 §5.4 标为待实现，实际未落地）。 | 前端录像结果展示**降级**：先发 `/device-cmd/record` 触发查询 → 收到 `device.recordinfo` 通知 → **暂只提示"录像查询完成"**，列表展示待后端补读缓存端点。或推动后端先补 `GET /device-cmd/record/result?deviceId=&sn=`。 |
| **G2** | **预置位下发不支持** | 后端 `PtzController /preset` 返回"不支持"（PTZControlEnum 缺 PRESET 常量）。 | 前端**不做**预置位**下发**按钮；预置位**查询**（`/query-preset`）可做（返回快照入 `extendInfo.presets`）。 |
| **G3** | **回放 seek/倍速不支持** | 后端 `controlPlayback` 仅 L1 pause/resume。 | 前端回放控制只放暂停/继续按钮，不放进度条 seek/倍速。 |
| **G4** | **媒体方法语义** | 后端 `stopPlay` 入参是 callId 语义但实际被 PlaybackController 传 streamId（后端方案 §1.6 媒体收口本期**未做**）。 | 前端停流统一走 `/live/stop`（传 streamId），与协议台一致，不碰 `device-cmd` 媒体。 |
| **G5** | api 前缀一致性 | ✅ **已确认**：通用命令用完整 `/api/v1/...` 前缀（核对 `protocol-lab.ts`），`device.ts` 已统一同款，无 404 风险。 | 无需处置（§4.1 示例已修正为完整前缀）。 |

---

## 6. 实施顺序与质量门禁

### 6.1 推荐顺序（每步独立可验）

1. **F4**（提取 `PtzControl.vue` + 改 ServerPanel）→ 协议台页面回归自测，PTZ 行为不变
2. **F1**（`api/device.ts`）→ 类型对齐后端契约
3. **F2**（列表页）→ `pnpm dev:antd` 实测筛选/分页/SSE 刷新
4. **F3**（操作面板）→ 实测 PTZ/点播/支链端点连通
5. **F5**（路由/i18n/菜单）→ 菜单文案与跳转

### 6.2 质量门禁（与 1.0.6 同标准）

```bash
pnpm typecheck          # vue-tsc，新增文件 0 error
npx eslint <新增文件>    # 0 error / 0 warning
pnpm build:antd         # turbo 构建成功，产出 device chunk
pnpm dev:antd           # 实看 i18n 文案（typecheck/build 不校验运行时 i18n key）
```

### 6.3 验收（Definition of Done）

- [ ] F1：`api/device.ts` 全部端点类型对齐后端**已落地**契约，0 臆造字段/端点
- [ ] F2：`/device/list` 各条件筛选（含时间范围）返回正确，VxeGrid 含 channelCount/statusName 列，SSE `device.*` 增量刷新行状态
- [ ] F3：操作面板 PTZ/点播**复用既有 `/ptz`、`/live`**跑通；S2 支链端点（query-status/preset/mobile-position、config、record、alarm、broadcast）连通
- [ ] F4：`PtzControl.vue` 被 ServerPanel 与设备页共用，**协议台不回归**
- [ ] F5：路由菜单可达，zh/en 文案正确（`pnpm dev:antd` 实看）
- [ ] 门禁 `pnpm check` 全绿；严格对齐后端契约，新增字段先登记 `.cursor/rules/project-rule.mdc`
- [ ] G1（录像结果）按降级方案处理或推动后端补读端点

---

## 7. 复用关系总览（一图胜千言）

```
                        ┌─────────────────── 直接 import 复用（勿改）──────────────────┐
                        │ MediaPlayer.vue   useSseEvents.ts   SipTimeline.vue           │
                        └──────────────────────────────────────────────────────────────┘
                                          ▲              ▲              ▲
协议台 ServerPanel ──┐                     │              │              │
                    ├── 共用 ── PtzControl.vue（F4 从 ServerPanel 提取）  │
设备管理页 ──────────┘                                     │              │
   │                                                      │              │
   ├── 列表筛选/分页 ── api/device.ts:getDevicePage ──► POST /device/getPage（S1 新端点）
   ├── 实时刷新 ─────── useSseEvents(device.*) ◄──────── SSE（S1/S3 推送）
   ├── PTZ/点播/回放 ── api/device.ts（复用）─────────► /ptz /live /playback（协议台已验证，勿重建）
   └── 支链命令 ─────── api/device.ts（S2 新增）───────► /device-cmd/{query-status,preset,...}（S2 已落地）
```

> **一句话**：前端不重写任何已跑通的下发/点播链路，只新增"设备列表页 + api/device.ts + 支链按钮 + 提取 PtzControl"，最大化复用协议验证台沉淀的播放器/SSE/时间线/PTZ。
