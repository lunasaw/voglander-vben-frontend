# 图像资产与图像采集 UI 技术方案

> 版本：1.0.9（可行性审核修订版）
>
> 日期：2026-07-22
>
> 状态：技术可行性审核确认版，待拆分实施计划
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
- 保持现有图像资产、图像采集和 Durable Business Task API 的路径与业务语义；第一阶段增加一个受控缩略图端点，并固定采集来源元数据字段，不修改数据库结构。
- 第一阶段以 UI 重构为主，同时完成私有二进制传输、缩略图、幂等错误元数据和任务详情复用所必需的最小契约闭环；全局通用页面引擎和无关模块重构不在范围内。

主要使用者为设备/视频运维人员。设计优先级依次为：状态辨识、异常恢复、机位定位、任务跟踪、图像识别效率。

### 0.1 本次审核修订

本版已将可行性审核结论并入正文，不再把风险作为实施阶段的隐含假设。主要修订如下：

- 私有缩略图、原图预览和下载统一走带鉴权的 Blob 请求，不直接将私有 API URL 交给 `Image`、`img` 或 `a`。
- 第一阶段新增固定 profile 的缩略图端点，宫格和列表不得使用原图伪装缩略图。
- 采集页支持现有任务中心使用的 `taskId` 深链，并明确采集详情与通用任务详情的组合边界。
- 补齐任务状态、模式、capability、双权限和乐观版本控制矩阵。
- 明确幂等请求的已知失败/未知结果分类、SSE 合并刷新、远程机位搜索和宫格/Grid 数据所有权。
- 修正 375px 响应式矛盾，增加规模、慢网、私有流和工程基线验收。

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
| 私有图像加载 | `src/composables/useImagePreview.ts` |
| SSE 基础能力 | `src/composables/useSseEvents.ts` |
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
10. 私有图像 URL 由裸 `fetch`、`Image src` 或链接直接访问，未统一使用 API base URL、Bearer Token 和刷新令牌能力。
11. 宫格使用原图内容流作为缩略图，CSS 缩放无法降低网络流量和解码内存。
12. 任务中心已有 `/image/collections?taskId=...` 深链，但采集页尚未解析并打开任务详情。
13. 通用任务详情只检查 `Task:Control`，不能直接满足图像域控制所需的双权限协议。
14. 当前 SSE 恢复判断无法覆盖 `error -> connecting -> open`，持续高频事件还可能使尾随去抖长期不执行。
15. 设备和通道下拉只加载前 200 条，本地搜索无法覆盖大型设备池。

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
- `PAUSE` capability 在当前 Durable Business Task 契约中表示“暂停生命周期能力”，由任务状态区分显示暂停或恢复；该约定必须通过契约测试锁定。
- 不使用当前分页行计算“全量任务统计”。现有采集 API 没有领域统计接口，因此采集页不展示伪统计卡。
- 客户端校验用于即时反馈，服务端校验仍是最终结果。
- 私有二进制内容只通过带鉴权的 API 客户端获取；页面组件只消费临时 Object URL。

### 2.4 性能边界优先

- 宫格和列表只请求缩略图 profile，详情抽屉打开后才请求原图。
- 缩略图按可视区懒加载，离屏、翻页、筛选变化和组件卸载时取消未完成请求并释放 Object URL。
- 图像请求默认最多并发 6 个；并发限制只负责削峰，服务端缩略图负责降低总字节数和解码内存。
- SSE 刷新采用合并、最大等待时间和 single-flight，不允许请求风暴，也不允许持续事件使刷新无限延期。

### 2.5 适度复用

- 共享页面结构和状态规则，不提前抽象万能工作台。
- 资产的宫格浏览与采集的任务表格保持领域差异。
- 可复用现有任务组件，避免在图像域重复实现进度与执行历史。
- 通用任务详情拆分为无 Drawer 外壳的内容组件；图像采集详情负责领域数据、双权限和控制命令，不在 Drawer 内嵌套另一个 Drawer。

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
├── Shared Pagination（仅资产页）
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
- 查询成功后使用 `router.replace` 将稳定筛选字段同步到 URL；空值、非法枚举和纯 UI 状态不写入 URL。
- 重置优先恢复路由携带的 `deviceId/channelId` 上下文，不直接清空深链来源。
- 上下文筛选使用可关闭 Tag 展示；用户主动关闭后同步移除路由参数。
- 日期组件值只存在于 UI 层，请求前转换为 Unix 毫秒。
- `assetId` query 保留给兼容详情深链；列表中的资产 ID 筛选使用 `filterAssetId` query，并在请求体中映射为 `assetId`。
- 路由前进/后退时重新解析 query、回填表单并请求对应结果；程序写入 query 时避免重复请求。

### 4.5 视图工具栏

- 左侧显示当前结果总数和路由上下文 Tag。
- 右侧使用 `Segmented` 切换“宫格 / 列表”，并提供刷新按钮。
- 拥有 `Image:Asset:View` 时默认视图为宫格；只有 `Image:Asset:Query` 时强制列表并隐藏宫格切换和图像列，不发起任何二进制请求。
- 视图偏好保存为本地 UI 状态，不写入业务 URL；建议 key 为 `voglander:image-assets:view`。
- 切换视图不重新请求数据，不重置页码与筛选。
- 本地偏好读取和写入必须捕获浏览器存储异常；失败时回退到宫格，不影响业务查询。

### 4.6 宫格视图

使用 CSS Grid 组合 Ant Design `Card`、`Image`、`Tag` 和 `Dropdown`。

| 可用内容宽度 | 最大列数 |
| --- | --- |
| `>= 1536px` | 6 |
| `>= 1200px` | 5 |
| `>= 1024px` | 4 |
| `>= 768px` | 3 |
| `>= 480px` | 2 |
| `< 480px` | 1 |

卡片规则：

- 使用 `repeat(auto-fit, minmax(min(100%, 180px), 1fr))` 或等价实现，最大列数按上表限制；375px 页面在扣除 Page 内边距后自动降为单列。
- 缩略图使用 `gallery` profile、4:3 固定容器和 `object-fit: cover`，不得请求原图 `/content` 作为缩略图。
- 使用 IntersectionObserver 只加载可视区及前后一行；离屏、翻页或筛选变化时释放引用并允许取消未开始/未完成请求。
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

缩略图失败只显示占位和“重试缩略图”，不得自动降级加载原图。重试仍受全局并发队列约束。

### 4.7 列表视图

使用 `useVbenVxeGrid`，关闭内部查询表单，查询数据由资产页面控制器传入。

| 列 | 内容 |
| --- | --- |
| 图像 | 56×42 展示，实际请求 112×84 的 `table` profile；加载失败显示占位 |
| 名称 | 资产名称；次级文本显示资产 ID |
| 来源 | 来源类型 Tag；采集来源附机位信息 |
| 规格 | `宽 × 高` 和图像格式 |
| 文件大小 | 统一 B/KB/MB/GB 格式 |
| 采集时间 | 本地日期时间 |
| 状态 | 统一状态 Tag |
| 操作 | 详情 + Dropdown |

资产页面控制器是查询、分页、`rows`、`total`、loading 和 error 的唯一数据所有者。VXE Grid 关闭 proxy 自动请求和内部 pager，以受控 `data` 渲染；宫格与列表下方共用同一个 Ant Pagination，页码和 pageSize 变化只调用控制器。切换视图只更换展示组件，不请求、不重置页码。

列表保留 VXE Grid 的列设置、全屏和横向滚动能力，关闭依赖 proxy 的内置刷新。页面数据工具栏提供唯一刷新入口并调用控制器的 `refreshCurrentPage`，不得绕过控制器形成第二份请求状态。

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
- 文件格式提示使用扩展名、MIME 和图像解码结果交叉验证；客户端结果只用于反馈，服务端仍执行内容嗅探和最终校验。
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
5. 选择新的 `File` 对象时无条件视为内容变化，即使文件名、大小和修改时间相同。
6. 已知失败只包括客户端未发出的校验失败，或服务端明确返回的确定性业务拒绝；超时、断网、HTTP 408/429/5xx 和无法分类的异常均进入未知结果。

### 4.9 资产详情抽屉

使用 `useVbenDrawer`，建议宽度 `w-full max-w-[720px]`。

内容顺序：

1. 完整比例图像预览；只有抽屉打开且拥有查看权限时请求原图 Blob。
2. `Descriptions bordered size="small"` 展示名称、格式、尺寸、大小、状态、来源、设备/通道、采集时间和入库时间。
3. 资产 ID、来源任务 ID、来源执行 ID 提供复制操作。
4. Drawer footer 展示下载、删除或重试删除。

深链协议：

- `/image/assets/:assetId` 和 `/image/assets?assetId=...` 均可打开详情。
- 关闭 query 深链详情时移除 `assetId`，保留其他筛选参数。
- 关闭 path 深链详情时回到 `/image/assets`，并保留可恢复的 query。
- 预览失败显示 `Empty + 重试`，不暴露破损图片图标。
- 关闭抽屉、切换资产或组件卸载时取消不再需要的请求，并在最后一个引用释放时回收 Object URL。
- 下载通过带鉴权的 Blob 请求完成，文件名优先使用响应 `Content-Disposition`，其次使用资产名称和图像格式；不得用私有 API URL 作为 `a.href`。

### 4.10 私有二进制传输与缩略图协议

缩略图、原图和下载均为需要 `Image:Asset:View` 权限的私有二进制响应。它们不使用 `{ code, data }` JSON 包装。

| 用途 | 端点 | 响应与限制 |
| --- | --- | --- |
| 表格缩略图 | `GET /api/v1/images/{assetId}/thumbnail?profile=table` | 112×84，cover，响应上限 64 KiB |
| 宫格缩略图 | `GET /api/v1/images/{assetId}/thumbnail?profile=gallery` | 320×240，cover，响应上限 256 KiB |
| 详情原图 | `GET /api/v1/images/{assetId}/content` | 原始图像内容，仅详情按需请求 |
| 下载 | `GET /api/v1/images/{assetId}/download` | 附带安全的 `Content-Disposition` 文件名 |

服务端要求：

- `profile` 只接受 `table` 和 `gallery`，不接受任意宽高，避免图片变换被滥用为资源消耗入口。
- 缩略图保持方向正确，输出安全的浏览器图片格式；通过调整编码质量满足响应上限，不放大原图，无法安全生成时返回明确错误而不是回传原图。
- ETag 由资产 checksum、profile 和缩略图算法版本共同生成；使用 `Cache-Control: private`，不得被公共代理共享。
- `DELETED`、无权限和不存在的资产不得返回内容；所有错误保持现有统一错误语义。
- 解码前校验格式和像素约束，图片变换使用有并发上限和超时的工作队列；相同 ETag/profile 可复用服务端派生结果，避免滚动列表重复消耗 CPU。

前端要求：

- 在图像 API 层新增 `getImageAssetThumbnailBlob`、`getImageAssetContentBlob` 和 `downloadImageAssetBlob`，内部使用配置了 base URL、Bearer Token 和刷新令牌的 `requestClient.download` 或等价受控方法。
- `useImagePreview` 以 `assetId + variant` 为缓存键，统一管理最多 6 个并发请求、Promise 复用、引用计数、AbortController、错误重试和 URL 回收。
- 当引用数在请求完成前降为 0 时取消请求；如果请求已经完成，立即 revoke 新建 URL，不得保留零引用缓存。
- Token 不进入 query、Object URL 名称、日志或埋点；不得使用裸 `fetch(imageAssetContentUrl(...))`。
- 页面切换后只保留仍被当前页面或详情引用的 Blob；不建立跨页面无限期内存缓存。

### 4.11 采集来源元数据契约

不新增数据库列。采集生成的资产继续使用 `source.sourceMetadata`，但固定以下可选字段并在前端声明类型：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `deviceId` | string | 采集来源必填，空白字符串视为缺失 |
| `channelId` | string | 采集来源必填，空白字符串视为缺失 |
| `deviceName` | string | 采集时名称快照，可缺失 |
| `channelName` | string | 采集时名称快照，可缺失 |

前端通过单一解析函数校验 `sourceMetadata`，不得在宫格、表格和详情中分别做类型断言。上传来源没有机位字段时显示“-”；名称缺失时回退到 ID。后端必须用契约测试保证采集来源至少包含设备和通道 ID。

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

状态 Select 覆盖公共任务契约的全部状态：`SCHEDULED`、`RUNNING`、`PAUSED`、`CANCELLING`、`COMPLETED`、`PARTIAL_COMPLETED`、`FAILED`、`CANCELLED`。模式筛选使用图像领域的 `ONCE/SCHEDULED`，展示时再按下方模式映射兼容 Business Task 的 `AT_TIME/FIXED_RATE`。

Grid 约定：

- `submitOnChange=false`，由用户主动查询。
- `rowConfig.keyField=taskId`。
- 开启横向和纵向滚动。
- 保留刷新、列设置、搜索折叠和全屏能力。
- 从设备通道页进入时回填设备/通道上下文，并显示可关闭 Tag。
- 查询成功后将稳定筛选字段写入 URL；`taskId` 只控制详情深链，不进入分页请求 body。
- 路由前进/后退时回填查询表单；如果 `taskId` 变化，只更新详情抽屉，不重置列表页码。

列定义：

| 列 | 内容 |
| --- | --- |
| 任务 | 任务名称；次级文本显示可复制 taskId |
| 机位 | 设备/通道名称；次级文本显示 ID |
| 模式 | 按统一映射显示单次或定时 Tag |
| 状态 | 统一语义 Tag |
| 进度 | 复用 `TaskProgress` |
| 调度 | 计划时间、下一执行时间或采集间隔 |
| 结果 | `resultRefType=IMAGE_ASSET` 且 `resultRefId` 存在时显示“查看图像”；始终可按 `sourceTaskId` 查看该任务全部资产 |
| 操作 | 详情 + Dropdown 更多操作 |

状态表现：

| 状态 | Ant Design 语义 |
| --- | --- |
| SCHEDULED | processing |
| RUNNING | processing，保留运行状态点 |
| PAUSED | warning |
| CANCELLING | processing，文案明确为取消中且不再提供控制操作 |
| COMPLETED | success |
| PARTIAL_COMPLETED | warning，文案明确为部分完成 |
| FAILED | error |
| CANCELLED | default |
| 未知状态 | default，显示后端原始安全文本或“未知”，不默认套用某个已知状态 |

模式展示映射：

| 来源字段值 | UI 模式 |
| --- | --- |
| `collectionMode=ONCE` 或 `taskMode=ONCE` | 单次采集 |
| `collectionMode=SCHEDULED`、`taskMode=AT_TIME` 或 `taskMode=FIXED_RATE` | 定时采集 |
| 其他值 | 未知模式，并保留安全的原始值用于排障 |

### 5.4 行操作协议

- “详情”始终作为稳定首操作。
- 暂停、恢复、调整计划、人工重试和取消放入 Dropdown。
- Dropdown 项由后端 `capabilities`、任务状态和权限共同决定。
- `Image:Collection:Control` 与 `Task:Control` 均满足后才展示控制操作。
- 取消使用 danger 语义并通过 `Modal.confirm` 二次确认。
- 操作 loading 只锁定当前行；其他任务仍可查看和操作。
- 版本冲突时提示“任务状态已变化”，随后刷新权威数据。
- 点击时重新执行权限、状态和 capability 检查；渲染时可见不代表命令入口可以跳过检查。
- 暂停、恢复、取消和调整计划携带采集详情返回的 `version` 作为 `expectedVersion`；没有版本时先刷新详情，不发送控制请求。
- 人工重试必须有 `lastExecutionId`，并使用稳定的 `manual-retry:{taskId}:{executionId}` 幂等键。

完整操作矩阵：

| UI 操作 | 允许状态 | 必需 capability | 必需权限 | API |
| --- | --- | --- | --- | --- |
| 暂停 | `SCHEDULED`、`RUNNING` | `PAUSE` | `Image:Collection:Control` + `Task:Control` | Business Task pause |
| 恢复 | `PAUSED` | `PAUSE` | `Image:Collection:Control` + `Task:Control` | Business Task resume |
| 调整计划 | `PAUSED` | `RESCHEDULE` | `Image:Collection:Control` + `Task:Control` | Collection reschedule |
| 人工重试 | `FAILED` | `MANUAL_RETRY` | `Image:Collection:Control` + `Task:Control` | Business Task retry |
| 取消 | `SCHEDULED`、`RUNNING`、`PAUSED` | `CANCEL` | `Image:Collection:Control` + `Task:Control` | Business Task cancel |

`CANCELLING` 和所有完成态均不提供控制操作。当前 Durable Business Task 没有独立 `RESUME` capability，因此 `PAUSE` 明确覆盖暂停生命周期的两个方向；后端必须保证暂停任务仍返回 `PAUSE`，前端和后端均以契约测试固定该语义。若后端未来增加 `RESUME` capability，需先更新契约和矩阵，不在前端静默猜测。

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
- 模式选项与 constraints 的 `modes` 取交集；服务端未声明的模式不可选择，当前值不受支持时阻止提交并提示刷新约束。
- retention policy 仅在 constraints 返回可选项时展示 Select。

采集机位：

- 设备和通道均使用服务端远程搜索 Select，设置 `filterOption=false`，输入采用 300ms 去抖。
- 空关键词每页加载 50 条；下拉滚动到底继续加载下一页，达到响应 `total` 后停止。
- 关键词搜索分别执行 ID 精确查询和名称模糊查询，合并时按 ID 去重；使用请求序号或 AbortController 丢弃过期响应。
- 路由预填值先按 ID 精确查询，确保目标不在第一页时仍可正确回显；查不到时保留原 ID 并显示“机位不存在或无权限”，不得悄悄选择其他项。
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
- 开始和结束时间必须有效、结束不早于开始、间隔不小于约束、预计次数不超过 `maxPlannedCount`；服务端仍执行相同校验。
- Alert 显示开始时间、结束时间、间隔和预计次数。

创建幂等规则与上传一致：对规范化业务字段生成稳定 fingerprint；表单业务内容不变且结果未知时复用原 key，用户修改业务内容后生成新 key。日期组件对象、临时选项标签和 UI 展开状态不进入 fingerprint。

### 5.6 调整计划抽屉

调整计划复用新建采集的调度字段与校验规则。

- 仅 `PAUSED` 且 `capabilities` 包含 `RESCHEDULE` 时可用。
- 任务名称、设备和通道只读。
- 可修改开始时间、结束时间、间隔和原因。
- 请求携带 `expectedVersion`。
- 版本冲突后保留输入并刷新任务状态，由用户决定是否再次提交。

### 5.7 任务详情抽屉

使用 `CollectionDetailDrawer` 接入 `useVbenDrawer`，宽度 `w-full max-w-[760px]`。从现有 `TaskDetailDrawer.vue` 提取无 Drawer 外壳的 `TaskDetailContent.vue`，任务中心继续使用原 Drawer 外壳，采集详情组合领域内容与通用内容。复用：

- `TaskProgress`
- `TaskExecutionHistory`
- Business Task 查询和控制 API

详情数据由两个权威来源组成：

- `GET /api/v1/image-collection-tasks/{taskId}`：设备、通道、retention policy、采集模式、调度、结果引用和 collection version。
- `GET /api/v1/business-tasks/{taskId}`：通用任务状态、capabilities、活动执行、进度和任务控制信息。

打开详情时并行请求两者。任一请求失败时保留可用分区并显示分区级重试；控制操作只有在两份数据均满足矩阵要求时可用。不得用对象展开覆盖同名但语义不同的 `version/scheduleVersion` 字段。

详情顺序：

1. 任务名称、状态 Tag、模式 Tag、可复制任务 ID。
2. 当前可执行的任务控制操作。
3. 任务进度。
4. 设备与通道信息。
5. 调度起止、间隔和下一执行时间。
6. 计划、成功、失败、错过等执行计数。
7. 结果摘要；`resultRefType=IMAGE_ASSET` 时提供单个结果详情链接，并始终提供按 `sourceTaskId={taskId}` 查看该任务全部资产的链接。
8. 执行记录及事件时间线。

深链协议：

- `/image/collection?taskId=...` 和兼容地址 `/image/collections?taskId=...` 均打开详情。
- 关闭详情时只移除 `taskId`，保留设备、通道和其他列表筛选。
- 非字符串、空白或超长 `taskId` 在发请求前拒绝；无查询权限时显示 403，不加载详情。
- 从任务中心进入、刷新浏览器或使用前进/后退均应得到相同详情状态。

SSE 触发当前任务刷新时保留抽屉实例、焦点和滚动位置。`TaskExecutionHistory` 增加显式 `refreshKey` 或公开刷新 API，使同一 `taskId` 下的执行与事件能够更新；刷新失败保留旧历史并提供重试。执行历史按最新计划/创建时间倒序，每页 20 条并提供“加载更多”，不得固定只取前 100 条；刷新后优先保留仍存在的当前选中 execution。

---

## 6. 组件映射

| UI 能力 | 选用组件 | 说明 |
| --- | --- | --- |
| 页面容器 | `Page` | 统一内容高度与页面 header |
| 资产查询 | `useVbenForm` | 同时驱动宫格与列表 |
| 采集查询/列表 | `useVbenVxeGrid` | 对齐任务中心与设备列表 |
| 资产列表 | `useVbenVxeGrid` | 关闭内部 form/proxy，消费页面控制器数据 |
| 资产分页 | `Pagination` | 宫格与列表共享，VXE 内部 pager 关闭 |
| 上传/创建/详情 | `useVbenDrawer` | 统一 footer、loading 和关闭协议 |
| 结构化表单 | `useVbenForm` | schema、校验和响应式布局 |
| 资产统计 | `Card + Statistic` | 只展示后端权威统计 |
| 文件上传 | `Upload.Dragger` | 单文件、手动提交 |
| 私有图像加载 | `requestClient.download + useImagePreview` | 鉴权 Blob、并发、取消、引用计数与 URL 回收 |
| 图像显示 | `Image` | 只消费 Object URL，不直接访问私有 API URL |
| 状态 | `Tag` / `Badge` | 文本与颜色共同表达 |
| 任务详情内容 | `TaskDetailContent` | 无 Drawer 外壳，供任务中心和采集详情组合 |
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
- 不使用裸 `fetch`、私有 URL `Image src` 或私有 URL `a.href` 获取图像内容。
- 不让宫格、Grid 和路由各自维护一份资产分页状态。
- 不在采集详情中直接复用带 Drawer 外壳且只检查 `Task:Control` 的现有 `TaskDetailDrawer`。

---

## 7. 前端结构建议

目标是拆分页面职责，同时避免通用组件过度设计。

```text
src/views/image/
├── shared/
│   ├── image-presentation.ts       # 状态颜色、格式、时间与字节展示
│   ├── image-permissions.ts        # 图像域权限组合判断
│   ├── image-source.ts             # sourceMetadata 校验与机位展示适配
│   ├── idempotent-submit.ts        # fingerprint、key 与错误分类状态机
│   └── authoritative-refresh.ts    # SSE 合并刷新与 single-flight
├── assets/
│   ├── list.vue                    # 路由页面与数据编排
│   ├── data.ts                     # 查询/列 schema 与纯函数
│   ├── use-asset-page-controller.ts # 唯一分页、查询与错误状态
│   └── components/
│       ├── AssetStatistics.vue
│       ├── AssetGallery.vue
│       ├── AssetThumbnail.vue
│       ├── AssetUploadDrawer.vue
│       └── AssetDetailDrawer.vue
└── collection/
    ├── list.vue                    # 路由页面与 Grid 编排
    ├── data.ts                     # 查询/列 schema 与纯函数
    ├── use-camera-options.ts       # 设备/通道远程搜索与分页
    └── components/
        ├── CollectionCreateDrawer.vue
        ├── CollectionScheduleFields.vue
        ├── CollectionRescheduleDrawer.vue
        └── CollectionDetailDrawer.vue

src/views/task/center/
├── TaskDetailDrawer.vue            # 任务中心 Drawer 外壳
└── TaskDetailContent.vue           # 可组合的通用详情内容
```

职责边界：

- 路由页面负责 URL 同步、SSE 刷新和打开抽屉；资产分页和请求状态委托给页面控制器。
- `data.ts` 只包含 schema、列定义、状态判断和可单测纯函数。
- Drawer 组件负责自身表单、校验、幂等提交与成功事件。
- 展示组件不直接发起列表请求。
- API 层保持现有领域边界，不将 UI 状态写入 API 类型。
- `TaskDetailContent` 不发起图像领域控制命令；调用方传入允许操作和回调，任务中心行为保持兼容。

`useImagePreview` 是缩略图和原图受控加载的唯一入口，负责鉴权 Blob、profile 缓存键、并发限制、请求取消、Promise 复用、错误重试、引用计数和 Object URL 回收；列表和宫格不各自实现 Blob 生命周期。

### 7.1 资产数据流

```text
route query / query form / pager / SSE
                 │
                 ▼
       useAssetPageController
       filters/page/size/rows/total
       loading/error/requestRevision
            │               │
            ▼               ▼
      AssetGallery      controlled VXE Grid
            └────── 同一控制器 ──────┘
                       │
             shared Ant Pagination
```

- 所有列表请求必须经过控制器；控制器对过期请求使用 AbortController 或 request revision 丢弃响应。
- 筛选变化回到第 1 页；如果删除后当前页为空且不是第 1 页，回退一页并重新查询。
- SSE、上传成功、删除和手动刷新只调用控制器公开的刷新方法。
- 视图切换只改变渲染分支；控制器实例和已有结果保持不变。

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
- `taskId`：详情深链，不进入采集分页请求 body

路由 query 解析必须过滤非字符串、空白值、超长 ID 和非法枚举，不能直接断言为 API 请求类型。列表筛选成功后使用 `router.replace` 同步稳定 query；关闭详情只删除 `taskId`。

---

## 9. API 契约

本方案保持现有接口路径和业务语义，第一阶段只增加缩略图端点并固定采集来源元数据字段。私有二进制端点继续使用现有鉴权体系，不新增公开 URL 或 token query。

### 9.1 图像资产

| 方法 | 路径 | UI 用途 |
| --- | --- | --- |
| GET | `/api/v1/images/constraints` | 上传格式、字节和像素约束 |
| GET | `/api/v1/images/statistics` | 四张统计卡 |
| POST | `/api/v1/images/getPage?page={page}&size={size}` | 宫格和列表分页 |
| GET | `/api/v1/images/{assetId}` | 详情权威数据 |
| POST | `/api/v1/images/uploads` | multipart 上传，携带幂等键 |
| GET | `/api/v1/images/{assetId}/thumbnail?profile={table\|gallery}` | 私有受控缩略图流；第一阶段新增 |
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

- IMAGE_COLLECTION 任务的单个资产结果固定使用 `resultRefType=IMAGE_ASSET`；其他值不生成资产详情链接。
- `PAUSE` capability 对暂停生命周期双向生效，状态为 `PAUSED` 时对应 resume；该语义由前后端契约测试共同锁定。
- 采集页读取 IMAGE_COLLECTION 的 Business Task 详情和执行历史时，后端按资源类型接受 `Image:Collection:Query`；`Task:Query` 只授权通用任务中心，不得单独授予图像详情页入口。

### 9.4 时间与分页

- UI 使用日期时间组件；API 继续使用 Unix 毫秒 `number`。
- 分页继续使用 `POST .../getPage`，`page/size` 位于 query，过滤条件位于 body。
- 分页响应继续使用 `{ total, items }`。
- 资产页宫格和列表共享同一份分页数据。

### 9.5 二进制响应约定

- thumbnail、content 和 download 返回原始 Blob，不进入默认 `{ code, data }` JSON 解包逻辑。
- 前端请求必须复用 `requestClient` 的 base URL、Authorization、语言和刷新令牌拦截器。
- 为 `RequestClientConfig` 增加默认值为 false 的 `suppressGlobalError` 可选项；thumbnail、content 和由 Drawer 自行呈现错误的请求设为 true，避免一页多个缩略图失败产生 toast 风暴或与分区 Alert 重复提示。
- thumbnail/content 使用响应 `Content-Type`；download 同时返回经过安全处理的 `Content-Disposition`。
- 401 按现有刷新令牌协议处理；刷新失败进入统一登录失效流程。403、404、410 分别显示权限不足、不存在、已删除，不自动改用其他端点。

### 9.6 提交错误元数据

上传和创建接口需要在图像 API 层使用保留错误元数据的请求方式，形成以下前端内部结构；现有普通请求方法的返回语义保持不变：

```ts
interface ApiRequestErrorMeta {
  businessCode?: string;
  httpStatus?: number;
  message: string;
  transport: 'abort' | 'network' | 'response' | 'timeout' | 'unknown';
}
```

- API 层负责在通用错误被简化前保留 `httpStatus`、业务码和 transport 分类，不允许 Drawer 从提示文本反推错误类型。
- 该能力以显式的 `requestWithErrorMeta`（或同等命名）提供，并复用同一 RequestClient 实例及拦截器；不得创建一套不带刷新令牌能力的旁路客户端。请求使用 `suppressGlobalError=true`，由幂等状态机负责唯一反馈。
- HTTP 400、401、403、404、409、413、415、422 只有在后端返回明确的确定性业务码时才可归为已知失败。
- HTTP 408、429、所有 5xx、超时、断网、客户端在提交后中止和缺少明确业务码的响应一律按未知结果处理。
- 后端收到同一 `Idempotency-Key` 和相同业务内容时必须返回首次请求的同一业务结果；同 key 不同内容返回明确的幂等冲突业务码。

---

## 10. SSE 与数据刷新协议

### 10.1 资产页

监听：

- `image.asset.created`
- `image.asset.deleting`
- `image.asset.deleted`

事件只触发合并后的列表与统计刷新，不直接将 SSE payload 合并进资产对象。基础延迟 250ms、最大等待 1500ms；持续事件不得无限推迟刷新。

### 10.2 采集页

监听：

- `image.asset.created`
- `image.asset.deleted`
- `business.task.state`
- `business.task.progress`
- `business.task.execution-state`

列表刷新采用 300ms 合并窗口和 1500ms 最大等待。详情抽屉打开时，如果事件对应当前 taskId，则刷新 collection 详情、Business Task 详情和必要的执行数据；不得重建抽屉或重置滚动位置。

### 10.3 合并与并发规则

- 刷新器维护 `dirty`、`inFlight`、`firstDirtyAt` 和定时器。事件到达只标记 dirty；无进行中请求时按基础延迟执行，达到最大等待立即执行。
- 请求进行中收到新事件时不并发查询；当前请求完成后如果 dirty，再合并执行一次。
- 页面卸载时清理 timer、visibility listener 和未完成请求；过期响应不得覆盖较新的筛选或页码。
- SSE 去重键必须包含可用的 `assetId/taskId/executionId/deviceId/channelId`，不能只依赖 topic 和毫秒时间戳。
- 详情历史通过 `refreshKey` 或公开方法刷新，同一 taskId 的事件不能因为 props 未变化而被忽略。

### 10.4 连接恢复

- SSE 第一次进入 error/closed 后设置 `hadDisconnect=true`。后续连接经历 `connecting` 并进入 open 时，只要该标记为 true 就执行一次权威刷新，然后清除标记；不得依赖 `previousStatus === 'error'`。
- SSE 断开不禁用查询、上传、创建和控制操作。
- 两页 SSE 断开后仅在页面可见时启用 30 秒兜底刷新；连接恢复后立即停止兜底计时器。
- 连接状态仅在采集页头部以 Badge 展示，不使用高频 toast。
- 页面从隐藏恢复可见时，如果 SSE 未连接或存在 dirty 数据，立即执行一次合并刷新。

---

## 11. 权限协议

| 能力 | 权限码 | UI 规则 |
| --- | --- | --- |
| 查询资产 | `Image:Asset:Query` | 无权限显示 403 状态 |
| 查看资产 | `Image:Asset:View` | 控制缩略图、原图、下载和详情深链；只有查询权限时可看元数据但不请求任何图像 Blob |
| 上传资产 | `Image:Asset:Upload` | 隐藏上传主按钮 |
| 删除资产 | `Image:Asset:Delete` | 隐藏删除与重试删除 |
| 查询采集 | `Image:Collection:Query` | 无权限显示 403 状态 |
| 查询通用任务 | `Task:Query` | 只用于任务中心；图像采集页按资源类型使用 `Image:Collection:Query` 读取关联任务数据 |
| 新建采集 | `Image:Collection:Create` | 隐藏新建主按钮 |
| 图像域控制 | `Image:Collection:Control` | 与 Task 权限组合判断 |
| 通用任务控制 | `Task:Control` | 与图像域控制权限组合判断 |

权限必须在 UI 可见性和操作函数入口执行双重检查。隐藏按钮不是安全边界，后端仍负责最终鉴权。

- thumbnail、content 和 download 后端统一检查 `Image:Asset:View`；前端不缓存或复用无权限请求的响应。
- 采集详情至少需要 `Image:Collection:Query`；通用任务内容不得因为用户有 `Task:Control` 就单独暴露图像任务控制。
- `TaskDetailContent` 接收调用方计算好的允许操作集合，不在内部绕过图像域权限重新推导。
- 权限在 Drawer 打开期间变化时立即重新计算操作集合；提交入口在调用 API 前再次读取当前权限。

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
| 缩略图失败 | 当前卡片/单元格占位 + 重试 | 不适用 |
| 分区失败 | 详情中保留其他成功分区并局部重试 | 详情中保留其他成功分区并局部重试 |

### 12.2 幂等提交状态机

```text
IDLE
  -> VALIDATING
  -> SUBMITTING(key, fingerprint)
       -> SUCCESS：关闭抽屉并刷新
       -> KNOWN_FAILURE：展示确定性原因；等待用户修改内容
       -> UNKNOWN_RESULT：保留 key、fingerprint 和表单，允许安全重试

KNOWN_FAILURE
  -> DIRTY：业务内容变化，生成新 key 后重新校验

UNKNOWN_RESULT
  -> SUBMITTING(same key, same fingerprint)：安全重试
  -> DIRTY：用户确认修改业务内容，生成新 key
```

`fingerprint` 表示本次业务输入的稳定摘要，仅用于判断用户是否改变请求内容，不发送给后端：

- 上传 fingerprint 包含资产名称和当前 File 选择实例的本地 token；重新选择文件无条件进入 DIRTY，不依赖文件名/大小碰撞判断。
- 创建 fingerprint 使用字段顺序稳定的规范化 JSON，只包含任务名称、模式、设备、通道、Unix 毫秒调度、间隔和 retention policy。
- 日期对象、Select 标签、错误文案、Drawer 状态和其他 UI 字段不进入 fingerprint。
- key 只在首次进入 SUBMITTING 或 DIRTY 后再次提交时生成；未知结果重试不得在点击时重新生成。

错误分类：

| 类别 | 示例 | key 处理 |
| --- | --- | --- |
| 客户端已知失败 | 文件格式/大小/像素、必填项、调度约束未通过且请求未发出 | 不创建或不消耗 key |
| 服务端已知失败 | 带明确确定性业务码的 400/401/403/404/409/413/415/422 | 保留当前信息；内容修改后生成新 key |
| 未知结果 | timeout、network、408、429、5xx、提交后 abort、无法识别的响应 | 原内容重试必须复用 key |

Drawer 在 SUBMITTING 时通过 `drawerApi.lock()` 或等价能力禁止关闭和重复提交。UNKNOWN_RESULT 状态允许关闭前必须二次提示“关闭不会撤销请求结果”；重新打开不承诺跨页面恢复未知提交，因此默认保留当前 Drawer 实例直到用户确认成功、刷新核对或放弃。

### 12.3 危险操作

- 删除资产与取消任务均需二次确认。
- 提示文案必须包含操作对象名称或 ID。
- 请求成功后刷新权威数据；不只在本地移除行。
- 删除失败保留资产并展示 `DELETE_FAILED`，允许从详情或更多菜单重试。
- 删除、取消和控制发生版本冲突时保留当前 UI 上下文，刷新权威详情后再计算操作集合，不自动重复危险命令。

---

## 13. 响应式、可访问性与国际化

### 13.1 响应式

- 主要使用场景按 `>=1024px` 桌面运维工作台优化。
- `<768px` 时 Page header 换行，查询表单单列，Drawer 占满屏宽。
- 表格通过横向滚动保护字段可读性，不把全部列压缩到手机宽度。
- 手机端可隐藏次级 ID 文本，但状态、进度和主要操作必须保留。
- 资产宫格按可用内容宽度自适应：`>=480px` 可为两列，`<480px` 为单列；375px 验收必须为单列且卡片宽度不小于 180px。
- Drawer 使用 `w-full max-w-[...]`，移动端由 Vben Drawer 自动占满屏宽；footer 操作允许换行但主操作保持可见。

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

- asset/task path 和 query 的合法解析、序列化、前进/后退及超长/非法输入过滤。
- 统计卡到筛选条件的映射。
- 资产状态到 Tag 和操作能力的映射。
- 文件大小、图像格式、日期时间展示。
- `sourceMetadata` 机位字段解析、缺失字段和非法类型回退。
- 上传 constraints 校验：类型、大小、像素。
- 上传和创建的 ApiRequestErrorMeta 分类；408/429/5xx/network/timeout 不得进入已知失败。
- `suppressGlobalError` 默认保持现有全局提示，设为 true 时不触发全局 toast，但错误仍完整抛给调用方。
- 上传和创建未知结果时幂等键复用，确定性拒绝和业务内容变化后的 key 更新。
- 表单内容变化后幂等键更新。
- 定时采集计划点计算与最大计划数校验。
- `ONCE/SCHEDULED/AT_TIME/FIXED_RATE` 模式展示映射。
- 所有任务状态、capabilities、双权限、version 和 executionId 组合后的操作集合，特别覆盖 PAUSED + PAUSE => RESUME。
- `resultRefType` 到详情链接和 `sourceTaskId` 全部资产链接的映射。
- 合并刷新器的基础延迟、maxWait、single-flight、dirty follow-up 和断线恢复状态机。

### 14.2 组件测试

- 资产宫格和列表切换不触发额外查询、不丢失页码。
- 宫格和列表共用同一个外部分页组件，VXE 内部 pager/proxy 关闭，不形成双请求或过期响应覆盖。
- 资产空状态、预览失败与删除失败可恢复。
- `useImagePreview` 使用鉴权 API Blob 而非裸 fetch；覆盖 profile 缓存键、最多 6 并发、Promise 复用、pending release、abort、重试和恰好一次 URL 回收。
- 上传抽屉文件选择、约束校验、提交锁定、已知失败、未知结果同 key 重试和文件重选新 key。
- 采集抽屉设备/通道远程搜索、分页、过期响应丢弃、深链精确回显、级联和定时字段显隐。
- 采集详情同时加载 collection/Business Task，执行历史响应 refreshKey，局部失败可恢复。
- 执行历史按 20 条分页加载更多、刷新后保留有效选中项，不固定截断为前 100 条。
- 从任务中心进入 `/image/collections?taskId=...` 能打开详情，关闭后只移除 taskId。
- SSE 高频事件被合并且不超过 maxWait，恢复连接后只执行一次权威刷新。
- 无权限时按钮不可见且方法入口仍拒绝操作。
- 只有 `Image:Asset:Query` 时强制元数据列表、隐藏图像列/宫格入口且二进制请求数为 0。
- 仅有 `Task:Control` 而没有 `Image:Collection:Control` 时，采集详情不显示也不能调用控制 API。

### 14.3 E2E 验收路径

1. 上传 JPEG/PNG/WEBP，成功后统计和宫格更新。
2. 上传超限或损坏文件，在发请求前得到明确提示。
3. 模拟上传/创建 timeout、断网和 5xx，使用同一幂等键安全重试；修改内容后使用新 key。
4. 在需要 Bearer Token 且 API base URL 与页面路径不同的环境加载 table/gallery 缩略图、原图和下载，确认无 401/404 且 URL 不含 token。
5. 宫格只请求 `gallery` thumbnail、列表只请求 `table` thumbnail；打开详情前不得请求 `/content`。
6. 快速翻页和切换筛选，旧缩略图请求被取消、旧 Object URL 被释放、旧列表响应不覆盖新结果。
7. 从设备通道页进入资产页，自动应用机位筛选。
8. 通过资产深链打开详情，关闭后保留筛选上下文。
9. 在超过 200 台设备/通道的数据集中搜索和翻页，并正确回显不在第一页的深链机位。
10. 创建单次采集任务并在列表看到状态更新。
11. 创建定时采集任务，计划摘要与服务端结果一致。
12. 暂停任务、调整计划、恢复任务，并验证 expectedVersion 冲突恢复。
13. 失败任务执行人工重试，并在不关闭抽屉的情况下看到新执行历史。
14. 从任务中心 plural alias + taskId 打开采集详情，关闭后保留列表筛选。
15. 从采集结果打开单个图像资产，并按 sourceTaskId 查看任务全部资产。
16. SSE 持续高频 10 秒时列表至少按 maxWait 刷新，断线重连只额外执行一次权威刷新。

### 14.4 视觉验收

- 两页 Page header、查询区、工具栏、抽屉 footer 和反馈方式一致。
- 组件外观与设备、任务中心、级联管理等 Vben 页面无割裂感。
- 明暗主题下无硬编码背景、低对比文本或不可辨识状态。
- 1366px 桌面、1920px 宽屏、768px 平板和 375px 手机均无内容覆盖。
- 375px 资产宫格为单列且卡片不窄于 180px；480px 以上才允许两列。
- 资产宫格图片不导致布局跳动；采集表格操作区不出现多按钮挤压。

### 14.5 性能与资源验收

- thumbnail 服务对 `table/gallery` profile 执行尺寸和响应字节上限；相同 checksum/profile 返回稳定 ETag。
- 宫格和列表任意时刻最多 6 个图像请求；快速离屏或翻页时 queued/pending 请求可被取消。
- 当前页所有缩略图加载完成后，浏览器中不存在零引用 Object URL；离开页面后该页面创建的 URL 全部被 revoke。
- 24 项宫格不得下载 24 份原图；Network 面板中除主动打开详情外不出现 `/content`。
- SSE 列表刷新 single-flight；10 秒连续事件期间不存在并发相同分页请求，也不存在超过 1500ms 一直不刷新的情况。

### 14.6 工程验证

实施开始前先建立绿色基线：修复 `src/views/image/__tests__/image-data.test.ts` 中指向不存在的 `../collections/data` 导入，实际目录为 `../collection/data`。与图像方案无关的存量 typecheck 错误也必须被修复或由独立基线任务明确归属；本方案验收不接受“命令原本就失败”作为新增错误豁免。

实施阶段至少执行：

```bash
pnpm --filter @vben/web-antd run typecheck
pnpm test:unit
pnpm build:antd
```

如仓库脚本名称发生变化，以 `apps/web-antd/package.json` 和根目录 `package.json` 的实际脚本为准。

准入标准为三个命令均以 exit code 0 完成，并保存 thumbnail/content/download 的集成测试、375px 截图和慢网资源验证结果。

---

## 15. 实施边界与顺序

### 15.1 纳入第一阶段

- 建立绿色测试/typecheck 基线并修复图像测试错误目录导入。
- 新增受权限保护的 `table/gallery` thumbnail profile 端点，并固定采集来源 `sourceMetadata` 的设备/通道字段。
- 前端 `suppressGlobalError/requestWithErrorMeta` 请求能力、私有二进制 API，以及 `useImagePreview` 的鉴权 Blob、并发、取消和 URL 生命周期改造。
- 两页 UI 结构与组件统一。
- 资产页面控制器及宫格/受控列表切换。
- Vben Form、Grid、Drawer 的落位。
- 上传文件约束与本地预览。
- 日期时间输入替换 Unix 毫秒输入。
- `taskId` 深链、`TaskDetailContent` 拆分及任务详情、进度、执行历史复用。
- 完整状态/capability/双权限/version、结构化提交错误、SSE 合并刷新和幂等协议统一。
- 设备/通道服务端远程搜索、分页和深链精确回显。
- 响应式、暗色主题、国际化和可访问性完善。

### 15.2 不纳入第一阶段

- 修改现有接口路径、既有字段语义或数据库结构；本阶段只允许 15.1 明确列出的 thumbnail 新端点和 sourceMetadata 契约补齐。
- 新增采集领域统计接口。
- 批量上传、批量删除或批量创建采集任务。
- 新增独立“上传图像”菜单或合并两个页面。
- 建设跨领域配置化页面引擎。
- 重构任务中心、设备管理或级联管理的非相关 UI。
- 建设公共 CDN、跨会话持久缩略图缓存、任意尺寸图片变换服务或公开签名 URL。

### 15.3 建议实施顺序

1. 修复工程基线，锁定 thumbnail、sourceMetadata、capability 和错误业务码契约测试。
2. 实现后端 thumbnail profile 和来源元数据保证，完成鉴权、ETag、尺寸与资源限制验证。
3. 实现前端私有 Blob API、`useImagePreview`、幂等状态机和权威刷新器等共享基础能力。
4. 建立资产页面控制器，拆分并改造资产页、上传抽屉和详情抽屉。
5. 拆分并改造图像采集 Grid、远程机位选择、创建抽屉和调整计划抽屉。
6. 提取 `TaskDetailContent`，接入采集详情、`taskId` 深链、进度、执行历史和双权限控制。
7. 完成 SSE、异常状态、响应式、主题、国际化、可访问性、性能和 E2E 验收。

### 15.4 阶段门禁

- Gate 0：工程基线三个命令全绿；非本方案存量错误可由独立任务修复，但未修复前不得越过本门禁。
- Gate 1：thumbnail 与 sourceMetadata 契约测试通过后，才允许接入资产宫格；不得先用原图临时替代并遗留上线。
- Gate 2：私有 Blob、Object URL 生命周期和幂等未知结果测试通过后，才允许替换现有上传和预览入口。
- Gate 3：状态/capability/双权限矩阵及 plural alias taskId 深链通过后，才允许替换现有采集控制和详情。
- Gate 4：三个工程命令、E2E、375px、慢网和 SSE 高频验收全部通过后进入发布候选。

---

## 16. 验收结论

本方案完成后应满足以下结果：

- 用户仍通过“图像资产”和“图像采集”两个明确入口完成工作。
- 上传图像是资产页的主操作，而不是新的页面或菜单。
- 页面使用现有 Vben/Ant Design 组件和主题语言，视觉统一但保留图像领域特征。
- 资产浏览不再同时重复显示宫格和表格。
- 采集任务的状态、进度、调度、结果与可执行操作能够在一个标准列表中快速识别。
- 上传、创建、控制、删除和实时刷新在异常情况下均有明确恢复路径。
- 私有缩略图、原图和下载在开发/生产 API base URL 与 Bearer Token 模式下均可用，不泄露 token，不使用原图伪装缩略图。
- 现有 API 路径和业务语义保持兼容；第一阶段依赖本方案明确的 thumbnail 新端点与 sourceMetadata 契约补齐，不再宣称完全不依赖后端改造。
- 任务中心既有 `/image/collections?taskId=...` 深链、图像域双权限和 Durable Business Task 全状态均得到兼容。

本文档是 1.0.9 审核修订后的实施计划设计输入。文档确认后，按 15.3 和 15.4 拆分前后端代码任务、契约测试与验证步骤。
