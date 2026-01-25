#!/bin/bash
set -e

# 修复权限
chmod 777 /app/instance 2>/dev/null || true

# 初始化翻译词典数据库（从镜像中的初始化文件复制）
if [ ! -f /app/instance/translation_dict.db ] && [ -f /app/translation_dict.db.init ]; then
    cp /app/translation_dict.db.init /app/instance/translation_dict.db
    echo "Translation dictionary initialized from image"
fi

chmod 666 /app/instance/translation_dict.db 2>/dev/null || true
chmod -R 755 /app/logs /app/data 2>/dev/null || true

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
