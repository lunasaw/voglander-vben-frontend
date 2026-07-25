# 图像资产与图像采集 UI 技术方案

> 版本：1.0.9
>
> 日期：2026-07-22
>
> 状态：UI 设计确认版，待进入实施计划
>
> 前端基线：Vue 3 + Vben Admin 5.x + Ant Design Vue
>
> 适用页面：`/image/assets`、`/image/assets/:assetId`、`/image/collection`

---

## 0. 结论

本方案采用“两个独立菜单页面 + 一套 Vben/Ant Design 页面语言”的设计：

- 保持“图像资产”和“图像采集”两个独立页面，不合并成页签，也不新增独立“上传图像”菜单。
- “上传图像”是图像资产页的主操作；资产页同时承担查询、预览、下载和生命周期管理。
- 页面容器、查询、列表、抽屉、表单与反馈优先复用现有 Vben/Ant Design 组件。
- 统一的是页面结构、信息层级、状态语义和交互协议，不创建新的全局 UI 框架或独立视觉皮肤。
- 完全兼容现有图像资产、图像采集和 Durable Business Task API，不修改接口路径、字段与语义。
- 第一阶段聚焦 UI 重构；后端新能力、全局通用页面引擎和无关模块重构不在范围内。

主要使用者为设备/视频运维人员。设计优先级依次为：状态辨识、异常恢复、机位定位、任务跟踪、图像识别效率。

---

## 1. 现状与问题

### 1.1 当前代码位置

| 领域 | 当前文件 |
| --- | --- |
| 图像资产页面 | `src/views/image/assets/list.vue` |
| 图像采集页面 | `src/views/image/collection/list.vue` |
| 资产页面工具 | `src/views/image/assets/data.ts` |
| 采集页面工具 | `src/views/image/collection/data.ts` |
| 图像 API | `src/api/image/api.ts` |
| 图像类型 | `src/api/image/types.ts` |
| 图像路由 | `src/router/routes/modules/image.ts` |
| 图像国际化 | `src/locales/langs/{zh-CN,en-US}/image.json` |
| 任务详情组件 | `src/views/task/center/TaskDetailDrawer.vue` |
| 任务进度组件 | `src/views/task/center/TaskProgress.vue` |
| 执行历史组件 | `src/views/task/center/TaskExecutionHistory.vue` |

### 1.2 主要问题

1. 两个页面均由约 500 行的单文件组件同时承担数据编排、权限、状态机、表单、列表和详情，UI 职责过重。
2. 资产页同时展示宫格和表格，信息重复，首屏纵向长度过大。
3. 当前查询使用手写 Ant Design Form，与仓库主流 `useVbenForm` / `useVbenVxeGrid` 页面范式不一致。
4. 上传使用普通文件按钮，未利用已有 constraints 接口进行格式、大小与像素的即时说明。
5. 采集时间仍以 Unix 毫秒数字输入，不符合运维人员的操作习惯。
6. 采集行操作横向铺开，状态多时造成操作区拥挤。
7. 采集详情只展示少量文本，没有充分复用已有任务进度、执行历史和事件时间线。
8. 加载失败、预览失败、空结果、权限不足等状态的视觉与恢复入口不统一。
9. 当前创建任务在未知结果后重新提交会生成新幂等键，与提示的“安全确认或重试”语义不一致。

---

## 2. 设计原则

### 2.1 Vben 原生优先

- 页面容器使用 `Page`。
- 标准数据列表使用 `useVbenVxeGrid`。
- 结构化查询和编辑表单使用 `useVbenForm`。
- 上传、创建、调整计划和详情使用 `useVbenDrawer`。
- 图像、状态、进度和反馈使用 Ant Design Vue 组件。
- 图标统一来自 `@vben/icons`，不引入第二套图标源。

### 2.2 主题兼容优先

- 不硬编码主色、背景色和暗色模式颜色。
- 自定义样式仅使用 Vben CSS 变量或 Ant Design token，例如 `--background`、`--card`、`--border`、`--foreground`、`--muted-foreground`、`--primary`、`--success` 和 `--destructive`。
- 不引入页面专属字体；字体、字号基线与现有管理端保持一致。
- 圆角使用项目 `--radius`；阴影保持轻量，不覆盖 Ant Design 的层级语义。
- 动效只用于加载、抽屉和必要的状态提示，并遵守 `prefers-reduced-motion`。

### 2.3 业务事实优先

- REST 查询结果是页面数据的权威来源，SSE 只负责触发刷新。
- 后端 `capabilities` 是任务操作能力的权威来源，前端状态判断只用于显示保护。
- 不使用当前分页行计算“全量任务统计”。现有采集 API 没有领域统计接口，因此采集页不展示伪统计卡。
- 客户端校验用于即时反馈，服务端校验仍是最终结果。

### 2.4 适度复用

- 共享页面结构和状态规则，不提前抽象万能工作台。
- 资产的宫格浏览与采集的任务表格保持领域差异。
- 可复用现有任务组件，避免在图像域重复实现进度与执行历史。

---

## 3. 统一页面骨架

两个页面遵循同一纵向结构：

```text
Page
├── Page Header
│   ├── 标题与说明
│   └── 实时状态/主操作
├── Context Area（按领域可选）
│   └── 资产统计卡；采集页不伪造统计
├── Query Area
│   └── Vben Form 或 Vben Grid Form
├── Data Toolbar
│   ├── 总数/上下文筛选 Tag
│   └── 视图切换/刷新/列设置
├── Data Surface
│   ├── 资产宫格或资产 VXE Grid
│   └── 采集任务 VXE Grid
└── Vben Drawer
    ├── 上传/创建/调整计划
    └── 资产详情/任务详情
```

### 3.1 统一间距

| 场景 | 约定 |
| --- | --- |
| 页面主要区块间距 | 16px |
| 卡片网格间距 | 12px 或 16px |
| 抽屉分区间距 | 20px |
| 表单字段横向间距 | 16px |
| 文字与辅助信息间距 | 4px 或 8px |
| 页面左右内边距 | 由 `Page` 统一提供，不重复叠加 |

### 3.2 统一操作层级

| 层级 | 表现 | 示例 |
| --- | --- | --- |
| 页面主操作 | `Button type="primary"` | 上传图像、新建采集 |
| 行稳定操作 | `Button type="link"` | 详情 |
| 行次级操作 | `Dropdown` | 下载、暂停、恢复、调整计划、重试 |
| 危险操作 | danger + 二次确认 | 删除、取消 |
| 页面辅助操作 | 默认 Button/Icon Button | 刷新、重置、视图切换 |

主操作每页最多一个，避免多个主色按钮争夺注意力。

---

## 4. 图像资产页面 UI

### 4.1 页面线框

```text
┌─────────────────────────────────────────────────────────────────┐
│ 图像资产  统一管理上传与机位采集生成的图像        [上传图像]  │
├────────────┬────────────┬────────────┬────────────┤
│ 资产总数   │ 可用资产   │ 今日新增   │ 删除失败   │
├─────────────────────────────────────────────────────────────────┤
│ 名称  状态  来源  设备 ID  通道 ID                 [重置][查询] │
│ [更多筛选]                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 共 N 项  [设备/通道筛选 Tag]       [宫格|列表] [刷新]          │
├─────────────────────────────────────────────────────────────────┤
│ 宫格：Card + Image + Tag + Dropdown                            │
│ 或                                                             │
│ 列表：VbenVxeGrid                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 页面头部

- 标题：图像资产。
- 说明：统一管理上传与机位采集生成的图像。
- 主操作：上传图像。
- 主操作仅在拥有 `Image:Asset:Upload` 权限时显示。

### 4.3 统计区

使用四个 `Card size="small"` 和 `Statistic`，数据来自 `GET /api/v1/images/statistics`。

| 卡片 | 字段 | 快捷筛选 |
| --- | --- | --- |
| 资产总数 | `total` | 清除状态与日期快捷筛选 |
| 可用资产 | `available` | `status=AVAILABLE` |
| 今日新增 | `today` | 只展示；现有分页查询没有入库时间筛选字段 |
| 删除失败 | `deleteFailed` | `status=DELETE_FAILED` |

交互规则：

- 具有快捷筛选行为的卡片可通过鼠标和键盘激活；“今日新增”不伪装成可点击元素。
- 当前激活的快捷筛选卡片使用主题主色边框，不使用独立品牌色。
- 删除失败为 0 时使用普通前景色；大于 0 时使用 Ant Design error 语义色。
- 点击统计卡后查询页码回到 1。

### 4.4 查询区

资产包含宫格和列表两个数据表面，因此查询使用独立 `useVbenForm`，而不是绑定在 VXE Grid 内部。

默认字段：

| 字段 | 组件 | 请求字段 |
| --- | --- | --- |
| 资产名称 | Input | `assetName` |
| 状态 | Select | `status` |
| 来源 | Select | `sourceType` |
| 设备 ID | Input | `deviceId` |
| 通道 ID | Input | `channelId` |

展开字段：

| 字段 | 组件 | 请求字段 |
| --- | --- | --- |
| 资产 ID | Input | `assetId`；同步到 URL 时使用 `filterAssetId` |
| 来源任务 ID | Input | `sourceTaskId` |
| 采集时间 | RangePicker show-time | `capturedStart` / `capturedEnd` |

查询协议：

- 点击查询后请求第 1 页。
- 重置优先恢复路由携带的 `deviceId/channelId` 上下文，不直接清空深链来源。
- 上下文筛选使用可关闭 Tag 展示；用户主动关闭后同步移除路由参数。
- 日期组件值只存在于 UI 层，请求前转换为 Unix 毫秒。
- `assetId` query 保留给兼容详情深链；列表中的资产 ID 筛选使用 `filterAssetId` query，并在请求体中映射为 `assetId`。

### 4.5 视图工具栏

- 左侧显示当前结果总数和路由上下文 Tag。
- 右侧使用 `Segmented` 切换“宫格 / 列表”，并提供刷新按钮。
- 默认视图为宫格。
- 视图偏好保存为本地 UI 状态，不写入业务 URL；建议 key 为 `voglander:image-assets:view`。
- 切换视图不重新请求数据，不重置页码与筛选。

### 4.6 宫格视图

使用 CSS Grid 组合 Ant Design `Card`、`Image`、`Tag` 和 `Dropdown`。

| 断点 | 列数 |
| --- | --- |
| `>= 1536px` | 6 |
| `>= 1024px` | 4 |
| `>= 768px` | 3 |
| `< 768px` | 2 |

卡片规则：

- 卡片最小可用宽度约 180px；过窄时通过响应式列数保护内容。
- 缩略图使用 4:3 固定容器和 `object-fit: cover`。
- 信息顺序为名称、格式/大小、来源、状态。
- 名称单行省略，完整名称通过 Tooltip 和 `aria-label` 提供。
- 点击缩略图打开资产详情抽屉；关闭 Ant Design Image 自带 preview，避免双层预览。
- 下载、删除和重试删除进入 Dropdown，不在每张卡片上常驻多个按钮。

状态表现：

| 状态 | 表现 |
| --- | --- |
| AVAILABLE | 正常缩略图和 success Tag |
| DELETING | 缩略图遮罩、局部 Spin、processing Tag |
| DELETE_FAILED | error Tag 和错误状态边线 |
| DELETED | 默认不请求内容流，显示占位图和 default Tag |

### 4.7 列表视图

使用 `useVbenVxeGrid`，关闭内部查询表单，查询数据由资产页面控制器传入。

| 列 | 内容 |
| --- | --- |
| 图像 | 56×42 缩略图；加载失败显示占位 |
| 名称 | 资产名称；次级文本显示资产 ID |
| 来源 | 来源类型 Tag；采集来源附机位信息 |
| 规格 | `宽 × 高` 和图像格式 |
| 文件大小 | 统一 B/KB/MB/GB 格式 |
| 采集时间 | 本地日期时间 |
| 状态 | 统一状态 Tag |
| 操作 | 详情 + Dropdown |

列表保留 VXE Grid 的刷新、列设置、全屏、横向滚动和分页能力，不在 Grid 外再渲染一套分页。

### 4.8 上传图像抽屉

使用 `useVbenDrawer`，建议宽度 `w-full max-w-[560px]`。

```text
┌────────────────────────────────────┐
│ 上传图像                           │
│ ┌────────────────────────────────┐ │
│ │ Upload.Dragger                 │ │
│ │ 拖拽或选择 JPEG/PNG/WEBP       │ │
│ └────────────────────────────────┘ │
│ 本地缩略图 / 文件名 / 格式 / 大小  │
│ 资产名称 [______________________]  │
│ Alert：格式、大小、像素约束         │
│                         取消  上传  │
└────────────────────────────────────┘
```

组件与行为：

- `Upload.Dragger` 设置单文件、禁止自动上传。
- 打开抽屉时请求 `GET /api/v1/images/constraints`。
- 选择文件后使用浏览器读取格式、字节数和像素尺寸，立即完成客户端校验。
- 资产名称默认取去除扩展名的原文件名，允许修改。
- Drawer footer 统一承载取消和确认操作，不在表单内容中重复按钮。
- 上传期间锁定抽屉关闭和确认按钮。
- 成功后关闭抽屉、刷新统计和当前查询，并使用 `message.success`。
- 关闭或更换文件时释放本地 Object URL。

幂等规则：

1. 文件或资产名称变化时生成新的 `Idempotency-Key`。
2. 网络结果未知且请求内容不变时保留原 key、文件与名称。
3. 未知结果后的确认按钮文案改为“重试上传”。
4. 服务端明确拒绝后允许修改内容，修改后视为新请求。

### 4.9 资产详情抽屉

使用 `useVbenDrawer`，建议宽度 `w-full max-w-[720px]`。

内容顺序：

1. 完整比例图像预览。
2. `Descriptions bordered size="small"` 展示名称、格式、尺寸、大小、状态、来源、设备/通道、采集时间和入库时间。
3. 资产 ID、来源任务 ID、来源执行 ID 提供复制操作。
4. Drawer footer 展示下载、删除或重试删除。

深链协议：

- `/image/assets/:assetId` 和 `/image/assets?assetId=...` 均可打开详情。
- 关闭 query 深链详情时移除 `assetId`，保留其他筛选参数。
- 关闭 path 深链详情时回到 `/image/assets`，并保留可恢复的 query。
- 预览失败显示 `Empty + 重试`，不暴露破损图片图标。

---

## 5. 图像采集页面 UI

### 5.1 页面线框

```text
┌─────────────────────────────────────────────────────────────────┐
│ 图像采集  创建、调度并跟踪机位图像采集任务  ●实时 [新建采集] │
├─────────────────────────────────────────────────────────────────┤
│ 名称  状态  模式  设备 ID  通道 ID                 [重置][查询] │
├─────────────────────────────────────────────────────────────────┤
│ 任务 │ 机位 │ 模式 │ 状态 │ 进度 │ 调度 │ 结果 │ 详情/更多   │
├─────────────────────────────────────────────────────────────────┤
│ VbenVxeGrid Pagination / Refresh / Columns / Zoom               │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 页面头部

- 标题：图像采集。
- 说明：创建、调度并跟踪机位图像采集任务。
- 实时连接状态使用 `Badge`：实时同步、正在重连、定时刷新。
- 主操作为“新建采集”，受 `Image:Collection:Create` 权限控制。
- 不展示采集统计卡，避免将当前页数据误解为全量统计。

### 5.3 查询与列表

采集只有一种列表数据表面，使用 `useVbenVxeGrid` 的内置查询表单。

查询字段：

| 字段 | 组件 | 请求字段 |
| --- | --- | --- |
| 任务名称 | Input | `taskName` |
| 状态 | Select | `state` |
| 模式 | Select | `collectionMode` |
| 设备 ID | Input | `deviceId` |
| 通道 ID | Input | `channelId` |

Grid 约定：

- `submitOnChange=false`，由用户主动查询。
- `rowConfig.keyField=taskId`。
- 开启横向和纵向滚动。
- 保留刷新、列设置、搜索折叠和全屏能力。
- 从设备通道页进入时回填设备/通道上下文，并显示可关闭 Tag。

列定义：

| 列 | 内容 |
| --- | --- |
| 任务 | 任务名称；次级文本显示可复制 taskId |
| 机位 | 设备/通道名称；次级文本显示 ID |
| 模式 | 单次或定时 Tag |
| 状态 | 统一语义 Tag |
| 进度 | 复用 `TaskProgress` |
| 调度 | 计划时间、下一执行时间或采集间隔 |
| 结果 | `resultRefId` 存在时显示“查看图像” |
| 操作 | 详情 + Dropdown 更多操作 |

状态表现：

| 状态 | Ant Design 语义 |
| --- | --- |
| SCHEDULED | processing |
| RUNNING | processing，保留运行状态点 |
| PAUSED | warning |
| COMPLETED | success |
| FAILED | error |
| CANCELLED | default |

### 5.4 行操作协议

- “详情”始终作为稳定首操作。
- 暂停、恢复、调整计划、人工重试和取消放入 Dropdown。
- Dropdown 项由后端 `capabilities`、任务状态和权限共同决定。
- `Image:Collection:Control` 与 `Task:Control` 均满足后才展示控制操作。
- 取消使用 danger 语义并通过 `Modal.confirm` 二次确认。
- 操作 loading 只锁定当前行；其他任务仍可查看和操作。
- 版本冲突时提示“任务状态已变化”，随后刷新权威数据。

### 5.5 新建采集抽屉

使用 `useVbenDrawer + useVbenForm`，建议宽度 `w-full max-w-[640px]`。

```text
┌──────────────────────────────────────────┐
│ 新建图像采集                             │
│ 基本信息                                 │
│   任务名称 / 单次采集或定时采集           │
│ 采集机位                                 │
│   设备 / 通道 / 在线状态                  │
│ 调度设置（仅定时）                       │
│   日期时间范围 / 间隔秒数                 │
│ Alert：预计次数、开始、结束、间隔          │
│                               取消  创建  │
└──────────────────────────────────────────┘
```

基本信息：

- 任务名称使用 Input。
- 采集模式使用按钮式 RadioGroup，选项为单次采集和定时采集。
- retention policy 仅在 constraints 返回可选项时展示 Select。

采集机位：

- 设备和通道均使用可搜索 Select。
- 设备变化时清空通道并加载新通道选项。
- 下拉项同时展示 ID、名称和在线状态，不只使用颜色表达状态。
- 通道加载失败只影响机位分区，不关闭抽屉。
- 离线通道遵循当前规则不可选择。
- 路由携带的设备/通道自动预填，但用户可以修改。

调度设置：

- 单次采集隐藏日期时间和间隔字段。
- 定时采集使用 `DatePicker.RangePicker show-time`，不展示 Unix 毫秒输入框。
- 间隔使用 InputNumber，单位明确为秒。
- `minIntervalSeconds` 和 `maxPlannedCount` 来自现有 constraints。
- 使用 `floor((end-start)/(interval*1000))+1` 计算包含首尾计划点的预计次数。
- Alert 显示开始时间、结束时间、间隔和预计次数。

创建幂等规则与上传一致：表单业务内容不变且结果未知时复用原 key；用户修改业务内容后生成新 key。

### 5.6 调整计划抽屉

调整计划复用新建采集的调度字段与校验规则。

- 仅 `PAUSED` 且 `capabilities` 包含 `RESCHEDULE` 时可用。
- 任务名称、设备和通道只读。
- 可修改开始时间、结束时间、间隔和原因。
- 请求携带 `expectedVersion`。
- 版本冲突后保留输入并刷新任务状态，由用户决定是否再次提交。

### 5.7 任务详情抽屉

建议将已有任务详情内容接入 `useVbenDrawer`，宽度 `w-full max-w-[760px]`，并复用：

- `TaskProgress`
- `TaskExecutionHistory`
- Business Task 查询和控制 API

详情顺序：

1. 任务名称、状态 Tag、模式 Tag、可复制任务 ID。
2. 当前可执行的任务控制操作。
3. 任务进度。
4. 设备与通道信息。
5. 调度起止、间隔和下一执行时间。
6. 计划、成功、失败、错过等执行计数。
7. 结果摘要和“查看图像资产”链接。
8. 执行记录及事件时间线。

SSE 触发当前任务刷新时保留抽屉、焦点和滚动位置。

---

## 6. 组件映射

| UI 能力 | 选用组件 | 说明 |
| --- | --- | --- |
| 页面容器 | `Page` | 统一内容高度与页面 header |
| 资产查询 | `useVbenForm` | 同时驱动宫格与列表 |
| 采集查询/列表 | `useVbenVxeGrid` | 对齐任务中心与设备列表 |
| 资产列表 | `useVbenVxeGrid` | 关闭内部 form |
| 上传/创建/详情 | `useVbenDrawer` | 统一 footer、loading 和关闭协议 |
| 结构化表单 | `useVbenForm` | schema、校验和响应式布局 |
| 资产统计 | `Card + Statistic` | 只展示后端权威统计 |
| 文件上传 | `Upload.Dragger` | 单文件、手动提交 |
| 图像显示 | `Image` | 宫格缩略图和详情预览 |
| 状态 | `Tag` / `Badge` | 文本与颜色共同表达 |
| 任务进度 | `TaskProgress` / `Progress` | 复用任务中心组件 |
| 行更多操作 | `Dropdown` | 收敛次级操作 |
| 属性详情 | `Descriptions` | 统一字段展示 |
| 时间输入 | `DatePicker.RangePicker` | UI 日期转 Unix 毫秒 |
| 数值输入 | `InputNumber` | 采集间隔 |
| 空/错/无权限 | `Empty` / `Alert` / `Result` | 统一页面状态 |
| 反馈确认 | `message` / `Modal.confirm` | 对齐现有系统交互 |

禁止事项：

- 不新增第三方 UI 组件库。
- 不复制 Vben Grid、Drawer、Form 的已有能力。
- 不使用硬编码紫色渐变、独立暗色背景或与系统无关的装饰字体。
- 不在两个页面上复制同一套状态映射和时间格式函数。

---

## 7. 前端结构建议

目标是拆分页面职责，同时避免通用组件过度设计。

```text
src/views/image/
├── shared/
│   ├── image-presentation.ts       # 状态颜色、格式、时间与字节展示
│   └── image-permissions.ts        # 图像域权限组合判断
├── assets/
│   ├── list.vue                    # 路由页面与数据编排
│   ├── data.ts                     # 查询/列 schema 与纯函数
│   └── components/
│       ├── AssetStatistics.vue
│       ├── AssetGallery.vue
│       ├── AssetUploadDrawer.vue
│       └── AssetDetailDrawer.vue
└── collection/
    ├── list.vue                    # 路由页面与 Grid 编排
    ├── data.ts                     # 查询/列 schema 与纯函数
    └── components/
        ├── CollectionCreateDrawer.vue
        ├── CollectionScheduleFields.vue
        ├── CollectionRescheduleDrawer.vue
        └── CollectionDetailDrawer.vue
```

职责边界：

- 路由页面负责查询状态、分页、SSE 刷新和打开抽屉。
- `data.ts` 只包含 schema、列定义、状态判断和可单测纯函数。
- Drawer 组件负责自身表单、校验、幂等提交与成功事件。
- 展示组件不直接发起列表请求。
- API 层保持现有领域边界，不将 UI 状态写入 API 类型。

`useImagePreview` 应作为资产缩略图受控加载的唯一入口，负责并发限制、错误重试和 Object URL 回收；列表和宫格不各自实现 Blob 生命周期。

---

## 8. 路由与 URL 协议

### 8.1 路由保持不变

| 路由 | 用途 |
| --- | --- |
| `/image/assets` | 图像资产主页面 |
| `/image/assets/:assetId` | 资产详情深链 |
| `/image/collection` | 图像采集主页面 |
| `/image/collections` | 兼容旧地址的隐藏别名 |

### 8.2 资产 query

允许使用以下稳定 query：

- `assetId`：兼容详情深链，不作为列表过滤条件
- `filterAssetId`：列表过滤，映射到 API 请求体的 `assetId`
- `deviceId`
- `channelId`
- `assetName`
- `status`
- `sourceType`
- `sourceTaskId`
- `capturedStart`
- `capturedEnd`

纯 UI 状态（宫格/列表、抽屉 tab、列宽）不进入 query。

### 8.3 采集 query

允许使用以下稳定 query：

- `deviceId`
- `channelId`
- `taskName`
- `state`
- `collectionMode`

路由 query 解析必须过滤非字符串和非法枚举，不能直接断言为 API 请求类型。

---

## 9. API 契约

本方案不修改现有接口。

### 9.1 图像资产

| 方法 | 路径 | UI 用途 |
| --- | --- | --- |
| GET | `/api/v1/images/constraints` | 上传格式、字节和像素约束 |
| GET | `/api/v1/images/statistics` | 四张统计卡 |
| POST | `/api/v1/images/getPage?page={page}&size={size}` | 宫格和列表分页 |
| GET | `/api/v1/images/{assetId}` | 详情权威数据 |
| POST | `/api/v1/images/uploads` | multipart 上传，携带幂等键 |
| GET | `/api/v1/images/{assetId}/content` | 私有预览流 |
| GET | `/api/v1/images/{assetId}/download` | 私有下载流 |
| DELETE | `/api/v1/images/{assetId}` | 删除 |
| POST | `/api/v1/images/{assetId}/delete:retry` | 重试删除失败资产 |

### 9.2 图像采集

| 方法 | 路径 | UI 用途 |
| --- | --- | --- |
| GET | `/api/v1/image-collection-tasks/constraints` | 模式、间隔、计划数和保留策略约束 |
| POST | `/api/v1/image-collection-tasks` | 创建任务，携带幂等键 |
| POST | `/api/v1/image-collection-tasks/getPage?page={page}&size={size}` | 采集任务分页 |
| GET | `/api/v1/image-collection-tasks/{taskId}` | 采集 enriched 详情 |
| POST | `/api/v1/image-collection-tasks/{taskId}:reschedule` | 暂停任务调整计划 |

### 9.3 Durable Business Task

暂停、恢复、取消、人工重试、任务详情、执行历史和事件时间线继续使用现有 Business Task API。图像模块不新增重复控制端点。

### 9.4 时间与分页

- UI 使用日期时间组件；API 继续使用 Unix 毫秒 `number`。
- 分页继续使用 `POST .../getPage`，`page/size` 位于 query，过滤条件位于 body。
- 分页响应继续使用 `{ total, items }`。
- 资产页宫格和列表共享同一份分页数据。

---

## 10. SSE 与数据刷新协议

### 10.1 资产页

监听：

- `image.asset.created`
- `image.asset.deleting`
- `image.asset.deleted`

事件只触发 250ms 去抖后的列表与统计刷新，不直接将 SSE payload 合并进资产对象。

### 10.2 采集页

监听：

- `image.asset.created`
- `image.asset.deleted`
- `business.task.state`
- `business.task.progress`
- `business.task.execution-state`

列表刷新采用 300ms 去抖。详情抽屉打开时，如果事件对应当前 taskId，则刷新任务详情与必要的执行数据；不得重建抽屉或重置滚动位置。

### 10.3 连接恢复

- SSE 从 error 恢复为 open 时执行一次权威刷新。
- SSE 断开不禁用查询、上传、创建和控制操作。
- 采集页 SSE 断开后仅在页面可见时启用 30 秒兜底刷新；连接恢复后立即停止兜底计时器。
- 连接状态仅在采集页头部以 Badge 展示，不使用高频 toast。

---

## 11. 权限协议

| 能力 | 权限码 | UI 规则 |
| --- | --- | --- |
| 查询资产 | `Image:Asset:Query` | 无权限显示 403 状态 |
| 查看资产 | `Image:Asset:View` | 隐藏详情入口并阻止深链加载 |
| 上传资产 | `Image:Asset:Upload` | 隐藏上传主按钮 |
| 删除资产 | `Image:Asset:Delete` | 隐藏删除与重试删除 |
| 查询采集 | `Image:Collection:Query` | 无权限显示 403 状态 |
| 新建采集 | `Image:Collection:Create` | 隐藏新建主按钮 |
| 图像域控制 | `Image:Collection:Control` | 与 Task 权限组合判断 |
| 通用任务控制 | `Task:Control` | 与图像域控制权限组合判断 |

权限必须在 UI 可见性和操作函数入口执行双重检查。隐藏按钮不是安全边界，后端仍负责最终鉴权。

---

## 12. 状态、错误与幂等协议

### 12.1 页面状态

| 状态 | 资产页 | 采集页 |
| --- | --- | --- |
| 首次加载 | 统计和宫格 Skeleton | VXE Grid loading |
| 查询刷新 | 保留结果，局部 loading | 保留行，Grid loading |
| 无数据 | Empty + 有权限时主操作 | Empty + 有权限时新建采集 |
| 无匹配结果 | Empty + 清除筛选 | Empty + 清除筛选 |
| 请求失败 | Alert + 重新加载 | Alert + 重新加载 |
| 无权限 | Result 403 | Result 403 |
| 预览失败 | 占位 + 重试 | 不适用 |

### 12.2 幂等提交状态机

```text
IDLE
  -> VALIDATING
  -> SUBMITTING(key, fingerprint)
       -> SUCCESS：关闭抽屉并刷新
       -> KNOWN_FAILURE：展示原因；内容变化后生成新 key
       -> UNKNOWN_RESULT：保留 key、fingerprint 和表单，允许安全重试
```

`fingerprint` 表示本次业务输入的稳定摘要，仅用于判断用户是否改变请求内容，不发送给后端。

### 12.3 危险操作

- 删除资产与取消任务均需二次确认。
- 提示文案必须包含操作对象名称或 ID。
- 请求成功后刷新权威数据；不只在本地移除行。
- 删除失败保留资产并展示 `DELETE_FAILED`，允许从详情或更多菜单重试。

---

## 13. 响应式、可访问性与国际化

### 13.1 响应式

- 主要使用场景按 `>=1024px` 桌面运维工作台优化。
- `<768px` 时 Page header 换行，查询表单单列，Drawer 占满屏宽。
- 表格通过横向滚动保护字段可读性，不把全部列压缩到手机宽度。
- 手机端可隐藏次级 ID 文本，但状态、进度和主要操作必须保留。
- 资产宫格在手机保持两列；极窄宽度可降为单列。

### 13.2 可访问性

- 所有可点击卡片使用语义化 button 或提供等价键盘事件与焦点样式。
- 状态同时使用颜色、文字或图标，不只使用颜色。
- 图像必须提供资产名称或资产 ID 作为 alt。
- 图标按钮必须提供 Tooltip 和可访问名称。
- 操作点击区域至少 40px，关键移动操作目标建议 44px。
- Drawer 关闭后将焦点返回触发按钮。
- Progress 提供 `role=progressbar` 和相应 aria 值。

### 13.3 国际化

- 所有新文案进入 `zh-CN/image.json` 与 `en-US/image.json`。
- 文案 key 按 `image.assets.*`、`image.collections.*` 和 `image.common.*` 分类。
- 不在 schema、列定义和确认框中硬编码中文。
- 日期显示使用当前 locale；API 仍传 Unix 毫秒。

---

## 14. 测试与验收

### 14.1 单元测试

- route query 的合法解析与序列化。
- 统计卡到筛选条件的映射。
- 资产状态到 Tag 和操作能力的映射。
- 文件大小、图像格式、日期时间展示。
- 上传 constraints 校验：类型、大小、像素。
- 上传和创建未知结果时幂等键复用。
- 表单内容变化后幂等键更新。
- 定时采集计划点计算与最大计划数校验。
- capabilities + 双权限组合后的任务操作集合。
- path/query 深链打开与关闭详情。

### 14.2 组件测试

- 资产宫格和列表切换不触发额外查询、不丢失页码。
- 资产空状态、预览失败与删除失败可恢复。
- 上传抽屉文件选择、校验、提交、未知结果重试和 URL 回收。
- 采集抽屉设备/通道级联和定时字段显隐。
- 采集详情复用任务进度与执行历史。
- SSE 高频事件被去抖，恢复连接后只执行一次权威刷新。
- 无权限时按钮不可见且方法入口仍拒绝操作。

### 14.3 E2E 验收路径

1. 上传 JPEG/PNG/WEBP，成功后统计和宫格更新。
2. 上传超限文件，在发请求前得到明确提示。
3. 模拟上传未知结果，使用同一幂等键安全重试。
4. 从设备通道页进入资产页，自动应用机位筛选。
5. 通过资产深链打开详情，关闭后保留筛选上下文。
6. 创建单次采集任务并在列表看到状态更新。
7. 创建定时采集任务，计划摘要与服务端结果一致。
8. 暂停任务、调整计划、恢复任务。
9. 失败任务执行人工重试，并查看新执行历史。
10. 从采集结果跳转到对应图像资产详情。

### 14.4 视觉验收

- 两页 Page header、查询区、工具栏、抽屉 footer 和反馈方式一致。
- 组件外观与设备、任务中心、级联管理等 Vben 页面无割裂感。
- 明暗主题下无硬编码背景、低对比文本或不可辨识状态。
- 1366px 桌面、1920px 宽屏、768px 平板和 375px 手机均无内容覆盖。
- 资产宫格图片不导致布局跳动；采集表格操作区不出现多按钮挤压。

### 14.5 工程验证

实施阶段至少执行：

```bash
pnpm --filter @vben/web-antd run typecheck
pnpm test:unit
pnpm build:antd
```

如仓库脚本名称发生变化，以 `apps/web-antd/package.json` 和根目录 `package.json` 的实际脚本为准。

---

## 15. 实施边界与顺序

### 15.1 纳入第一阶段

- 两页 UI 结构与组件统一。
- 资产宫格/列表切换。
- Vben Form、Grid、Drawer 的落位。
- 上传文件约束与本地预览。
- 日期时间输入替换 Unix 毫秒输入。
- 任务详情、进度、执行历史复用。
- 状态、错误、权限、SSE 和幂等协议统一。
- 响应式、暗色主题、国际化和可访问性完善。

### 15.2 不纳入第一阶段

- 修改现有后端接口或数据库。
- 新增采集领域统计接口。
- 批量上传、批量删除或批量创建采集任务。
- 新增独立“上传图像”菜单或合并两个页面。
- 建设跨领域配置化页面引擎。
- 重构任务中心、设备管理或级联管理的非相关 UI。

### 15.3 建议实施顺序

1. 建立共享展示规则、状态映射和组件测试基线。
2. 拆分并改造图像资产页、上传抽屉和详情抽屉。
3. 拆分并改造图像采集 Grid、创建抽屉和调整计划抽屉。
4. 接入任务详情、进度和执行历史。
5. 补齐 SSE、幂等、路由深链和异常状态。
6. 完成响应式、主题、国际化、可访问性和 E2E 验收。

---

## 16. 验收结论

本方案完成后应满足以下结果：

- 用户仍通过“图像资产”和“图像采集”两个明确入口完成工作。
- 上传图像是资产页的主操作，而不是新的页面或菜单。
- 页面使用现有 Vben/Ant Design 组件和主题语言，视觉统一但保留图像领域特征。
- 资产浏览不再同时重复显示宫格和表格。
- 采集任务的状态、进度、调度、结果与可执行操作能够在一个标准列表中快速识别。
- 上传、创建、控制、删除和实时刷新在异常情况下均有明确恢复路径。
- 所有 UI 改造兼容现有 API，可在不依赖后端改造的情况下实施。

本文档是 1.0.9 UI 实施计划的设计输入。用户确认本文档后，再拆分具体代码任务与验证步骤。
