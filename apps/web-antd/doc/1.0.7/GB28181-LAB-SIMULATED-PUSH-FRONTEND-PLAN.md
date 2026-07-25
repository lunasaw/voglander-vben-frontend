# GB28181 协议验证台 — 前端「ffmpeg 模拟推流」技术方案

> 配套后端方案：`voglander/doc/1.0.6/GB28181-LAB-SIMULATED-PUSH-TECH-PLAN.md`（后端已 TDD 实施，64 lab 测试全绿）。本方案为前端落地部分：在协议验证台**左侧设备面板（ClientPanel）**新增「模拟推流」区，ffmpeg 路径 + 视频文件路径可动态填写，配合后端 `/lab/client/push/*` 端点，让「平台点播 → 设备回 200 OK → ffmpeg 推流 → flv 可播」整条闭环在页面上可操作、可观测。

---

## 0. TL;DR

| 维度 | 结论 |
| --- | --- |
| 改动范围 | 纯前端 `vue-vben-admin/apps/web-antd`，**不新增后端**（后端端点已就绪）。 |
| 落点 | 左侧 `ClientPanel.vue` 新增可折叠「模拟推流」区（与既有「注册信息」折叠区同风格）；`SipTimeline` 串入 push 事件。 |
| 动态改 | ffmpeg 路径 + 文件路径两个输入框，初值来自 `/lab/client/config` 回显的 `ffmpegPath`/`mediaFile`，提交时覆盖后端配置默认值。 |
| 自动/手动 | `config.pushAuto` 只读展示。`auto=true`：平台点播后设备自动推流，按钮仅作补推/重推；`auto=false`：必须手动点「模拟推流」，且**须在平台 8s 超时窗内**——前端收到 `clientcmd.invite` 后高亮按钮 + 8s 倒计时提示。 |
| 状态可见 | 轮询/SSE 驱动 `push/status`：展示 `state`(IDLE/RUNNING/STOPPED/FAILED) + 目标 `mediaIp:mediaPort` + ffmpeg 最近日志。 |
| 新增 SSE | `clientcmd.push.started/stopped/failed` 已在后端 `config.topics`，前端零订阅改动（`useSseEvents` 按 config.topics 动态订阅）。 |
| 文件清单 | 改 `api/protocol-lab.ts`、`components/ClientPanel.vue`、`locales/langs/{zh-CN,en-US}/protocolLab.json`、`components/SipTimeline.vue`(可选样式)。 |
| ���禁 | `pnpm check`(typecheck/eslint/circular/spell) + 根目录 `pnpm build:antd`(turbo 先建 @core)。 |

---

## 1. 与后端契约的精确对齐

### 1.1 新增 REST 端点（`LabClientController`，lab profile 条件化）

| 方法 | 路径 | 入参 | 返回 data |
| --- | --- | --- | --- |
| POST | `/api/v1/lab/client/push/start` | `{ffmpegPath?, mediaFile?}`（均选填，空=配置默认） | `PushStatus` |
| POST | `/api/v1/lab/client/push/stop` | — | `PushStatus`（state=IDLE） |
| GET | `/api/v1/lab/client/push/status` | — | `PushStatus` |

`PushStatus`（后端 `LabMediaPushService.PushStatus`，FastJSON2 序列化字段名）：

```ts
interface PushStatus {
  state: 'FAILED' | 'IDLE' | 'RUNNING' | 'STOPPED';
  callId?: string;
  mediaIp?: string;
  mediaPort?: number; // 后端 int，IDLE 时为 0
  ssrc?: string;
  cmd?: string; // 完整 ffmpeg 命令行（空格拼接，仅展示）
  startMs?: number; // 后端 long，启动时刻
  lastLog?: string; // ffmpeg 最近 ≤30 行（换行拼接）
}
```

> 后端 `requestClient` 已配 `responseReturn:'data'` + `successCode:0`，前端直接拿 `data` 本体（与现有 lab API 一致）。

### 1.2 `/lab/client/config` 新增回显字段（后端已加）

```ts
interface LabConfig {
  // ...既有字段...
  pushAuto: boolean; // push.auto，自动推流开关（只读展示）
  ffmpegPath: string; // push.ffmpeg-path，前端输入框初值
  mediaFile: string; // push.media-file，前端输入框初值（可能为空，联调前填）
  topics: string[]; // 已含 clientcmd.push.started/stopped/failed
}
```

### 1.3 新增 SSE 事件（已在后端 config.topics）

| topic | 方向 | payload | 前端用途 |
| --- | --- | --- | --- |
| `clientcmd.invite` | in（左） | `{callId, clientId, mediaIp, mediaPort, ssrc, ts}`（**已扩展媒体目标**） | 触发「模拟推流」按钮高亮 + 8s 倒计时 |
| `clientcmd.push.started` | in（左） | `{callId, mediaIp, mediaPort, ssrc, ts}` | 时间线「推流启动」+ 状态置 RUNNING |
| `clientcmd.push.stopped` | in（左） | `{callId, ts}` | 时间线「推流停止」+ 状态置 IDLE |
| `clientcmd.push.failed` | in（左） | `{callId, reason, ts}` | 时间线红色「推流失败」 |

> `useSseEvents` 按 `config.topics` 完整 topic 列表 `addEventListener`，新 topic 自动订阅，**无需改 composable**。三者均 `clientcmd.*` 前缀 → `index.vue` 已有 `clientcmdEvents` 过滤自动归左侧。

---

## 2. 交互设计

### 2.1 「模拟推流」区布局（ClientPanel 内，注册区之下）

```
┌─ 设备 UA 控制台 ─────────────────────────┐
│ [身份条]  clientId / 127.0.0.1:5061       │
│ ▸ 注册信息 (折叠)                          │
│ ── 操作 ── 注册 注销 心跳 自动心跳 ...     │
│                                            │
│ ▾ 模拟推流  ●RUNNING                       │  ← 折叠标题带状态徽标
│   自动推流: 开 (收到点播自动推流)           │  ← config.pushAuto 只读
│   ffmpeg 路径 [/usr/local/bin/ffmpeg     ] │
│   视频文件   [/Users/.../demo.mp4        ] │
│   [模拟推流]  [停止推流]                    │
│   目标 127.0.0.1:30000  ssrc 0987654321    │  ← 来自 status/最近 invite
│   ┌ ffmpeg 日志 ───��─────────────┐         │
│   │ frame= 120 fps=25 ...         │         │  ← status.lastLog，等宽小字
│   └───────────────────────────────┘         │
│ ── 收到指令时间线 (clientcmd.*) ──          │
└────────────────────────────────────────────┘
```

### 2.2 状态机与按钮可用性

| 场景 | 「模拟推流」按钮 | 「停止推流」按钮 | 提示 |
| --- | --- | --- | --- |
| 无 INVITE（无 lastTarget） | disabled | disabled | 「请先在平台端发起实时点播」 |
| 收到 `clientcmd.invite`，`auto=false` | **高亮 + 8s 倒计时** | disabled | 「8s 内点击推流」倒计时条 |
| 收到 `clientcmd.invite`，`auto=true` | enabled（补推/重推） | enabled | 「已自动推流」 |
| state=RUNNING | enabled（重推切文件） | enabled | — |
| state=FAILED | enabled | disabled | 红色展示 `reason`/`lastLog` |

> **8s 窗口是手动模式的硬约束**（后端 `MediaPlayServiceImpl.FUTURE_TIMEOUT_SEC=8`）。前端用倒计时显式提醒，超时后按钮恢复普通态并提示「点播可能已超时，请重新点播」。

### 2.3 状态刷新策略

- 进入页面 / 点击启停后：立即调一次 `push/status`。
- `RUNNING` 期间：每 **2s** 轮询 `push/status` 刷新 `lastLog`（ffmpeg 进度）。状态非 RUNNING 时停止轮询，避免空转。
- SSE `clientcmd.push.*` 到达时：即时更新本地 `pushState`（不等轮询），并触发一次 `push/status` 校准。
- 组件卸载：清轮询定时器 + 倒计时定时器。

---

## 3. 文件改动清单

| 文件 | 改动 |
| --- | --- |
| `src/api/protocol-lab.ts` | 增 `PushStatus`/`PushStartReq` 类型、`LabConfig` 扩展 3 字段、`labPushStart/labPushStop/labPushStatus` 三函数 |
| `src/views/protocol-lab/components/ClientPanel.vue` | 增「模拟推流」折叠区 + 状态轮询 + 8s 倒计时逻辑 |
| `src/locales/langs/zh-CN/protocolLab.json` | 增 `push.*` + `msg.push*` 键 |
| `src/locales/langs/en-US/protocolLab.json` | 同上英文 |
| `src/views/protocol-lab/components/SipTimeline.vue` | （可选）`clientcmd.push.failed` 红色样式映射 |
| `src/api/__tests__/protocol-lab.test.ts` | 增 push 三函数单测（与现有风格一致） |
| `src/views/protocol-lab/__tests__/ClientPanel.test.ts` | 增模拟推流交互单测 |

---

## 4. 代码（可直接落地）

### 4.1 `api/protocol-lab.ts`

```ts
export namespace ProtocolLabApi {
  // ── LabConfig 扩展 ────────────────���──────────────────────────────
  export interface LabConfig {
    // ...既有字段...
    /** push.auto：收到 INVITE 是否自动起 ffmpeg（只读展示）。 */
    pushAuto: boolean;
    /** push.ffmpeg-path：ffmpeg 路径输入框初值。 */
    ffmpegPath: string;
    /** push.media-file：视频文件路径输入框初值（可能为空）。 */
    mediaFile: string;
  }

  /** POST /lab/client/push/start 入参（均选填，空=后端配置默认值）。 */
  export interface PushStartReq {
    ffmpegPath?: string;
    mediaFile?: string;
  }

  /** push/start|stop|status 返回的推流状态。 */
  export interface PushStatus {
    state: 'FAILED' | 'IDLE' | 'RUNNING' | 'STOPPED';
    callId?: string;
    mediaIp?: string;
    mediaPort?: number;
    ssrc?: string;
    cmd?: string;
    startMs?: number;
    lastLog?: string;
  }
}

/** 模拟推流：用 ffmpeg 把视频推到最近一次 INVITE 的收流目标。 */
export async function labPushStart(data?: ProtocolLabApi.PushStartReq) {
  return requestClient.post<ProtocolLabApi.PushStatus>(
    `${LAB_CLIENT}/push/start`,
    data ?? {},
  );
}

/** 停止模拟推流。 */
export async function labPushStop() {
  return requestClient.post<ProtocolLabApi.PushStatus>(
    `${LAB_CLIENT}/push/stop`,
    {},
  );
}

/** 查询当前模拟推流状态。 */
export async function labPushStatus() {
  return requestClient.get<ProtocolLabApi.PushStatus>(
    `${LAB_CLIENT}/push/status`,
  );
}
```

### 4.2 `ClientPanel.vue` — 模拟推流逻辑（script setup 增量）

```ts
import { labPushStart, labPushStop, labPushStatus } from '#/api/protocol-lab';
import { onUnmounted } from 'vue';

// ── 模拟推流状态 ───────────────────────────────────────────────────
const showPushForm = ref(true);
const pushForm = reactive({ ffmpegPath: '', mediaFile: '' });
const pushStatus = ref<ProtocolLabApi.PushStatus>({ state: 'IDLE' });
const inviteCountdown = ref(0); // 手动模式 8s 倒计时（秒），0=非倒计时态
let statusTimer: null | ReturnType<typeof setInterval> = null;
let countdownTimer: null | ReturnType<typeof setInterval> = null;

// config 就绪后预填路径输入框 + 拉一次状态
watch(
  () => props.config,
  (c) => {
    if (!c) return;
    pushForm.ffmpegPath = c.ffmpegPath ?? '';
    pushForm.mediaFile = c.mediaFile ?? '';
    refreshPushStatus();
  },
  { immediate: true },
);

// 监听 clientcmd.invite / push.* SSE，驱动倒计时与状态
watch(
  () => props.received,
  (list) => {
    const latest = list.at(-1);
    if (!latest) return;
    if (latest.topic === 'clientcmd.invite' && !props.config?.pushAuto) {
      startCountdown(); // 手动模式：开 8s 倒计时
    } else if (latest.topic.startsWith('clientcmd.push.')) {
      refreshPushStatus(); // 推流事件即时校准
    }
  },
  { deep: true },
);

function startCountdown() {
  stopCountdown();
  inviteCountdown.value = 8;
  countdownTimer = setInterval(() => {
    inviteCountdown.value -= 1;
    if (inviteCountdown.value <= 0) stopCountdown();
  }, 1000);
}
function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  inviteCountdown.value = 0;
}

async function refreshPushStatus() {
  try {
    pushStatus.value = await labPushStatus();
    syncPolling();
  } catch {
    /* lab 未开启等，忽略 */
  }
}

// RUNNING 时 2s 轮询刷新 lastLog；否则停轮询
function syncPolling() {
  const running = pushStatus.value.state === 'RUNNING';
  if (running && !statusTimer) {
    statusTimer = setInterval(refreshPushStatus, 2000);
  } else if (!running && statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
}

async function onPushStart() {
  loading.value = true;
  try {
    pushStatus.value = await labPushStart({
      ffmpegPath: pushForm.ffmpegPath.trim() || undefined,
      mediaFile: pushForm.mediaFile.trim() || undefined,
    });
    stopCountdown();
    message.success($t('protocolLab.msg.pushStarted'));
    syncPolling();
  } catch (e: any) {
    // 后端无目标/非UDP/文件非法 → 400/500，requestClient 已弹错；这里仅兜底
    message.error(e?.message ?? $t('protocolLab.msg.pushFailed'));
  } finally {
    loading.value = false;
  }
}

async function onPushStop() {
  loading.value = true;
  try {
    pushStatus.value = await labPushStop();
    message.success($t('protocolLab.msg.pushStopped'));
    syncPolling();
  } finally {
    loading.value = false;
  }
}

const canPushStart = computed(
  () =>
    pushStatus.value.state === 'RUNNING' ||
    inviteCountdown.value > 0 ||
    !!props.config?.pushAuto,
);
const canPushStop = computed(() => pushStatus.value.state === 'RUNNING');

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer);
  stopCountdown();
});
```

> **可用性判断说明**：`canPushStart` 在「RUNNING（可重推）/ 倒计时中（手动窗口）/ 自动模式（随时补推）」三种情形可点；否则���从无 INVITE 到来）置灰并提示先点播。这与后端 `startPush` 的「无目标抛异常」一致——前端先拦一道，体验更好。

### 4.3 `ClientPanel.vue` — 模板增量（注册区与时间线之间）

```html
<!-- 模拟推流区 -->
<div class="section-title">
  {{ $t('protocolLab.push.title') }}
  <Tag v-if="pushStatus.state === 'RUNNING'" color="green">RUNNING</Tag>
  <Tag v-else-if="pushStatus.state === 'FAILED'" color="red">FAILED</Tag>
</div>

<div class="push-form">
  <div class="push-row">
    <span class="push-label">{{ $t('protocolLab.push.auto') }}</span>
    <Tag :color="config?.pushAuto ? 'green' : 'default'">
      {{ config?.pushAuto ? $t('protocolLab.push.autoOn') :
      $t('protocolLab.push.autoOff') }}
    </Tag>
  </div>
  <input
    v-model:value="pushForm.ffmpegPath"
    :placeholder="$t('protocolLab.push.ffmpegPh')"
    :addon-before="$t('protocolLab.push.ffmpeg')"
  />
  <input
    v-model:value="pushForm.mediaFile"
    :placeholder="$t('protocolLab.push.mediaPh')"
    :addon-before="$t('protocolLab.push.media')"
  />

  <div v-if="inviteCountdown > 0" class="push-countdown">
    {{ $t('protocolLab.push.countdown', { sec: inviteCountdown }) }}
  </div>

  <Space>
    <button
      type="primary"
      :disabled="!canPushStart || loading"
      @click="onPushStart"
    >
      {{ $t('protocolLab.push.start') }}
    </button>
    <button danger :disabled="!canPushStop || loading" @click="onPushStop">
      {{ $t('protocolLab.push.stop') }}
    </button>
  </Space>

  <div v-if="pushStatus.mediaIp" class="push-target">
    {{ $t('protocolLab.push.target') }}: {{ pushStatus.mediaIp }}:{{
    pushStatus.mediaPort }}
    <span v-if="pushStatus.ssrc"> · ssrc {{ pushStatus.ssrc }}</span>
  </div>
  <pre v-if="pushStatus.lastLog" class="push-log">{{ pushStatus.lastLog }}</pre>
</div>
```

### 4.4 i18n（`protocolLab.json` 增量）

zh-CN：

```json
{
  "push": {
    "title": "模拟推流",
    "auto": "自动推流",
    "autoOn": "开（收到点播自动推流）",
    "autoOff": "关（需手动点击）",
    "ffmpeg": "ffmpeg 路径",
    "ffmpegPh": "ffmpeg 可执行文件绝对路径",
    "media": "视频文件",
    "mediaPh": "待推视频文件绝对路径",
    "start": "模拟推流",
    "stop": "停止推流",
    "target": "推流目标",
    "countdown": "请在 {sec}s 内点击推流（平台点播超时窗）"
  },
  "msg": {
    "pushStarted": "推流已启动",
    "pushStopped": "推流已停止",
    "pushFailed": "推流启动失败"
  }
}
```

en-US：对应英文（`Simulated Push` / `FFmpeg Path` / `Click push within {sec}s` 等）。

---

## 5. 测试计划（Vitest）

| 文件 | 用例 |
| --- | --- |
| `api/__tests__/protocol-lab.test.ts` | `labPushStart` 传/不传参的 URL+body；`labPushStop`/`labPushStatus` 路径正确（mock requestClient） |
| `views/protocol-lab/__tests__/ClientPanel.test.ts` | ①config 就绪预填路径输入框；②点「模拟推流」调 `labPushStart` 携带 trim 后的路径；③`auto=false` 时无 INVITE 按钮 disabled；④收 `clientcmd.invite` 后倒计时启动、按钮可点；⑤RUNNING 时「停止」可点；⑥卸载清定时器 |

> 与现有前端测试一致：`vi.mock('#/api/protocol-lab')`，`@vue/test-utils` mount，断言 emit/调用。倒计时/轮询用 `vi.useFakeTimers()` + `vi.advanceTimersByTime`。

> ⚠️ **必须扩 mock 工厂（否则现有 21 个 ClientPanel 用例全崩）**：现有 `ClientPanel.test.ts` 的 `vi.mock('#/api/protocol-lab', () => ({ ... }))` 只列了 7 个旧函数。ClientPanel 在 config watcher（`immediate:true`）里会同步调 `labPushStatus()`——mock 不补 `labPushStart/labPushStop/labPushStatus` 三个 key 时它们是 `undefined`，挂载即抛 `not a function`，连带拖垮全部既有用例。落地第一步先在该 mock 工厂（及 `vi.hoisted` 的 spy 对象）补这三函数，再写新用例。

> 同样地，新增 push 用例需让 `labPushStatus` 默认 `mockResolvedValue({ state: 'IDLE' })`，避免 watcher 里 `await labPushStatus()` 返回 `undefined` 触发 `syncPolling()` 读 `.state` 报错。

---

## 6. 质量门禁

```bash
# 在 vue-vben-admin 根目录执行
pnpm check          # typecheck + eslint + circular + spell（新增文件须 0 error）
pnpm test:unit      # Vitest
pnpm build:antd     # 生产构建（必须走根目录 turbo，先建 @core 工作区包；
                    # 直接 cd apps/web-antd && pnpm build 会因 @vben-core/design 无 dist 失败）
```

> 既有基线：`media/*` 的 typecheck 错误是历史遗留，与本次无关，勿动。

---

## 7. 边界与坑（必读）

1. **8s 窗口（手动模式）**：后端 `future.get(8s)`。手动模式必须在 `clientcmd.invite` 后 8s 内点推流，否则平台已 `cleanupFailed` 关掉收流端口，推流喂不进。前端用倒计时显式提醒；**联调推荐 `auto=true`** 规避时序。
2. **路径是后端进程视角**：ffmpeg 路径 / 视频文件路径是**后端运行机器**上的绝对路径，不是浏览器本地路径。前端只是把字符串透传，文件是否存在由后端 `validateFile` 校验并返回错误。
3. **越界校验在后端**：若后端配了 `allowed-root`，越界路径会被后端拒（400/500），`requestClient` 统一弹错；前端不必复刻白名单逻辑。
4. **status 轮询节流**：仅 RUNNING 轮询，状态切换即停，避免页面常驻空转请求。
5. **SSE 不改 composable**：`clientcmd.push.*` 已在 `config.topics`，`useSseEvents` 动态订阅；新 topic 不需要改 `useSseEvents.ts`。但 `dedupKey` 用 `callId` 兜底，push 事件含 callId，去重正常。
6. **TS-over-RTP 非 PS**：后端用 ffmpeg `rtp_mpegts`（见后端方案 §7），前端无感知，但联调时若 ZLM 收不到流，先排查后端 ffmpeg 命令 / ZLM rtpPort，不是前端问题。
7. **lab 未开启**：生产 profile 下 `/lab/client/*` 端点不存在（404），`getLabConfig` 会失败 → 页面已有「lab 未就绪」兜底，push 区随 config 为空而不渲染/禁用。
8. **测试 mock 必须同步扩**：ClientPanel 一旦 import 三个 push 函数并在 watcher 同步调 `labPushStatus`，现有 `ClientPanel.test.ts` 的 `vi.mock('#/api/protocol-lab')` 工厂若不补这三 key，**21 个既有用例随挂载全崩**。这是落地的第一道坎，先扩 mock 再动组件（详见 §5）。

---

## 8. 落地清单

- [ ] `api/protocol-lab.ts`：`LabConfig` 扩展 3 字段 + `PushStartReq`/`PushStatus` 类型 + 三函数
- [ ] `ClientPanel.vue`：模拟推流折叠区（路径输入 + 启停 + 倒计时 + 目标/日志展示）+ 状态轮询 + 卸载清理
- [ ] `protocolLab.json`（zh-CN / en-US）：`push.*` + `msg.push*` 键
- [ ] `SipTimeline.vue`（可选）：`clientcmd.push.failed` 红色样式
- [ ] 先扩 `ClientPanel.test.ts` 的 `vi.mock('#/api/protocol-lab')` 工厂 + `vi.hoisted` spy，补 `labPushStart/labPushStop/labPushStatus`（`labPushStatus` 默认 resolve `{state:'IDLE'}`），保现有 21 用例不崩
- [ ] 单测：`protocol-lab.test.ts` push 三函数 + `ClientPanel.test.ts` 交互
- [ ] 门禁：`pnpm check` 0 error + `pnpm build:antd` 绿
- [ ] 端到端：`dev,repo,inte,lab` 启动 + 真实 ffmpeg/ZLM → 平台点播 → 自动推流 → flv 可播；手动模式 8s 窗内点验
