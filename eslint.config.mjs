import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    // Playwright MCP 临时快照产物，非源码，不参与 lint
    ignores: ['.playwright-mcp/**'],
  },
]);
