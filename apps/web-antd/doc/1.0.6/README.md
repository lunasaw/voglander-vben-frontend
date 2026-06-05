# Voglander 架构文档 · v1.0.6

> 本目录是 **web-antd 前端** 视角下、结合 **voglander 后端** 的系统架构文档。接口明细（请求/响应字段、示例）见同级 API 文档：[`../../api/voglander-api.md`](../../api/voglander-api.md)。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [01-系统架构总览.md](./01-系统架构总览.md) | 产品定位、多仓库工作区、依赖链、端到端数据流、技术栈与部署形态 |
| [02-后端架构.md](./02-后端架构.md) | voglander 分层架构、模块依赖、Controller 模板方法、AjaxResult 契约、鉴权、GB28181/ZLM/SSE 集成、控制器与端点全表 |
| [03-前端架构.md](./03-前端架构.md) | web-antd Monorepo 布局、API 层、请求客户端、适配器层、Schema 驱动页面、路由与权限、状态管理、i18n、SSE、媒体播放器 |
| [04-前后端集成与接口契约.md](./04-前后端集成与接口契约.md) | 前后端契约规则、URL 重写与代理、AjaxResult↔requestClient 对接、ZLM 多节点 X-Node-Key、时间戳约定、SSE 鉴权、字段映射对照 |

## 版本基线

| 组件                    | 版本              | 说明                     |
| ----------------------- | ----------------- | ------------------------ |
| 产品文档版本            | **1.0.6**         | 本文档集对应的产品迭代   |
| voglander 后端          | `1.0.2-SNAPSHOT`  | 根 `pom.xml`             |
| web-antd 前端           | `5.5.8`           | 基于 Vben Admin 5.x 模板 |
| sip-gateway / gb28181   | `1.8.0`           | command + 统一回调架构   |
| zlm-spring-boot-starter | `1.0.10-SNAPSHOT` | ZLMediaKit 集成          |

## 一句话架构

> Vue 3 (web-antd) 通过统一 `requestClient` 调用 voglander REST（`AjaxResult{code,msg,data}`、`code=0` 成功）；voglander 以 **Controller → Manager → Service → Repository** 分层编排业务，向上集成 **GB28181（sip-proxy）** 与 **ZLMediaKit（zlm starter）**，通过 **SSE** 向前端推送实时事件。

## 阅读建议

- 只想接口字段 → 直接看 [`voglander-api.md`](../../api/voglander-api.md)。
- 要改某个页面 → 先看 [03-前端架构](./03-前端架构.md) 的「标准 CRUD 页面结构」与 [04 契约](./04-前后端集成与接口契约.md)。
- 要加后端接口 → 先看 [02-后端架构](./02-后端架构.md) 的「Controller 模板方法规范」，再回 04 对齐前端契约。
