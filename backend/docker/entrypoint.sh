#!/bin/bash
set -e

echo "=========================================="
echo "Starting Teo-Estuary Backend..."
echo "=========================================="
echo "Debug mode: ${DEBUG:-False}"
echo "Rate limiter: ${ENABLE_RATE_LIMITER:-False} ($(if [ "${ENABLE_RATE_LIMITER:-False}" = "True" ]; then echo 'ENABLED - 限制已启用'; else echo 'DISABLED - 无限制模式'; fi))"
echo "=========================================="

# 修复挂载目录的权限问题
echo "Fixing directory permissions..."
chmod 777 /app/instance 2>/dev/null || true
if [ -f /app/instance/recorder_manager.db ]; then
    chmod 666 /app/instance/recorder_manager.db 2>/dev/null || true
    echo "Fixed database file permissions"
fi

# 确保其他必要目录可写
chmod -R 755 /app/logs 2>/dev/null || true
chmod -R 755 /app/data 2>/dev/null || true

if [ "${DEBUG:-False}" = "True" ] || [ "${DEBUG:-False}" = "true" ] || [ "${DEBUG:-False}" = "1" ]; then
    echo "Running in development mode with Flask dev server"
    exec python run.py
else
    echo "Running in production mode with Gunicorn"
    exec gunicorn --bind 0.0.0.0:5000 \
                  --workers ${GUNICORN_WORKERS:-2} \
                  --threads ${GUNICORN_THREADS:-4} \
                  --timeout ${GUNICORN_TIMEOUT:-120} \
                  --log-level ${GUNICORN_LOG_LEVEL:-info} \
                  --capture-output \
                  run:app
fi
