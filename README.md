# 我们的小屋 ♡（v0.5）

两个人专用的私人应用:日常记录、电子衣柜（含搭配预览）、纪念日、预留 AI 助理。
后端 Node + Fastify + SQLite,前端 React + Vite + PWA,前后端全 TypeScript。

## v0.5 更新（本版）

- **服务器自动抠图（默认开启）**：收进衣柜上传照片后，后端自动识别衣服轮廓、
  去背景并沿轮廓裁剪，衣柜卡片和搭配预览直接展示干净的「商品图」。
  - 普通平铺/挂拍照片 → fork 子进程用 ONNX(u2netp) 推理，约 1 秒完成，
    期间卡片显示「抠图中…」，抠好后页面每 3 秒自动刷新出图
  - 若上传的本身是透明图（比如 iPhone「提取主体」抠好的）→ 秒级直接裁剪
  - **不满意可切回原图**：点开衣物详情 → 「抠图 / 原图」预览切换 →
    「搭配用抠图 / 搭配用原图」一键落库；还可「重新抠图」重试
  - 原图 photo/thumb 永远保留，抠图只是额外多出来的一张，随时可退
  - 模型 `backend/models/u2netp.onnx`（4.4MB）已内置；推理在独立子进程中执行，
    跑完即退、内存立刻归还，2 核 2G 机器可安全运行（建议先加 2G swap 兜底：
    `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`，
    并写入 /etc/fstab: `/swapfile none swap sw 0 0`）
  - 想整体关闭：环境变量 `ENABLE_AUTO_CUTOUT=false`
- **推送修复**：`VAPID_SUBJECT` 补上 `mailto:` 前缀（裸邮箱会导致填入密钥后
  启动即崩溃，config.ts 也加了自动补前缀兜底）；修复 `PushSetup.tsx` 在新版
  TypeScript 下的编译错误（此前会导致前端 `npm run build` 失败）
- 数据库启动时自动补 `cutout / cutout_status / use_cutout` 三列，老数据完全兼容；
  服务重启会自动恢复未完成的抠图任务

> ⚠️ 推送要真正生效，仍需两步：`cd backend && node ../scripts/gen-vapid.mjs`
> 生成密钥填进 ecosystem.config.cjs（**当前为空 → 推送整体被跳过**），
> 然后 HTTPS 环境下从主屏图标打开、在「助理」页开启通知。

## v0.3 更新

- 整体换为简约 App 风:系统字体、纯白卡片、单一玫瑰粉点缀,去掉 Google Fonts 外链(国内加载更快)
- 衣柜分类从小 chips 改为横向滑动的大触区图标块(≥66×68px,手机好点)
- 新增 **搭配预览**:衣柜右上角「✨ 搭配」→ 屏幕中央竖直三个框(上衣/裤子/鞋子)→ 点框从已存物品中挑选,该品类为空则提示请添加;支持随机搭配和清空
- App 图标换成可爱风(带表情的爱心)

## 本机开发(Mac)

```bash
cd backend  && npm install && npm run dev    # 终端 1
cd frontend && npm install && npm run dev    # 终端 2
```

浏览器开 http://localhost:5173,暗号默认 change-me-520。

## 让两台手机立刻用上(无需服务器)

前端 vite 已开 `host: true`,Mac 与手机连同一 WiFi 即可:

1. Mac 查内网 IP:`ipconfig getifaddr en0`(比如 192.168.1.8)
2. 手机浏览器访问 `http://192.168.1.8:5173`,即可登录使用、添加到主屏幕
3. 注意:开发模式要保持两个终端运行;Mac 休眠会断;录音在手机上不可用(非 https)

更稳一点的本机方案(单进程):

```bash
cd frontend && npm run build && cd ../backend && npm run build
PORT=3000 npm start
# 手机访问 http://192.168.1.8:3000
```

想不在同一 WiFi 也能用(不买服务器):两台手机和 Mac 都装 **Tailscale**(免费),
登录同一账号后,手机在任何网络访问 `http://Mac的Tailscale IP:3000` 即可,且自带加密。

## 部署到服务器(公网 IP,2核2G Ubuntu 即可)

```bash
# 服务器装环境(一次)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

# 本机上传代码(data/ node_modules/ 不传)
rsync -av --exclude node_modules --exclude data --exclude backups \
  ./love-app/ root@你的IP:/root/love-app/

# 服务器上构建并启动
cd /root/love-app
cd backend  && npm install && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..
# 改 ecosystem.config.cjs 里的 APP_PASSWORD / COOKIE_SECRET
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

安全组放行 80 端口,手机访问 http://你的IP,分享 → 添加到主屏幕。
录音需 HTTPS:配好域名(国内需 ICP 备案,或用境外节点)后用 Caddy 反代自动上证书。

## 调试

- 类型检查:各目录 `npm run typecheck`
- 接口:`curl -c /tmp/c.txt -H 'Content-Type: application/json' -d '{"password":"change-me-520"}' localhost:3000/api/login`,再 `curl -b /tmp/c.txt localhost:3000/api/clothes`
- 数据库:`sqlite3 data/app.db 'SELECT * FROM clothes;'`
- 生产日志:`pm2 logs love-app`
- iPhone 真机:iPhone 设置→Safari→高级→网页检查器,Mac Safari 开发菜单连手机

## 数据安全

全部数据在 `data/` 一个目录,`bash scripts/backup.sh` 即备份;替换代码永远不动 data/。
