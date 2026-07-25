import { describe, expect, it } from 'vitest';

import {
  getTaskTypeAdapter,
  registerTaskTypeAdapter,
  UNKNOWN_TASK_TYPE_ADAPTER,
} from '../registry';

describe('task type registry', () => {
  it('provides localized label, icon, domain route and result renderer for known types', () => {
    const adapter = getTaskTypeAdapter('IMAGE_COLLECTION');

    expect(adapter.labelKey).toBe('task.center.type.imageCollection');
    expect(adapter.icon).toBe('lucide:images');
    expect(adapter.detailRoute?.({ taskId: 'btask_1' })).toBe(
      '/image/collections?taskId=btask_1',
    );
    expect(adapter.resultRenderer).toEqual(expect.any(Function));
  });

  it('returns a generic fallback for a future unknown Handler type', () => {
    const adapter = getTaskTypeAdapter('FUTURE_HANDLER');

    expect(adapter).toBe(UNKNOWN_TASK_TYPE_ADAPTER);
    expect(adapter.labelKey).toBe('task.center.detail.unknownType');
    expect(adapter.icon).toBe('lucide:circle-help');
    expect(adapter.detailRoute?.({ taskId: 'btask_1' })).toBeUndefined();
    expect(adapter.resultRenderer?.()).toBeUndefined();
  });

  it('allows domain modules to register an adapter without task-center conditionals', () => {
    registerTaskTypeAdapter('CUSTOM_DOMAIN', {
      labelKey: 'task.center.detail.unknownType',
      icon: 'lucide:box',
    });

    expect(getTaskTypeAdapter('CUSTOM_DOMAIN').icon).toBe('lucide:box');
  });
});
