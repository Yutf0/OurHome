# 迁移到 Win11 家用机指南

思路:代码重新部署,数据(data/ 目录)原样搬。

1. 旧机器 `bash scripts/backup.sh`,下载最新 backups/data_xxx.tar.gz
2. Win11 装 Node 20+,`npm i -g pm2`
3. backend、frontend 各自 `npm install && npm run build`
4. 解压 data 放到项目根(与 backend 同级)
5. `pm2 start ecosystem.config.cjs && pm2 save`,`npm i -g pm2-windows-startup ; pm2-startup install`
6. 外网访问:同 WiFi 直接内网 IP;跨网用 Tailscale(最省心)或路由器端口映射
7. better-sqlite3 / sharp 有 Windows 预编译包;报编译错就装 VS Build Tools(C++ 桌面开发)
