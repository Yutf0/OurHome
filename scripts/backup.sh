#!/usr/bin/env bash
# 备份整个 data 目录,保留最近 14 份。建议 crontab: 0 3 * * * cd /root/love-app && bash scripts/backup.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
STAMP=$(date +%Y%m%d_%H%M%S)
tar -czf "backups/data_${STAMP}.tar.gz" data
echo "[$(date)] 备份完成: backups/data_${STAMP}.tar.gz"
ls -t backups/data_*.tar.gz | tail -n +15 | xargs -r rm -f
