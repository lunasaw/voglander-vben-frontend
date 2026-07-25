import { describe, expect, it } from 'vitest';

import routes, {
  TASK_CENTER_COMPONENT,
  TASK_CENTER_PATH,
} from '../routes/modules/task';

describe('task-center route and backend menu mapping', () => {
  it('uses the component path registered by backend TaskCenter menu', () => {
    const group = routes[0];
    const center = group?.children?.[0];

    expect(group?.path).toBe('/task');
    expect(center?.path).toBe(TASK_CENTER_PATH);
    expect(TASK_CENTER_COMPONENT).toBe('/task/center/list');
    expect(center?.component).toBeDefined();
  });
});
