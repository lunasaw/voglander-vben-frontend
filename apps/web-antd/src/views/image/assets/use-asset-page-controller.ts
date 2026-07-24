import type { ImageApi } from '#/api/image';

import { onBeforeUnmount, ref } from 'vue';

import { getImageAssetPage } from '#/api/image';

export function useAssetPageController(initialFilters: ImageApi.AssetQueryReq) {
  const rows = ref<ImageApi.AssetVO[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(24);
  const filters = ref<ImageApi.AssetQueryReq>({ ...initialFilters });
  const loading = ref(false);
  const error = ref<unknown>();
  let revision = 0;
  let activeRequest: AbortController | undefined;

  async function load() {
    const currentRevision = ++revision;
    activeRequest?.abort();
    activeRequest = new AbortController();
    loading.value = true;
    error.value = undefined;
    try {
      const result = await getImageAssetPage(
        { page: page.value, size: pageSize.value },
        filters.value,
        activeRequest.signal,
      );
      if (currentRevision !== revision) return false;
      rows.value = result?.items ?? [];
      total.value = result?.total ?? 0;
      return true;
    } catch (requestError) {
      if (activeRequest.signal.aborted || currentRevision !== revision) {
        return false;
      }
      error.value = requestError;
      return false;
    } finally {
      if (currentRevision === revision) loading.value = false;
    }
  }

  async function query(nextFilters: ImageApi.AssetQueryReq) {
    filters.value = { ...nextFilters };
    page.value = 1;
    return load();
  }

  async function setPage(nextPage: number, nextSize = pageSize.value) {
    const sizeChanged = nextSize !== pageSize.value;
    pageSize.value = nextSize;
    page.value = sizeChanged ? 1 : Math.max(1, nextPage);
    return load();
  }

  async function refreshAfterMutation() {
    const succeeded = await load();
    if (succeeded && rows.value.length === 0 && page.value > 1) {
      page.value--;
      await load();
    }
  }

  onBeforeUnmount(() => activeRequest?.abort());

  return {
    error,
    filters,
    load,
    loading,
    page,
    pageSize,
    query,
    refreshAfterMutation,
    refreshCurrentPage: load,
    rows,
    setPage,
    total,
  };
}
