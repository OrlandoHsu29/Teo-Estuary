#!/bin/bash
set -e

# 创建并修复所有需要的目录权限
mkdir -p /app/instance
mkdir -p /app/app/teo_g2p/logs
mkdir -p /app/logs
mkdir -p /app/data/uploads
mkdir -p /app/data/good
mkdir -p /app/data/bad

# 修复权限 - 确保数据库目录可写
chmod 777 /app/instance 2>/dev/null || true
chmod 777 /app/app/teo_g2p/logs 2>/dev/null || true
chmod -R 755 /app/logs /app/data 2>/dev/null || true

# 初始化翻译词典数据库（从镜像中的初始化文件复制）
if [ ! -f /app/instance/translation_dict.db ] && [ -f /app/translation_dict.db.init ]; then
    cp /app/translation_dict.db.init /app/instance/translation_dict.db
    echo "Translation dictionary initialized from image"
fi

# 确保所有数据库文件有写权限
chmod 666 /app/instance/*.db 2>/dev/null || true
find /app/app/teo_g2p/logs -name "*.db" -exec chmod 666 {} \; 2>/dev/null || true

# 启动应用
if [ "${DEBUG:-False}" = "True" ]; then
    exec python run.py
else
    exec gunicorn --bind 0.0.0.0:5000 \
                  --workers ${GUNICORN_WORKERS:-2} \
                  --threads ${GUNICORN_THREADS:-4} \
                  --timeout ${GUNICORN_TIMEOUT:-120} \
                  --log-level ${GUNICORN_LOG_LEVEL:-info} \
                  --capture-output \
                  run:app
fi
