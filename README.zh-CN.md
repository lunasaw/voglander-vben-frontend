<div align="center">
  <h1>Voglander Admin · 前端</h1>
  <p>视频监控 / 流媒体管理平台的 Web 后台</p>

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue-3.x-42b883.svg)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)

</div>

[简体中文](./README.md) | [日本語](./README.ja-JP.md)

## 简介

本仓库是 **Voglander** 视频监控 / 流媒体平台的管理前端，基于 [Vue Vben Admin](https://github.com/vbenjs/vue-vben-admin) 5.x 二次开发。它通过统一的 `requestClient` 调用 voglander 后端的 REST 接口（`/api/*`、`/zlm/api/*`），驱动设备接入、流媒体调度、GB28181 协议链路验证与系统权限管理。

> 这是一个 **私有定制 fork**，主开发目标是 `apps/web-antd`（Ant Design Vue 版本）。其余 `web-ele` / `web-naive` / `playground` 来自上游模板，仅作样式与组件参考。

## 在产品中的位置

Voglander 由四个独立仓库组成，本仓库是其中的前端。后端将 GB28181（`sip-proxy`）与 ZLMediaKit（`zlm-spring-boot-starter`）集成进 `voglander`，前端通过 REST 与 SSE 与之对接：

```
sip-proxy ───────────────┐
                         ├──► voglander (后端) ◄──── REST /api/*、/zlm/api/* + SSE ──── vue-vben-admin (本仓库)
zlm-spring-boot-starter ──┘
```

前后端契约必须一致：新增或变更字段须前后端对齐，不得自行虚构接口与字段（详见 [`apps/web-antd/CLAUDE.md`](apps/web-antd/CLAUDE.md) 与 `.cursorrules`）。

## 核心功能

- **媒体管理**
  - 服务节点管理：ZLMediaKit 节点的注册、在线状态与多节点路由（`X-Node-Key`）
  - 视频流列表：实时流媒体列表、流详情、截图
  - 拉流代理 / 推流代理：拉流与推流代理的增删改查与在线状态监控
- **多协议媒体播放器**：HLS / FLV / Video.js 自动格式检测与播放器切换（`MediaPlayerManager`），支持实时在线人数与 URL 复制
- **GB28181 协议验证台**：左侧模拟设备端（Client）注册上报、右侧平台端（Server）下发指令，经真实 SIP 交互后可视化验证协议链路
- **系统管理**：用户、角色、菜单、部门管理，基于后端驱动的动态路由与 RBAC 双重权限校验
- **实时事件（SSE）**：设备注册、会话、指令、告警等事件实时推送，自动重连与去重
- **基础能力**：多主题切换、完善的国际化（中 / 英）、Schema 驱动的动态表单与 VXE Table 数据网格

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Vue 3 + TypeScript + Composition API |
| 构建 | Vite + Turborepo + pnpm workspace（Monorepo） |
| UI | Ant Design Vue（主）、Tailwind CSS |
| 状态 | Pinia（持久化 + 加密） |
| 路由 | Vue Router 4（后端驱动权限） |
| 表格 / 表单 | VXE Table、Schema 驱动动态表单 |
| 媒体 | Video.js、FLV.js、HLS.js |
| 图标 | `@vben/icons`（Lucide） |

## 目录结构

```
vue-vben-admin/
├── apps/
│   ├── web-antd/          # 主开发目标（Ant Design Vue）
│   │   ├── src/
│   │   │   ├── api/        # API 层：core / media / system / protocol-lab
│   │   │   ├── views/      # 页面：media / protocol-lab / system / dashboard
│   │   │   ├── components/ # 共享业务组件（MediaPlayer、NodeSelector…）
│   │   │   ├── composables/# 组合式函数（useSseEvents…）
│   │   │   ├── router/     # 路由模块定义
│   │   │   └── locales/    # 国际化（zh-CN / en-US）
│   │   ├── api/            # 后端 OpenAPI 参考（voglander-api.md）
│   │   └── doc/            # 架构与方案文档
│   ├── web-ele / web-naive # 上游模板参考版本
│   └── backend-mock/      # Nitro Mock 服务
├── packages/              # 共享库（@core / effects / 业务包）
├── internal/              # 构建与规范配置
└── playground/            # 样式与组件参考
```

## 快速开始

环境要求：**Node.js >= 20.10.0**、**pnpm >= 9.12.0**。

```bash
# 1. 安装依赖
npm i -g corepack
pnpm install

# 2. 启动开发服务（主目标 web-antd，默认端口 5666）
pnpm dev:antd

# 3. 生产构建
pnpm build:antd
```

开发态接口走 `/api` 前缀，由 Vite 代理转发至 voglander 后端（默认 `http://0.0.0.0:8081`）。如需对接本地后端，请参考各仓库构建顺序（见根目录 `CLAUDE.md`）。

## 代码质量

```bash
pnpm check          # 全部质量门禁（类型 / 依赖 / 循环依赖 / 拼写）
pnpm lint           # 代码检查
pnpm format         # 格式化
pnpm test:unit      # Vitest 单元测试
pnpm test:e2e       # Playwright E2E 测试
```

## 开发指南与文档

- 项目级开发规范、组件化模式、权限与 i18n 约定：[`CLAUDE.md`](CLAUDE.md)、[`apps/web-antd/CLAUDE.md`](apps/web-antd/CLAUDE.md)
- 系统架构文档：[`apps/web-antd/doc/1.0.6/README.md`](apps/web-antd/doc/1.0.6/README.md)（系统总览 / 前后端架构 / 接口契约）
- GB28181 协议验证台方案：[`apps/web-antd/doc/1.0.7/`](apps/web-antd/doc/1.0.7/)
- 后端接口参考：[`apps/web-antd/api/voglander-api.md`](apps/web-antd/api/voglander-api.md)

## 浏览器支持

支持现代浏览器，不支持 IE。本地开发推荐 `Chrome 80+`。

| Edge | Firefox | Chrome | Safari |
| :-: | :-: | :-: | :-: |
| last 2 versions | last 2 versions | last 2 versions | last 2 versions |

## 致谢与许可

本项目基于开源中后台模板 [Vue Vben Admin](https://github.com/vbenjs/vue-vben-admin)（[文档](https://doc.vben.pro/)）二次开发，感谢原作者 [@Vben](https://github.com/anncwb) 及其贡献者。

[MIT](./LICENSE) License.
