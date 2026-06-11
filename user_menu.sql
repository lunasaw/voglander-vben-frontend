-- 用户管理菜单权限SQL

-- 插入用户管理菜单 (假设系统管理的ID为200，用户管理使用203)
INSERT INTO tb_menu (id, parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_order, visible, status, permission, meta)
VALUES (203, 200, 'SystemUser', 'SystemUser', 2, '/system/user', '/system/user/list', 'User', 3, 1, 1, 'System:User:List', JSON_OBJECT('title', 'system.user.title'));

-- 插入用户管理按钮权限
INSERT INTO tb_menu (id, parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_order, visible, status, permission, meta)
VALUES
-- 用户管理按钮
(20501, 203, 'SystemUserCreate', 'SystemUserCreate', 3, '', '', '', 1, 1, 1, 'System:User:Create', JSON_OBJECT('title', 'common.create')),
(20502, 203, 'SystemUserEdit', 'SystemUserEdit', 3, '', '', '', 2, 1, 1, 'System:User:Edit', JSON_OBJECT('title', 'common.edit')),
(20503, 203, 'SystemUserDelete', 'SystemUserDelete', 3, '', '', '', 3, 1, 1, 'System:User:Delete', JSON_OBJECT('title', 'common.delete'));

-- 注释说明：
-- id: 菜单ID，用户管理菜单使用203，按钮权限使用20501-20503
-- parent_id: 父菜单ID，203为用户管理菜单的ID，200为系统管理的ID
-- menu_code: 菜单编码，用于前端路由识别
-- menu_name: 菜单名称，与menu_code保持一致
-- menu_type: 菜单类型，1=目录，2=菜单，3=按钮
-- path: 路由路径，菜单页面需要指定，按钮留空
-- component: 组件路径，指向实际的Vue组件文件
-- icon: 图标名称，用于前端显示
-- sort_order: 排序值，控制菜单显示顺序
-- visible: 是否可见，1=可见，0=隐藏
-- status: 状态，1=启用，0=禁用
-- permission: 权限标识，用于权限控制
-- meta: 元数据，JSON格式，包含标题等信息
