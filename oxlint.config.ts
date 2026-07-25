import { oxlintConfig } from '@vben/oxlint-config';

import { defineConfig } from 'oxlint';

export default defineConfig({
  ...oxlintConfig,
  // doc 设计参考片段（非应用源码），不参与 lint
  ignorePatterns: [...(oxlintConfig.ignorePatterns ?? []), '**/doc/**'],
});
