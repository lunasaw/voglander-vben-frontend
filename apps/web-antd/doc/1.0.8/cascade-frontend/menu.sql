-- 级联管理菜单 SQL
-- 适用于 Voglander 系统菜单表 tb_menu

-- 1. 级联管理一级菜单
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `path`, `component`,
  `is_frame`, `is_cache`, `menu_type`, `visible`, `status`,
  `perms`, `icon`, `create_time`, `update_time`, `remark`
) VALUES (
  '级联管理', 0, 50, 'cascade', NULL,
  1, 0, 'M', '0', '0',
  NULL, 'cluster', NOW(), NOW(), '级联平台与通道管理'
);

-- 获取上面插入的一级菜单ID(假设为 @cascade_parent_id)
SET @cascade_parent_id = LAST_INSERT_ID();

-- 2. 上级平台管理子菜单
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `path`, `component`,
  `is_frame`, `is_cache`, `menu_type`, `visible`, `status`,
  `perms`, `icon`, `create_time`, `update_time`, `remark`
) VALUES (
  '上级平台管理', @cascade_parent_id, 1, 'platform', 'cascade/platform/index',
  1, 0, 'C', '0', '0',
  'cascade:platform:list', 'cloud-server', NOW(), NOW(), '级联上级平台配置管理'
);

SET @platform_menu_id = LAST_INSERT_ID();

-- 3. 上级平台管理权限按钮
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `path`, `component`,
  `is_frame`, `is_cache`, `menu_type`, `visible`, `status`,
  `perms`, `icon`, `create_time`, `update_time`, `remark`
) VALUES
  ('新增平台', @platform_menu_id, 1, '', NULL, 1, 0, 'F', '0', '0', 'cascade:platform:add', '#', NOW(), NOW(), ''),
  ('修改平台', @platform_menu_id, 2, '', NULL, 1, 0, 'F', '0', '0', 'cascade:platform:edit', '#', NOW(), NOW(), ''),
  ('删除平台', @platform_menu_id, 3, '', NULL, 1, 0, 'F', '0', '0', 'cascade:platform:remove', '#', NOW(), NOW(), ''),
  ('启用平台', @platform_menu_id, 4, '', NULL, 1, 0, 'F', '0', '0', 'cascade:platform:enable', '#', NOW(), NOW(), ''),
  ('停用平台', @platform_menu_id, 5, '', NULL, 1, 0, 'F', '0', '0', 'cascade:platform:disable', '#', NOW(), NOW(), ''),
  ('刷新调度', @platform_menu_id, 6, '', NULL, 1, 0, 'F', '0', '0', 'cascade:platform:refresh', '#', NOW(), NOW(), '');

-- 4. 级联通道管理子菜单
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `path`, `component`,
  `is_frame`, `is_cache`, `menu_type`, `visible`, `status`,
  `perms`, `icon`, `create_time`, `update_time`, `remark`
) VALUES (
  '级联通道管理', @cascade_parent_id, 2, 'channel', 'cascade/channel/index',
  1, 0, 'C', '0', '0',
  'cascade:channel:list', 'api', NOW(), NOW(), '级联通道映射管理'
);

SET @channel_menu_id = LAST_INSERT_ID();

-- 5. 级联通道管理权限按钮
INSERT INTO `tb_menu` (
  `menu_name`, `parent_id`, `order_num`, `path`, `component`,
  `is_frame`, `is_cache`, `menu_type`, `visible`, `status`,
  `perms`, `icon`, `create_time`, `update_time`, `remark`
) VALUES
  ('新增通道', @channel_menu_id, 1, '', NULL, 1, 0, 'F', '0', '0', 'cascade:channel:add', '#', NOW(), NOW(), ''),
  ('修改通道', @channel_menu_id, 2, '', NULL, 1, 0, 'F', '0', '0', 'cascade:channel:edit', '#', NOW(), NOW(), ''),
  ('删除通道', @channel_menu_id, 3, '', NULL, 1, 0, 'F', '0', '0', 'cascade:channel:remove', '#', NOW(), NOW(), '');

-- 查询插入结果
SELECT
  m1.menu_id AS '一级菜单ID',
  m1.menu_name AS '一级菜单名',
  m2.menu_id AS '二级菜单ID',
  m2.menu_name AS '二级菜单名',
  m3.menu_name AS '按钮权限'
FROM tb_menu m1
LEFT JOIN tb_menu m2 ON m2.parent_id = m1.menu_id
LEFT JOIN tb_menu m3 ON m3.parent_id = m2.menu_id
WHERE m1.menu_name = '级联管理'
ORDER BY m1.order_num, m2.order_num, m3.order_num;
