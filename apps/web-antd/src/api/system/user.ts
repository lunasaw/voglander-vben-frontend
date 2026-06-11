import type { SystemRoleApi } from './role';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  /** 用户信息 */
  export interface UserInfo {
    [key: string]: any;
    id: number;
    username: string;
    nickname?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    status: 0 | 1;
    roles?: SystemRoleApi.SystemRole[];
    createTime?: string;
    updateTime?: string;
  }

  /** 用户详情 */
  export interface UserVO {
    [key: string]: any;
    id: number;
    username: string;
    nickname?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    status: 0 | 1;
    roles?: SystemRoleApi.SystemRole[];
    createTime?: string;
    updateTime?: string;
  }

  /** 用户列表响应 */
  export interface UserListResp {
    list: UserVO[];
    total: number;
    pageNum: number;
    pageSize: number;
  }

  /** 用户创建请求 */
  export interface UserCreateReq {
    username: string;
    password: string;
    nickname?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    status: 0 | 1;
  }

  /** 用户更新请求 */
  export interface UserUpdateReq {
    id: number;
    password?: string;
    nickname?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    status: 0 | 1;
  }

  /** 用户查询参数 */
  export interface UserQueryParams {
    username?: string;
    nickname?: string;
    email?: string;
    phone?: string;
    status?: 0 | 1;
    pageNum?: number;
    pageSize?: number;
  }
}

/**
 * 获取当前用户信息
 */
async function getUserInfo() {
  return requestClient.get<SystemUserApi.UserInfo>('/user/info');
}

/**
 * 分页查询用户列表
 */
async function getUserList(params: SystemUserApi.UserQueryParams) {
  return requestClient.get<SystemUserApi.UserListResp>('/user/list', {
    params,
  });
}

/**
 * 根据ID获取用户详情
 */
async function getUserById(id: number) {
  return requestClient.get<SystemUserApi.UserVO>(`/user/${id}`);
}

/**
 * 创建用户
 */
async function createUser(data: SystemUserApi.UserCreateReq) {
  return requestClient.post<number>('/user', data);
}

/**
 * 更新用户
 */
async function updateUser(
  id: number,
  data: Omit<SystemUserApi.UserUpdateReq, 'id'>,
) {
  return requestClient.put<boolean>(`/user/${id}`, data);
}

/**
 * 删除用户
 */
async function deleteUser(id: number) {
  return requestClient.delete<boolean>(`/user/${id}`);
}

/**
 * 检查用户名是否存在
 */
async function checkUsername(username: string, excludeId?: number) {
  const params = excludeId ? { excludeId } : {};
  return requestClient.get<boolean>(`/user/check-username/${username}`, {
    params,
  });
}

/**
 * 检查邮箱是否存在
 */
async function checkEmail(email: string, excludeId?: number) {
  const params = excludeId ? { excludeId } : {};
  return requestClient.get<boolean>(`/user/check-email/${email}`, { params });
}

/**
 * 检查手机号是否存在
 */
async function checkPhone(phone: string, excludeId?: number) {
  const params = excludeId ? { excludeId } : {};
  return requestClient.get<boolean>(`/user/check-phone/${phone}`, { params });
}

export {
  checkEmail,
  checkPhone,
  checkUsername,
  createUser,
  deleteUser,
  getUserById,
  getUserInfo,
  getUserList,
  updateUser,
};
