import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        host: '0.0.0.0',
        port: 5666,
        allowedHosts: ['coder.vdian.net'],
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://0.0.0.0:8181',
            ws: true,
          },
        },
      },
    },
  };
});
