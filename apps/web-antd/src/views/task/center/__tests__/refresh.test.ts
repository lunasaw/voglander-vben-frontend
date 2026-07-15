import { describe, expect, it, vi } from 'vitest';

import { createTaskRefreshCoalescer } from '../refresh';

describe('task-center SSE refresh', () => {
  it('coalesces bursts into one refresh within 300ms', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const coalescer = createTaskRefreshCoalescer(refresh);

    coalescer.schedule();
    coalescer.schedule();
    coalescer.schedule();
    vi.advanceTimersByTime(299);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    coalescer.dispose();
    vi.useRealTimers();
  });

  it('flushes immediately on reconnect so the database is queried as source of truth', () => {
    const refresh = vi.fn();
    const coalescer = createTaskRefreshCoalescer(refresh);

    coalescer.onReconnect();

    expect(refresh).toHaveBeenCalledTimes(1);
    coalescer.dispose();
  });
});
