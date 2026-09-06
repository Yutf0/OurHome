import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 从 generateSW 改为 injectManifest:用我们自己写的 src/sw.ts,
      // 这样才能在 Service Worker 里监听 push 事件
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
      },
      // 开发模式下也启用 SW,方便本地调试推送逻辑
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: '我们的小屋',
        short_name: '小屋',
        description: '记录我们两个人的日常',
        theme_color: '#ffffff',
        background_color: '#f7f5f6',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
