# Voglander 级联管理前端技术方案

## 一、方案概述

本方案为 Voglander GB28181 平台级联功能提供完整的前端管理界面，基于 Vue 3 + Vben Admin 框架实现上级平台配置、通道映射、注册状态监控等功能。

**核心目标**:

- 上级平台 CRUD（配置 SIP 连接参数、启停注册调度）
- 通道映射 CRUD（本地通道→上级编码映射）
- 注册状态实时展示（在线/离线、心跳倒计时）
- 订阅管理可视化（目录/告警/位置订阅清单）

---

## 二、技术栈

| 技术           | 版本 | 用途       |
| -------------- | ---- | ---------- |
| Vue            | 3.x  | 前端框架   |
| Vben Admin     | 最新 | 中后台模板 |
| TypeScript     | 5.x  | 类型安全   |
| Ant Design Vue | 4.x  | UI 组件库  |
| Vue I18n       | 9.x  | 国际化     |
| Axios          | 1.x  | HTTP 请求  |

---

## 三、页面结构

### 3.1 路由设计

```
/cascade                      # 级联管理（一级菜单）
  ├── /platform              # 上级平台管理
  └── /channel               # 级联通道管理
```

### 3.2 页面功能清单

#### 1. 上级平台管理 (`/cascade/platform`)

**核心功能**:

- **列表展示**: 平台列表（平台ID/名称/服务器IP/端口/启用状态）
- **筛选**: 按启用状态筛选（全部/已启用/已停用）
- **新增**: 配置上级平台 SIP 参数（服务器地址/本地客户端ID/传输协议/认证信息/注册周期/心跳间隔）
- **编辑**: 修改平台配置（平台ID不可改）
- **启停**: 启用平台（触发注册调度）/ 停用平台（停止调度+注销）
- **删除**: 删除平台配置
- **刷新调度**: 批量重载 enabled=1 平台的注册任务

**表单字段**: | 字段 | 类型 | 必填 | 说明 | |------|------|------|------| | platformId | string | 是 | 上级平台ID（国标20位） | | platformName | string | 否 | 平台名称 | | serverIp | string | 是 | 上级服务器IP | | serverPort | number | 是 | 上级服务器端口（默认5060） | | serverDomain | string | 否 | 上级服务器域名 | | localClientId | string | 是 | 本地客户端ID（国标20位） | | localClientIp | string | 否 | 本地客户端IP | | localClientPort | number | 否 | 本地客户端端口 | | transport | enum | 否 | 传输协议（UDP/TCP，默认UDP） | | username | string | 否 | 认证用户名 | | password | string | 否 | 认证密码 | | registerExpires | number | 否 | 注册有效期（秒，默认3600） | | keepaliveInterval | number | 否 | 心跳间隔（秒，默认60） |

#### 2. 级联通道管理 (`/cascade/channel`)

**核心功能**:

- **列表展示**: 通道映射列表（上级平台/本地设备ID/本地通道ID/级联通道ID/级联名称）
- **筛选**: 按上级平台筛选
- **新增**: 创建通道映射（本地通道→上级编码映射）
- **编辑**: 修改级联通道ID和名称（platformId/localDeviceId/localChannelId不可改）
- **删除**: 删除通道映射

**表单字段**: | 字段 | 类型 | 必填 | 说明 | |------|------|------|------| | platformId | string | 是 | 上级平台ID（下拉选择） | | localDeviceId | string | 是 | 本地设备ID | | localChannelId | string | 是 | 本地通道ID | | cascadeChannelId | string | 是 | 对上级暴露的通道编码（国标20位） | | cascadeName | string | 否 | 对上级暴露的通道名称 |

---

## 四、API 接口

### 4.1 上级平台管理 API

**Base URL**: `/api/v1/cascade/platform`

| 接口     | 方法   | 路径            | 说明                                  |
| -------- | ------ | --------------- | ------------------------------------- |
| 新增平台 | POST   | `/`             | 创建上级平台配置                      |
| 更新平台 | PUT    | `/{id}`         | 更新平台配置                          |
| 删除平台 | DELETE | `/{id}`         | 删除平台                              |
| 查询详情 | GET    | `/{id}`         | 获取平台详情                          |
| 分页查询 | GET    | `/page`         | 分页查询（参数: page, size, enabled） |
| 启用平台 | POST   | `/{id}/enable`  | 启用平台并启动注册调度                |
| 停用平台 | POST   | `/{id}/disable` | 停用平台并停止注册调度                |
| 刷新调度 | POST   | `/refresh`      | 批量刷新注册调度                      |

### 4.2 级联通道管理 API

**Base URL**: `/api/v1/cascade/channel`

| 接口     | 方法   | 路径    | 说明                                     |
| -------- | ------ | ------- | ---------------------------------------- |
| 新增通道 | POST   | `/`     | 创建通道映射                             |
| 更新通道 | PUT    | `/{id}` | 更新通道映射                             |
| 删除通道 | DELETE | `/{id}` | 删除通道映射                             |
| 查询详情 | GET    | `/{id}` | 获取通道详情                             |
| 分页查询 | GET    | `/page` | 分页查询（参数: page, size, platformId） |

---

## 五、目录结构

```
src/
├── api/
│   └── cascade/
│       ├── platform.ts          # 平台管理 API
│       └── channel.ts           # 通道管理 API
├── views/
│   └── cascade/
│       ├── platform/
│       │   └── index.vue        # 平台管理页面
│       └── channel/
│           └── index.vue        # 通道管理页面
├── locales/
│   ├── zh-CN/
│   │   └── cascade.json         # 中文国际化
│   └── en-US/
│       └── cascade.json         # 英文国际化
└── router/
    └── routes/
        └── modules/
            └── cascade.ts       # 级联路由配置
```

---

## 六、数据模型

### 6.1 平台配置 DTO

```typescript
interface CascadePlatformDTO {
  id?: number;
  platformId?: string;
  platformName?: string;
  serverIp?: string;
  serverPort?: number;
  serverDomain?: string;
  localClientId?: string;
  localClientIp?: string;
  localClientPort?: number;
  transport?: string;
  username?: string;
  password?: string;
  registerExpires?: number;
  keepaliveInterval?: number;
  enabled?: number; // 0-停用 1-启用
  createTime?: string;
  updateTime?: string;
}
```

### 6.2 通道映射 DTO

```typescript
interface CascadeChannelDTO {
  id?: number;
  platformId?: string;
  localDeviceId?: string;
  localChannelId?: string;
  cascadeChannelId?: string;
  cascadeName?: string;
  createTime?: string;
  updateTime?: string;
}
```

---

## 七、国际化 (i18n)

### 7.1 中文 (zh-CN)

```json
{
  "cascade": {
    "platform": {
      "title": "上级平台管理",
      "add": "新增上级平台",
      "edit": "编辑上级平台",
      "platformId": "平台ID",
      "platformName": "平台名称",
      "serverIp": "服务器IP",
      "serverPort": "服务器端口",
      "localClientId": "本地客户端ID",
      "enabled": "启用状态",
      "refreshScheduler": "刷新调度"
    },
    "channel": {
      "title": "级联通道管理",
      "add": "新增通道映射",
      "localDeviceId": "本地设备ID",
      "localChannelId": "本地通道ID",
      "cascadeChannelId": "级联通道ID",
      "cascadeName": "级联名称"
    }
  }
}
```

### 7.2 英文 (en-US)

```json
{
  "cascade": {
    "platform": {
      "title": "Cascade Platform Management",
      "add": "Add Platform",
      "platformId": "Platform ID",
      "serverIp": "Server IP",
      "enabled": "Status"
    },
    "channel": {
      "title": "Cascade Channel Management",
      "cascadeChannelId": "Cascade Channel ID"
    }
  }
}
```

---

## 八、菜单配置

### 8.1 菜单 SQL

```sql
-- 1. 级联管理一级菜单
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `path`, `component`,
  `menu_type`, `visible`, `status`, `perms`, `icon`
) VALUES (
  '级联管理', 0, 50, 'cascade', NULL,
  'M', '0', '0', NULL, 'cluster'
);

SET @cascade_parent_id = LAST_INSERT_ID();

-- 2. 上级平台管理子菜单
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `path`, `component`,
  `menu_type`, `visible`, `status`, `perms`, `icon`
) VALUES (
  '上级平台管理', @cascade_parent_id, 1, 'platform', 'cascade/platform/index',
  'C', '0', '0', 'cascade:platform:list', 'cloud-server'
);

SET @platform_menu_id = LAST_INSERT_ID();

-- 3. 上级平台权限按钮
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `menu_type`, `perms`
) VALUES
  ('新增平台', @platform_menu_id, 1, 'F', 'cascade:platform:add'),
  ('修改平台', @platform_menu_id, 2, 'F', 'cascade:platform:edit'),
  ('删除平台', @platform_menu_id, 3, 'F', 'cascade:platform:remove'),
  ('启用平台', @platform_menu_id, 4, 'F', 'cascade:platform:enable'),
  ('停用平台', @platform_menu_id, 5, 'F', 'cascade:platform:disable');

-- 4. 级联通道管理子菜单
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `path`, `component`,
  `menu_type`, `visible`, `status`, `perms`, `icon`
) VALUES (
  '级联通道管理', @cascade_parent_id, 2, 'channel', 'cascade/channel/index',
  'C', '0', '0', 'cascade:channel:list', 'api'
);

SET @channel_menu_id = LAST_INSERT_ID();

-- 5. 级联通道权限按钮
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `menu_type`, `perms`
) VALUES
  ('新增通道', @channel_menu_id, 1, 'F', 'cascade:channel:add'),
  ('修改通道', @channel_menu_id, 2, 'F', 'cascade:channel:edit'),
  ('删除通道', @channel_menu_id, 3, 'F', 'cascade:channel:remove');
```

---

## 九、交互流程

### 9.1 上级平台配置流程

```
用户操作流程:
1. 进入"上级平台管理"页面
2. 点击"新增上级平台"
3. 填写表单（平台ID/服务器地址/本地客户端ID/传输协议等）
4. 保存 → 后端创建平台记录（enabled=0）
5. 点击"启用" → 后端 enabled=1 + 启动注册调度
6. 调度器自动发起 REGISTER + 周期性 MESSAGE(Keepalive)
7. 页面展示启用状态（绿色Tag）
```

### 9.2 通道映射配置流程

```
用户操作流程:
1. 进入"级联通道管理"页面
2. 点击"新增通道映射"
3. 选择上级平台（下拉选择 enabled=1 的平台）
4. 填写本地设备ID/通道ID + 级联通道ID（对上级暴露的编码）
5. 保存 → 后端创建映射记录
6. 上级查询目录时，返回 cascadeChannelId（非 localChannelId）
7. 上级点播/控制时，后端根据 cascadeChannelId 反查 localChannelId 并转发
```

---

## 十、UI 设计要点

### 10.1 平台管理页面

- **列表视图**: 平台ID（主键） / 名称 / 服务器地址 / 启用状态（Tag组件）/ 操作
- **状态展示**:
  - 已启用: 绿色Tag + "停用"按钮
  - 已停用: 红色Tag + "启用"按钮
- **表单布局**: 双列布局（服务器配置 + 本地配置 + 认证配置 + 心跳配置）
- **操作按钮**:
  - 主操作: 新增、刷新调度
  - 行操作: 编辑、启停、删除

### 10.2 通道管理页面

- **列表视图**: 上级平台 / 本地设备ID / 本地通道ID / 级联通道ID / 级联名称 / 操作
- **筛选**: 上级平台下拉（Select组件，显示 platformName）
- **表单布局**: 单列布局
- **字段提示**: cascadeChannelId 下方提示"对上级平台暴露的通道编码，符合国标20位规则"

---

## 十一、实施步骤

### 阶段 1: 后端 API 验证（已完成）

- [x] CascadePlatformController 8 接口
- [x] CascadeChannelController 5 接口
- [x] 全量编译通过
- [x] 单元测试全绿（61 tests）

### 阶段 2: 前端开发（待实施）

1. **API 层**:
   - `src/api/cascade/platform.ts` (平台API)
   - `src/api/cascade/channel.ts` (通道API)
2. **页面组件**:
   - `src/views/cascade/platform/index.vue` (平台管理)
   - `src/views/cascade/channel/index.vue` (通道管理)
3. **路由配置**:
   - `src/router/routes/modules/cascade.ts`
4. **国际化**:
   - `src/locales/zh-CN/cascade.json`
   - `src/locales/en-US/cascade.json`
5. **菜单注册**:
   - 执行 `menu.sql` 注册菜单权限

### 阶段 3: 集成测试

- [ ] 平台 CRUD 功能验证
- [ ] 通道 CRUD 功能验证
- [ ] 启停调度功能验证
- [ ] 分页/筛选功能验证
- [ ] 权限控制验证

### 阶段 4: 联调测试

- [ ] 配置真实上级平台
- [ ] 验证注册保活流程
- [ ] 验证目录查询响应
- [ ] 验证订阅推送流程
- [ ] 验证点播转发流程

---

## 十二、注意事项

### 12.1 表单校验

- **平台ID**: 必填，国标20位格式校验（正则: `^[0-9]{20}$`）
- **服务器IP**: 必填，IPv4格式校验
- **端口号**: 必填，范围 1-65535
- **注册周期**: 建议 60-3600 秒
- **心跳间隔**: 建议 10-300 秒

### 12.2 业务规则

- **启用平台**: 启用前需确保配置完整（IP/端口/客户端ID不能为空）
- **停用平台**: 停用会立即停止注册任务并发送注销请求
- **删除平台**: 删除前需先停用，且无关联通道映射
- **通道映射**: platformId/localDeviceId/localChannelId 组合唯一

### 12.3 错误处理

- **网络错误**: 统一 message.error 提示
- **表单验证**: Ant Design Form 内置校验
- **操作失败**: 后端返回具体错误信息，前端展示

---

## 十三、扩展功能（可选）

### 13.1 注册状态监控

- 实时展示平台注册状态（在线/离线）
- 心跳倒计时展示（距离下次心跳剩余时间）
- 注册失败原因展示（401/403/超时等）

### 13.2 订阅管理

- 订阅清单展示（目录/告警/位置）
- 订阅有效期倒计时
- 手动续订功能

### 13.3 日志查看

- 平台注册日志（REGISTER/200OK）
- 心跳日志（MESSAGE/Keepalive）
- 订阅日志（SUBSCRIBE/NOTIFY）

---

## 十四、参考资料

- **后端 API 文档**: `/api/v1/doc.html` (Swagger UI)
- **Vben Admin 文档**: https://doc.vben.pro/
- **Ant Design Vue 文档**: https://www.antdv.com/
- **GB/T 28181-2022 标准**: 级联协议规范

---

## 十五、联系方式

- **技术负责人**: luna
- **后端仓库**: voglander-workstation/voglander
- **前端仓库**: voglander-workstation/vue-vben-admin
- **文档版本**: 1.0.8
- **更新日期**: 2026-06-15
