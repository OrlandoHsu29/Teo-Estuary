#!/bin/bash
set -e

echo "Starting TeoRecord Backend..."
echo "Debug mode: ${DEBUG:-False}"

if [ "${DEBUG:-False}" = "True" ] || [ "${DEBUG:-False}" = "true" ] || [ "${DEBUG:-False}" = "1" ]; then
    echo "Running in development mode with Flask dev server"
    exec python run.py
else
    echo "Running in production mode with Gunicorn"
    exec gunicorn --bind 0.0.0.0:5000 \
                  --workers ${GUNICORN_WORKERS:-2} \
                  --threads ${GUNICORN_THREADS:-4} \
                  --timeout ${GUNICORN_TIMEOUT:-120} \
                  --access-logfile /app/logs/gunicorn_access.log \
                  --error-logfile /app/logs/gunicorn_error.log \
                  --log-level ${GUNICORN_LOG_LEVEL:-info} \
                  --reload \
                  run:app
fi
