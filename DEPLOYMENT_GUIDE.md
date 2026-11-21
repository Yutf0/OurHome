# OurHome 申论与日常功能更新部署手册

发布版本：`ee434d6`  
适用环境：Linux 云服务器、Node.js 20/22、PM2、Caddy/Nginx、iPhone Safari/PWA

> 本发布包不包含线上 `data/`、数据库、上传文件、真实 API Key、`.env` 或 PM2 私密配置。

## 1. 本次更新内容

- 底部导航由四栏增加为五栏，新增独立的“专属”模块。
- “专属”模块采用独立目录和功能注册表，之后可以继续增加其他专属功能。
- 新增申论批改：
  - 支持申论大作文和小题。
  - 题目材料支持上传图片、粘贴文字或输入关键词检索。
  - 作答支持上传图片或直接粘贴文字。
  - 图片由 Kimi 识别，批改由 DeepSeek 完成。
  - 上传图片仅在本次请求的内存中处理，不写入服务器 `data/`。
  - 页面底部说明栏已经移除。
- 登录页兔子头像已替换为指定的小猫图片。
- 日常发布增加地图选点、当前位置定位和地点名称编辑；地点显示在日常卡片右下角，点击后打开 Apple 地图。
- 每条评论支持按当前身份点赞和取消点赞。
- 兼容旧数据库：启动时只补充地点字段以及评论、评论点赞表，不删除原有日常、图片、衣柜或纪念日数据。
- 已加入 iPhone 安全区、触控和 PWA 页面适配。

## 2. 发布包结构

```text
backend/                    后端源码、已构建 dist、模型及依赖清单
frontend/                   前端源码、已构建 dist 和 PWA 文件
scripts/                    数据备份、VAPID 生成脚本
DEPLOYMENT_GUIDE.md         本手册
ecosystem.config.example.cjs  PM2 配置示例（全部是占位符）
Caddyfile                   HTTPS 反向代理示例
```

`frontend/dist` 和 `backend/dist` 已预先构建。服务器不需要安装前端依赖即可运行本次发布，但后端生产依赖必须在 Linux 上执行 `npm ci --omit=dev` 安装。

## 3. 部署前先确认当前程序位置

不要直接假定线上目录。先在服务器执行：

```bash
pm2 ls
pm2 describe love-app
```

在输出中找到 `exec cwd` 或脚本路径，记为当前应用目录。下面以 `/root/love-app` 为例；如果你的实际目录不同，请替换命令中的路径。

```bash
export APP_DIR=/root/love-app
cd "$APP_DIR"
pwd
ls -la
```

确认目录中至少能看到 `backend/`、`frontend/`，并确认数据目录：

```bash
readlink -f "$APP_DIR/data"
ls -lah "$(readlink -f "$APP_DIR/data")"
```

正常情况下应看到 `app.db` 和 `uploads/`。如果没有看到，先停止部署并检查实际 `DATA_DIR`。

## 4. 备份线上数据和旧代码

以下命令不会修改数据库，只会生成备份：

```bash
export APP_DIR=/root/love-app
export DATA_DIR="$(readlink -f "$APP_DIR/data")"
export BACKUP_DIR=/root/ourhome-backups
export STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/data_$STAMP.tar.gz" -C "$DATA_DIR" .
tar -czf "$BACKUP_DIR/code_$STAMP.tar.gz" \
  --exclude='node_modules' \
  --exclude='data' \
  --exclude='backups' \
  -C "$APP_DIR" .

ls -lh "$BACKUP_DIR"/*_$STAMP.tar.gz
```

如果 `ecosystem.config.cjs` 位于应用目录中，它已经包含在代码备份里。不要把这些备份上传到 GitHub。

## 5. 上传并解压发布包

在本机 PowerShell 中，把 IP 和本地文件路径换成实际值：

```powershell
scp .\ourhome-release-ee434d6-20261121.tar.gz root@服务器IP:/root/
```

回到服务器，创建独立的新版本目录：

```bash
export RELEASE_DIR=/root/ourhome-releases/ee434d6-20261121
mkdir -p "$RELEASE_DIR"
tar -xzf /root/ourhome-release-ee434d6-20261121.tar.gz \
  --strip-components=1 -C "$RELEASE_DIR"

cd "$RELEASE_DIR"
ls -la
```

发布包中没有 `data/`。把新版本连接到原有数据目录：

```bash
export APP_DIR=/root/love-app
export DATA_DIR="$(readlink -f "$APP_DIR/data")"

test -f "$DATA_DIR/app.db" || { echo '未找到 app.db，停止部署'; exit 1; }
ln -s "$DATA_DIR" "$RELEASE_DIR/data"
```

## 6. 安装 Linux 后端依赖

确认 Node 版本。推荐 Node.js 20 或 22，不要使用过旧版本：

```bash
node -v
npm -v
```

在新版本目录安装后端生产依赖：

```bash
cd "$RELEASE_DIR/backend"
npm ci --omit=dev
```

如果服务器内存较紧，可先确认 swap：

```bash
free -h
swapon --show
```

不要从 Windows 复制 `node_modules` 到服务器。

## 7. 配置 API Key 和运行参数

后端不会自动读取 `.env`，推荐继续使用服务器现有的 PM2 配置。先备份原配置，再只补充下面四项：

```text
KIMI_API_KEY
KIMI_MODEL
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
```

默认模型：

```text
KIMI_MODEL=kimi-k3.1-pro
DEEPSEEK_MODEL=deepseek-flash
```

本包提供 `ecosystem.config.example.cjs` 作为结构参考，其中没有真实密码或 Key。实际服务器上的 `ecosystem.config.cjs` 不要提交到 GitHub。

如果沿用已有 PM2 配置，请同时把以下路径指向新版本：

```text
cwd=/root/ourhome-releases/ee434d6-20261121
script=backend/dist/server.js
DATA_DIR=原数据目录的绝对路径
FRONTEND_DIST=/root/ourhome-releases/ee434d6-20261121/frontend/dist
```

`APP_PASSWORD`、`COOKIE_SECRET`、VAPID 推送密钥和其他现有配置应原样保留。

## 8. 启动或重载 PM2

### 方案 A：修改现有 PM2 配置（推荐）

修改服务器已有的 `ecosystem.config.cjs` 后执行：

```bash
pm2 reload /实际路径/ecosystem.config.cjs --update-env
pm2 save
pm2 status
pm2 logs love-app --lines 80
```

### 方案 B：首次使用示例配置

先复制示例，再把所有占位符和路径改成真实值：

```bash
cd "$RELEASE_DIR"
cp ecosystem.config.example.cjs ecosystem.config.cjs
nano ecosystem.config.cjs
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

不要在占位符未修改时启动。

## 9. 数据库迁移说明

新后端第一次启动时会自动执行兼容迁移：

- `entries` 增加 `location_name`、`latitude`、`longitude`。
- 创建 `comments` 表（如果旧库中没有）。
- 创建 `comment_likes` 表。
- 保留原表和原数据。

启动后可只读检查：

```bash
sqlite3 "$DATA_DIR/app.db" 'PRAGMA table_info(entries);'
sqlite3 "$DATA_DIR/app.db" '.tables'
```

应能看到地点字段，以及 `comments`、`comment_likes` 表。

## 10. 服务验证

先在服务器本机验证：

```bash
curl -I http://127.0.0.1:3000/
curl -s http://127.0.0.1:3000/ | head
pm2 logs love-app --lines 100
```

然后在 iPhone 上依次检查：

1. 登录页显示小猫图片。
2. 底部出现“专属”，进入后能打开“申论批改”。
3. 答案区域显示“这位准公务员同志，请上传你的答案”。
4. 可在“上传图片”和“粘贴文字”之间切换。
5. 分别用文字和图片测试一次申论批改。
6. 发布一条带地点的日常，确认右下角地点可打开 Apple 地图。
7. 新增一条评论，确认点赞和取消点赞正常。
8. 检查以前的日常、图片、衣柜、纪念日仍然存在。

## 11. iPhone / iOS 注意事项

- OurHome 是 PWA，不是原生 IPA，因此不需要修改 `Info.plist`。
- iPhone 精确定位必须在 HTTPS 页面中使用；纯 HTTP 公网地址通常无法请求定位权限。
- 第一次点击“定位当前位置”时，Safari/PWA 会弹出定位授权，请选择允许。
- 若曾拒绝定位，可在 iPhone 的“设置 → 隐私与安全性 → 定位服务”中重新允许 Safari 网站或该主屏应用使用位置。
- 照片上传使用 iOS 系统文件/照片选择器，权限由系统弹窗管理。
- 发布后若主屏 App 仍显示旧界面，先彻底关闭再重新打开；仍未更新时用 Safari 打开站点刷新一次。删除主屏图标并重新添加只作为最后手段。
- 地图底图和地点名称依赖 OpenStreetMap/Nominatim，手机网络需要能够访问相关服务。

## 12. 网络要求

服务器需要能够访问：

```text
https://api.moonshot.cn
https://api.deepseek.com
```

iPhone 浏览器需要能够访问：

```text
https://tile.openstreetmap.org
https://nominatim.openstreetmap.org
https://maps.apple.com
```

如果普通页面正常但 AI 批改失败，优先查看：

```bash
pm2 logs love-app --lines 150
curl -I https://api.moonshot.cn
curl -I https://api.deepseek.com
```

如果地图空白但手动填写地点可用，优先检查 iPhone 到 OpenStreetMap 的网络连接以及 HTTPS 状态。

## 13. 回滚

如果新版本异常，先把 PM2 的 `cwd`、`script`、`FRONTEND_DIST` 改回旧应用目录，再执行：

```bash
pm2 reload /实际路径/ecosystem.config.cjs --update-env
pm2 save
pm2 status
```

通常不需要回滚数据库：本次只增加表和字段，旧版本会忽略它们。如果确实需要完整恢复，先停止应用，再使用第 4 步生成的数据备份；不要在应用运行时覆盖数据库。

## 14. 部署完成后的安全组

部署完成并确认 SSH 可用后，把 22 端口来源从 `0.0.0.0/0` 收紧为自己的固定公网 IP `/32`，或改用阿里云堡垒机/密钥登录。网站只保留实际需要的 80、443 端口。

