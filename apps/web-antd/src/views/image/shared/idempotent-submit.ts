import type { ApiRequestErrorMeta } from '#/api/request';

import { computed, ref } from 'vue';

import { ApiRequestError, toApiRequestErrorMeta } from '#/api/request';

export type IdempotentSubmitStatus =
  | 'dirty'
  | 'idle'
  | 'known-failure'
  | 'submitting'
  | 'success'
  | 'unknown-result';

const KNOWN_FAILURE_STATUSES = new Set([
  400, 401, 403, 404, 409, 413, 415, 422,
]);

export function isKnownSubmitFailure(meta: ApiRequestErrorMeta) {
  return (
    meta.transport === 'response' &&
    meta.httpStatus !== undefined &&
    KNOWN_FAILURE_STATUSES.has(meta.httpStatus) &&
    Boolean(meta.businessCode)
  );
}

function normalizeForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForFingerprint(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForFingerprint(entry)]),
    );
  }
  return value;
}

export function stableFingerprint(value: unknown) {
  return JSON.stringify(normalizeForFingerprint(value));
}

const fileTokens = new WeakMap<File, string>();

export function fileSelectionToken(file: File) {
  const existing = fileTokens.get(file);
  if (existing) return existing;
  const token = crypto.randomUUID();
  fileTokens.set(file, token);
  return token;
}

export function useIdempotentSubmit(
  keyFactory: () => string = () => crypto.randomUUID(),
) {
  const status = ref<IdempotentSubmitStatus>('idle');
  const key = ref<string>();
  const fingerprint = ref<string>();
  const errorMeta = ref<ApiRequestErrorMeta>();

  const isSubmitting = computed(() => status.value === 'submitting');
  const isUnknownResult = computed(() => status.value === 'unknown-result');

  function contentChanged(nextFingerprint: string) {
    if (
      fingerprint.value !== undefined &&
      fingerprint.value !== nextFingerprint
    ) {
      key.value = undefined;
      errorMeta.value = undefined;
      status.value = 'dirty';
    }
  }

  function begin(nextFingerprint: string) {
    contentChanged(nextFingerprint);
    if (!key.value || fingerprint.value !== nextFingerprint) {
      key.value = keyFactory();
    }
    fingerprint.value = nextFingerprint;
    errorMeta.value = undefined;
    status.value = 'submitting';
    return key.value;
  }

  function fail(error: unknown) {
    const meta =
      error instanceof ApiRequestError
        ? error.meta
        : toApiRequestErrorMeta(error);
    errorMeta.value = meta;
    status.value = isKnownSubmitFailure(meta)
      ? 'known-failure'
      : 'unknown-result';
    return meta;
  }

  function succeed() {
    status.value = 'success';
    errorMeta.value = undefined;
  }

  function reset() {
    status.value = 'idle';
    key.value = undefined;
    fingerprint.value = undefined;
    errorMeta.value = undefined;
  }

  return {
    begin,
    contentChanged,
    errorMeta,
    fail,
    fingerprint,
    isSubmitting,
    isUnknownResult,
    key,
    reset,
    status,
    succeed,
  };
}
