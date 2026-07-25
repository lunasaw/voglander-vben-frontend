import { describe, expect, it } from 'vitest';

import taskCenterSource from '../../views/task/center/list.vue?raw';
import enUS from '../langs/en-US/task.json';
import zhCN from '../langs/zh-CN/task.json';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('task-center i18n', () => {
  it('keeps Chinese and English task keys symmetric', () => {
    expect(leafKeys(zhCN).toSorted()).toEqual(leafKeys(enUS).toSorted());
  });

  it('does not put user-facing Chinese copy directly in the task view', () => {
    expect(taskCenterSource).not.toMatch(/[\u4E00-\u9FFF]/);
  });
});
