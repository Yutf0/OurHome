/**
 * 仅作为 PM2 配置结构示例。
 * 复制为 ecosystem.config.cjs 后，必须修改路径、密码、Secret 和 API Key。
 * ecosystem.config.cjs 已被 .gitignore 忽略，不要提交真实配置。
 */
module.exports = {
  apps: [
    {
      name: 'love-app',
      cwd: '/root/ourhome-releases/ee434d6-20261121',
      script: 'backend/dist/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3000',
        SERVE_FRONTEND: 'true',
        FRONTEND_DIST: '/root/ourhome-releases/ee434d6-20261121/frontend/dist',
        DATA_DIR: '/root/workspace/love-app-data',

        APP_PASSWORD: '__填写现有登录密码__',
        COOKIE_SECRET: '__填写至少32位随机字符串__',
        COOKIE_SECURE: 'true',

        KIMI_API_KEY: '__填写服务器专用Kimi_API_Key__',
        KIMI_MODEL: 'kimi-k3.1-pro',
        DEEPSEEK_API_KEY: '__填写服务器专用DeepSeek_API_Key__',
        DEEPSEEK_MODEL: 'deepseek-flash',

        VAPID_PUBLIC_KEY: '',
        VAPID_PRIVATE_KEY: '',
        VAPID_SUBJECT: 'mailto:admin@example.com',
        ENABLE_AUTO_CUTOUT: 'true',
      },
    },
  ],
};
