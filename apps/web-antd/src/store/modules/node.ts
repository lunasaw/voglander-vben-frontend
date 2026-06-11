import { ref } from 'vue';

import { defineStore } from 'pinia';

export const useNodeStore = defineStore('node', () => {
  // 当前选择的节点Key
  const currentNodeKey = ref<null | string>(null);

  // 设置当前节点Key
  function setCurrentNodeKey(nodeKey: null | string) {
    currentNodeKey.value = nodeKey;
  }

  // 获取当前节点Key
  function getCurrentNodeKey() {
    return currentNodeKey.value;
  }

  // 清除当前节点Key
  function clearCurrentNodeKey() {
    currentNodeKey.value = null;
  }

  return {
    currentNodeKey,
    setCurrentNodeKey,
    getCurrentNodeKey,
    clearCurrentNodeKey,
  };
});
