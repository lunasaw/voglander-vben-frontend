export interface AuthoritativeRefreshOptions {
  delay?: number;
  maxWait?: number;
}

/** Coalesces event hints into single-flight authoritative REST refreshes. */
export function createAuthoritativeRefresh(
  refresh: () => Promise<void> | void,
  options: AuthoritativeRefreshOptions = {},
) {
  const delay = options.delay ?? 300;
  const maxWait = Math.max(delay, options.maxWait ?? 1500);
  let dirty = false;
  let disposed = false;
  let firstDirtyAt: number | undefined;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    if (disposed || inFlight || !dirty) return;
    clearTimer();
    const elapsed = Date.now() - (firstDirtyAt ?? Date.now());
    timer = setTimeout(
      () => void execute(),
      Math.min(delay, maxWait - elapsed),
    );
  }

  async function execute() {
    clearTimer();
    if (disposed || inFlight || !dirty) return;
    dirty = false;
    firstDirtyAt = undefined;
    inFlight = true;
    try {
      await refresh();
    } finally {
      inFlight = false;
      if (dirty) schedule();
    }
  }

  function notify() {
    if (disposed) return;
    dirty = true;
    firstDirtyAt ??= Date.now();
    schedule();
  }

  function flush() {
    if (!dirty) {
      dirty = true;
      firstDirtyAt = Date.now();
    }
    return execute();
  }

  function dispose() {
    disposed = true;
    clearTimer();
  }

  return {
    dispose,
    flush,
    isDirty: () => dirty,
    isInFlight: () => inFlight,
    notify,
  };
}
