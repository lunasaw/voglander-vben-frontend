// 全局节点状态管理 - 用于请求拦截器
let currentNodeKey: null | string = null;

export function setCurrentNodeKey(nodeKey: null | string) {
  currentNodeKey = nodeKey;
}

export function getCurrentNodeKey(): null | string {
  return currentNodeKey;
}

export function clearCurrentNodeKey() {
  currentNodeKey = null;
}
