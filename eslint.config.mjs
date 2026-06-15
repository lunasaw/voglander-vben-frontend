import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    // Playwright MCP 临时快照产物 + doc 设计参考片段（非应用源码），不参与 lint
    ignores: ['.playwright-mcp/**', '**/doc/**'],
  },
]);
