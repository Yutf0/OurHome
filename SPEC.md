# 我们的小屋 · 技术规格文档（SPEC）

版本：v0.5.0　　更新日期：2026-07-19

一份两个人专用的私人 PWA 应用：日常记录、电子衣柜（含穿搭预览）、纪念日倒数，预留 AI 私人助理入口。

---

## 1. 架构总览

```
┌─────────────────────────┐        HTTPS/HTTP        ┌──────────────────────────┐
│   iPhone Safari (PWA)   │ ────────────────────────▶ │   Fastify 后端 (Node)     │
│   React 18 + Vite 前端   │ ◀──────────────────────── │   单进程，端口 80/3000    │
└─────────────────────────┘        REST + JSON        └──────────┬───────────────┘
                                                                   │
                                                     ┌─────────────┼─────────────┐
                                                     │             │             │
                                              SQLite 文件    本地文件系统    Cookie 会话
                                            (better-sqlite3)  (uploads/)    (签名 Cookie)
```

- **单体应用**：前后端分离开发，生产环境由 Fastify 一个进程同时提供 API 与静态前端资源，单端口部署，省内存、部署简单。
- **单数据目录**：`data/` 是唯一状态来源，包含 SQLite 数据库文件与全部上传的图片/音频。迁移、备份只需整体拷贝这一个目录。
- **无第三方云依赖**：不依赖任何外部数据库、对象存储或 SaaS 服务，可在本机、家用机或任意 Linux 服务器上独立运行。

---

## 2. 技术栈

### 2.1 后端

| 类别 | 选型 | 版本 | 说明 |
|---|---|---|---|
| 运行时 | Node.js | 20+ | ESM（`"type": "module"`） |
| 语言 | TypeScript | ^5.7.3 | `strict: true`，编译目标 ES2022 |
| Web 框架 | Fastify | ^5.2.1 | 高性能、插件化 |
| 数据库 | SQLite（better-sqlite3） | ^11.8.1 | 同步 API，单文件，WAL 模式 |
| 会话/鉴权 | @fastify/cookie | ^11.0.2 | 签名 Cookie，无 JWT/Session Store |
| 文件上传 | @fastify/multipart | ^9.0.3 | multipart/form-data 解析 |
| 静态托管 | @fastify/static | ^8.1.1 | 托管 `uploads/` 与前端构建产物 |
| 图片处理 | sharp | ^0.33.5 | 上传即压缩为 WebP + 缩略图 |
| 开发热重载 | tsx | ^4.19.2 | `tsx watch`，改代码自动重启 |
| 进程管理（生产） | pm2 | 最新 | 崩溃自动重启、内存限制、开机自启 |

### 2.2 前端

| 类别 | 选型 | 版本 | 说明 |
|---|---|---|---|
| 语言 | TypeScript | ^5.7.3 | `strict: true` |
| UI 框架 | React | ^18.3.1 | 函数组件 + Hooks，无状态管理库（纯 useState/useEffect） |
| 构建工具 | Vite | ^6.0.7 | 开发服务器代理 `/api`、`/uploads` 到后端 |
| PWA | vite-plugin-pwa | ^0.21.1 | 生成 manifest + Service Worker，支持添加到主屏幕 |
| 样式 | 原生 CSS（styles.css） | - | 无 CSS 框架，CSS 变量做主题令牌，系统字体栈 |
| 路由 | 无（单页内 Tab 切换） | - | App.tsx 用 state 控制四个 Tab，无需 react-router |

### 2.3 基础设施 / 部署

| 场景 | 方案 |
|---|---|
| 本机快速联调 | Vite dev server（`host: true`）+ 同 WiFi 局域网访问 |
| 无公网 IP 远程访问 | Tailscale 组网 |
| 正式部署 | Ubuntu 服务器 + pm2 + （可选）Caddy 自动 HTTPS |
| iOS 端安装方式 | PWA「添加到主屏幕」（非原生 App，无需 App Store） |
| 版本控制建议 | Git（`.gitignore` 已排除 `data/`、`node_modules/`、构建产物） |

---

## 3. 数据模型（SQLite）

数据库文件：`data/app.db`，启动时自动建表（`CREATE TABLE IF NOT EXISTS`），旧库升级时自动补新表，不影响已有数据。

### 3.1 `entries`（日常记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| author | TEXT | `'me'` \| `'her'` |
| title | TEXT | 可空，前端限 50 字，后端兜底截断 100 |
| content | TEXT | 可空，前端限 200 字，后端兜底截断 500 |
| mood | TEXT | 预留字段 |
| created_at | TEXT | `datetime('now')`，UTC |

### 3.2 `attachments`（附件：图片/音频）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| entry_id | INTEGER | 外键 → entries.id，`ON DELETE CASCADE` |
| kind | TEXT | `'image'` \| `'audio'` \| `'file'` |
| filename | TEXT | 原图/原音频文件名 |
| thumb | TEXT | 缩略图文件名（仅图片） |
| created_at | TEXT | |

索引：`idx_attachments_entry (entry_id)`、`idx_entries_created (created_at)`

### 3.3 `clothes`（电子衣柜）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| category | TEXT | `'top'` \| `'pants'` \| `'shoes'` \| `'jewelry'` \| `'accessory'` |
| subcategory | TEXT | 仅 category=jewelry 时使用：`'bracelet'` \| `'necklace'` \| `'earring'` |
| name | TEXT | 物品名称 |
| note | TEXT | 备注（颜色/季节/场合），支持模糊检索 |
| photo | TEXT | 原图文件名 |
| thumb | TEXT | 缩略图文件名 |
| created_at | TEXT | |

索引：`idx_clothes_cat (category, subcategory)`

### 3.4 `anniversaries`（纪念日）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT | 纪念日名称 |
| date | TEXT | `YYYY-MM-DD` |
| created_at | TEXT | |

百天数、下个周年、节日倒数均为**接口实时计算**，不落库，改服务器时区或查看时间均自动正确。

---

## 4. API 接口

前缀均为 `/api`，除登录接口外全部需要携带鉴权 Cookie（`preHandler: requireAuth`）。

### 4.1 鉴权

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/login` | body `{password}`，正确则种下签名 Cookie（90 天有效） |
| POST | `/api/logout` | 清除 Cookie |
| GET | `/api/me` | 返回 `{loggedIn: boolean}` |

鉴权方式：单一共享暗号（非用户名密码体系），适合两人共用场景；Cookie 用 `cookieSecret` 签名，`httpOnly + sameSite=lax`。

### 4.2 日常记录

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/entries?q=` | 时间倒序列表，`q` 模糊匹配标题/正文 |
| POST | `/api/entries` | 新建记录（含附件数组） |
| DELETE | `/api/entries/:id` | 删除记录，级联删除关联附件文件 |

### 4.3 上传

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/upload` | 单文件上传；图片自动转 WebP 并生成两版（原图≤1600px、缩略图≤400px）；音频/其他文件原样落盘 |

### 4.4 电子衣柜

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/clothes?category=&sub=&q=` | 按大类/首饰细分/备注关键字过滤 |
| POST | `/api/clothes` | 新增物品 |
| PUT | `/api/clothes/:id` | 修改名称/备注/分类 |
| DELETE | `/api/clothes/:id` | 删除，级联删除照片文件 |

### 4.5 纪念日与节日

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/anniversaries` | 每条附带 `days`（已过天数）、`nextHundred`、`nextYear` |
| POST | `/api/anniversaries` | 新增 |
| DELETE | `/api/anniversaries/:id` | 删除 |
| GET | `/api/holidays` | 情人节/白色情人节/520/七夕/圣诞的最近一次倒数（七夕为农历，内置 2025–2030 对照表） |

### 4.6 静态资源

| 路径前缀 | 说明 |
|---|---|
| `/uploads/*` | 用户上传的图片、音频，直接静态托管 |
| `/*`（生产环境） | 前端构建产物 `frontend/dist`，SPA fallback 到 `index.html` |

---

## 5. 前端结构

```
frontend/src/
├─ main.tsx            入口，挂载 App
├─ App.tsx             登录态判断 + 四 Tab 切换（无路由库）
├─ api.ts              所有后端接口的 fetch 封装
├─ types.ts            与后端一致的数据类型
├─ styles.css          全局样式（CSS 变量做设计令牌）
├─ components/
│  ├─ BottomNav.tsx     底部四图标导航
│  ├─ NewEntry.tsx      日常记录编辑器（文字/图片/录音）
│  ├─ EntryCard.tsx     记录卡片（图片画廊 + 音频播放器）
│  ├─ AudioRecorder.tsx MediaRecorder 封装，30 秒自动停止
│  └─ OutfitMatch.tsx   穿搭预览弹层（三槽位选择 + 随机搭配）
└─ pages/
   ├─ Login.tsx         暗号登录页
   ├─ Timeline.tsx      日常记录时间线（默认首页）
   ├─ Wardrobe.tsx       电子衣柜（分类图标块 + 网格 + 详情弹层）
   ├─ Anniversaries.tsx  纪念日与节日倒数
   └─ Assistant.tsx      AI 助理占位页
```

### 5.1 设计系统（styles.css 中的令牌）

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg` | `#f7f5f6` | 页面底色 |
| `--card` | `#ffffff` | 卡片底色 |
| `--accent` | `#ee6e9e` | 唯一点缀色（按钮、选中态） |
| `--accent-deep` | `#e0578c` | 点缀色按下态 |
| `--accent-soft` | `#fdeef4` | 点缀色浅底 |
| `--text` / `--text-soft` | `#33262d` / `#9b8b93` | 主/次文字 |
| `--radius` | `18px` | 卡片圆角 |

字体栈：`-apple-system, BlinkMacSystemFont, 'PingFang SC', ...`，即在 iPhone 上直接使用系统字体（苹方/San Francisco），零外部字体请求。

### 5.2 关键交互设计

- **衣柜分类**：横向可滑动的大触区图标块（≥66×68px），替代早期的小号 chips，移动端点击更稳。
- **穿搭预览**：点击「✨ 搭配」→ 屏幕中央弹出竖排三槽位（上衣/裤子/鞋子）→ 点击槽位弹出二级选择层，从该品类已存物品中选取；品类为空时提示「请添加」；支持「随机搭配」「清空」。
- **PWA 安装**：`vite-plugin-pwa` 自动生成 manifest 与 Service Worker；`index.html` 配置了 `apple-mobile-web-app-capable` 等 meta，支持 iOS Safari「添加到主屏幕」后全屏运行、状态栏适配、底部安全区（`env(safe-area-inset-bottom)`）适配刘海屏。

---

## 6. 安全与配置

| 配置项 | 环境变量 | 默认值 | 说明 |
|---|---|---|---|
| 端口 | `PORT` | 3000 | 生产环境常设为 80 |
| 监听地址 | `HOST` | 0.0.0.0 | |
| 数据目录 | `DATA_DIR` | `<项目根>/data` | |
| 登录暗号 | `APP_PASSWORD` | `change-me-520` | **务必修改** |
| Cookie 签名密钥 | `COOKIE_SECRET` | 占位字符串 | **务必改为长随机字符串** |
| 是否托管前端 | `SERVE_FRONTEND` | true | 单进程部署时使用 |

安全说明：
- 鉴权是共享暗号 + 签名 Cookie，**不是**多用户账号体系，适用范围仅限两人私用场景，不建议扩展为多用户产品而不重新设计鉴权。
- 无 HTTPS 时 iOS 会阻止 `getUserMedia`，导致录音功能不可用；其余功能不受影响。
- 上传接口、附件访问均要求登录态（`requireAuth`），但静态文件路径本身若被猜测到也可直接访问（无逐文件鉴权），因图片文件名为随机哈希，风险较低。

---

## 7. 目录结构总览

```
love-app/
├─ backend/
│  ├─ src/
│  │  ├─ server.ts        入口，注册所有插件与路由
│  │  ├─ config.ts         环境变量与路径配置
│  │  ├─ db.ts              SQLite 连接与建表
│  │  ├─ auth.ts            登录/鉴权中间件
│  │  ├─ types.ts           共享类型
│  │  └─ routes/
│  │     ├─ entries.ts
│  │     ├─ uploads.ts
│  │     ├─ clothes.ts
│  │     └─ anniversaries.ts
│  ├─ package.json / tsconfig.json / .env.example
│  └─ dist/                【构建产物】
├─ frontend/
│  ├─ src/                 见第 5 节
│  ├─ public/               PWA 图标（icon-192/512/180.png）
│  ├─ package.json / tsconfig.json / vite.config.ts / index.html
│  └─ dist/                【构建产物】
├─ data/                  【运行时生成】app.db + uploads/
├─ scripts/backup.sh       每日备份脚本
├─ ecosystem.config.cjs    pm2 生产配置
├─ README.md               使用与部署说明
└─ MIGRATION.md            迁移到 Win11 家用机指南
```

---

## 8. 已知边界与后续规划

- **AI 私人助理**（Assistant.tsx）目前为占位页，规划中会接入大模型 API 或本地 Ollama，用于问答、穿搭推荐（结合天气 + 衣柜数据）、纪念日提醒。
- **搭配功能**目前仅支持上衣/裤子/鞋子三槽位单套预览，暂不支持保存搭配历史或叠加首饰/配饰，可作为下一版本迭代方向。
- **无自动化测试**：当前依赖手动 `typecheck` + 语法校验保证质量，未来可视需要引入 Vitest。
- **单机单实例**：SQLite + 本地文件存储天然不支持多实例横向扩展，两人使用场景下无需考虑此问题。


---

## 附录 · v0.4 / v0.5 增量

### v0.4：Web Push 推送
- 新增表 `push_subscriptions`（owner / endpoint UNIQUE / p256dh / auth）
- 新增接口：`GET /api/push/key`、`POST /api/push/subscribe|unsubscribe|test`、`GET /api/push/list`
- 新记录发布后推给 `owner != author` 的订阅（自己发的不推给自己），410/404 失效订阅自动清理
- Service Worker 改为 `injectManifest` 策略（`src/sw.ts`：workbox 离线缓存 + push/notificationclick 监听）
- 依赖：后端 `web-push`；前端 `workbox-core/-precaching/-window`
- 配置：`VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT(必须 mailto: 前缀) / COOKIE_SECURE`

### v0.5：服务器自动抠图
- `clothes` 表新增三列（启动时幂等迁移，老库自动补列）：
  `cutout TEXT`（抠图文件名）、`cutout_status TEXT`（done/none/pending/failed）、
  `use_cutout INTEGER DEFAULT 1`（展示抠图 1 / 原图 0）
- 新增模块：`backend/src/cutout.ts`（调度：透明图快速路径 + ONNX 串行队列 + 重启恢复 + 旧文件清理）、
  `backend/src/cutout-worker.ts`（fork 子进程内 u2netp 推理，跑完即退归还内存，单张 ~1s / 峰值 ~350MB）
- 新增接口：`POST /api/clothes/:id/recut`（重抠）、`POST /api/clothes/:id/use-cutout`（切换展示图）
- 依赖：后端 `onnxruntime-node`；模型 `backend/models/u2netp.onnx`（4.4MB，已随仓库分发）
- 配置：`ENABLE_AUTO_CUTOUT`（默认开启，设 false 关闭）
- 前端：`displayImg()` 统一取图优先级（use_cutout&&cutout → thumb → photo）；
  衣柜卡片/搭配槽位/选择器展示抠图 + 棋盘格底；pending 时列表每 3s 轮询；
  详情弹层提供 抠图/原图 预览切换、搭配用图切换、重新抠图
