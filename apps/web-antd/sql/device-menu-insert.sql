/*
 GB28181 设备管理菜单 + 按钮权限（S4，1.0.7）
 ----------------------------------------------------------------------------
 ⚠️ 权威来源：本菜单已并入后端 voglander/sql/voglander-sqlite.sql 与 voglander.sql
    （ProtocolLab 块之后、全量授权语句之前，ID 500 段）。后端导库即生效，
    本文件仅作前端侧参考/补丁，ID 与后端保持一致。

 与前端 hasAccessByCodes 引用的权限码严格对齐（views/device/*）：
   Device:Device:Query   详情/列表查看
   Device:Device:Edit    编辑设备（PUT /device/update）
   Device:Device:Delete  删除/批量删除设备（DELETE /device/delete、/device/deleteIds）
   Device:Subscription:Edit  目录/位置/告警订阅开关（PUT /device/subscription/toggle，1.0.7 §9.11）
   Device:Channel:Edit   编辑通道（PUT /deviceChannel/update）
   Device:Channel:Delete 删除/批量删除/清离线通道（DELETE /deviceChannel/deleteOne、/deleteBatch）
   Device:Cmd:Live       实时点播（复用 /live）
   Device:Cmd:Ptz        云台控制（复用 /ptz）
   Device:Cmd:Query      查目录/信息/状态/预置位/移动位置
   Device:Cmd:Config     配置下载/下发
   Device:Cmd:Record     录像开始/停止/查询
   Device:Cmd:Alarm      报警查询/复位
   Device:Cmd:Broadcast  语音广播

 ID 段：目录 500 / 列表 501 / 通道列表 502（钻取页，hideInMenu）/ 列表按钮 50101+ / 通道按钮 50201+（避开 ProtocolLab 的 400/401、Media 的 300 段、System 的 200 段）。
 路由 menu_code 用后端 PascalCase（Device / DeviceList），与 accessMode='backend' 下发一致。
 i18n 文案 key 走 device.*（locales/langs/{zh-CN,en-US}/device.json）。
 幂等：INSERT OR IGNORE，可重复执行。
*/

PRAGMA foreign_keys = OFF;

-- 设备管理目录 + 列表页
INSERT OR IGNORE INTO tb_menu (id, parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_order,
                               status, permission, meta)
VALUES
-- Device 设备管理目录
(500, 0, 'Device', 'device.menu', 1, '/device', '', 'mdi:cctv', 9994, 1, '',
 '{"icon": "mdi:cctv", "order": 9994, "title": "device.menu", "hideInMenu": false}'),

-- 设备列表
(501, 500, 'DeviceList', 'device.title', 2, '/device/list', '/device/list', 'mdi:cctv', 1, 1,
 'Device:Device:Query',
 '{"icon": "mdi:cctv", "title": "device.title", "hideInMenu": false}'),

-- 设备通道列表（S5 钻取页，隐藏于菜单，由设备列表「通道数」path 导航进入）
(502, 500, 'DeviceChannelList', 'device.channel.title', 2, '/device/channel/:deviceId', '/device/channel/list',
 'mdi:video-input-component', 2, 1, 'Device:Device:Query',
 '{"icon": "mdi:video-input-component", "title": "device.channel.title", "hideInMenu": true}');

-- 设备管理按钮权限（menu_type=3，隐藏，仅用于鉴权）
INSERT OR IGNORE INTO tb_menu (id, parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_order,
                               status, permission, meta)
VALUES
(50101, 501, 'DeviceDetail', 'device.action.detail', 3, null, null, '', 1, 1, 'Device:Device:Query',
 '{"title": "device.action.detail", "hideInMenu": true}'),
(50102, 501, 'DeviceLive', 'device.action.live', 3, null, null, '', 2, 1, 'Device:Cmd:Live',
 '{"title": "device.action.live", "hideInMenu": true}'),
(50103, 501, 'DevicePtz', 'device.section.ptz', 3, null, null, '', 3, 1, 'Device:Cmd:Ptz',
 '{"title": "device.section.ptz", "hideInMenu": true}'),
(50104, 501, 'DeviceQuery', 'device.section.query', 3, null, null, '', 4, 1, 'Device:Cmd:Query',
 '{"title": "device.section.query", "hideInMenu": true}'),
(50105, 501, 'DeviceConfig', 'device.section.config', 3, null, null, '', 5, 1, 'Device:Cmd:Config',
 '{"title": "device.section.config", "hideInMenu": true}'),
(50106, 501, 'DeviceRecord', 'device.section.record', 3, null, null, '', 6, 1, 'Device:Cmd:Record',
 '{"title": "device.section.record", "hideInMenu": true}'),
(50107, 501, 'DeviceAlarm', 'device.section.alarm', 3, null, null, '', 7, 1, 'Device:Cmd:Alarm',
 '{"title": "device.section.alarm", "hideInMenu": true}'),
(50108, 501, 'DeviceBroadcast', 'device.action.broadcast', 3, null, null, '', 8, 1, 'Device:Cmd:Broadcast',
 '{"title": "device.action.broadcast", "hideInMenu": true}'),
(50109, 501, 'DeviceEdit', 'device.action.edit', 3, null, null, '', 9, 1, 'Device:Device:Edit',
 '{"title": "device.action.edit", "hideInMenu": true}'),
(50110, 501, 'DeviceDelete', 'device.action.delete', 3, null, null, '', 10, 1, 'Device:Device:Delete',
 '{"title": "device.action.delete", "hideInMenu": true}'),
(50111, 501, 'DeviceSubscription', 'device.section.subscribe', 3, null, null, '', 11, 1, 'Device:Subscription:Edit',
 '{"title": "device.section.subscribe", "hideInMenu": true}'),

-- 设备通道列表（502）按钮权限：编辑 / 删除（含批量删除、清离线，共用 Delete 权限码）
(50201, 502, 'DeviceChannelEdit', 'device.action.edit', 3, null, null, '', 1, 1, 'Device:Channel:Edit',
 '{"title": "device.action.edit", "hideInMenu": true}'),
(50202, 502, 'DeviceChannelDelete', 'device.action.delete', 3, null, null, '', 2, 1, 'Device:Channel:Delete',
 '{"title": "device.action.delete", "hideInMenu": true}');

-- 授予系统管理员角色（role_id=1）设备管理全部菜单/按钮
INSERT OR IGNORE INTO tb_role_menu (role_id, menu_id)
SELECT 1, id
FROM tb_menu
WHERE id IN (500, 501, 502, 50101, 50102, 50103, 50104, 50105, 50106, 50107, 50108, 50109, 50110, 50111, 50201, 50202);
