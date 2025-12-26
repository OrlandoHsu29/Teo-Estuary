# 使用Python 3.11官方镜像作为基础镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制requirements.txt并安装Python依赖
COPY requirements.txt .
RUN pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip install -r requirements.txt && \
    pip install gunicorn>=21.2.0

# 复制应用代码
COPY app ./app
COPY run.py .
COPY templates ./templates
COPY static ./static

# 创建必要的目录
RUN mkdir -p logs instance data/uploads data/good data/bad

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# 复制数据库初始化脚本
COPY docker/init_db.py /tmp/init_db.py

# 启动命令 - 根据DEBUG环境变量选择启动方式
SHELL ["/bin/bash", "-c"]
CMD if [ "${DEBUG:-False}" = "True" ] || [ "${DEBUG:-False}" = "true" ] || [ "${DEBUG:-False}" = "1" ]; then \
        echo "Running in development mode with Flask dev server" && \
        python /tmp/init_db.py && \
        exec python run.py; \
    else \
        echo "Running in production mode with Gunicorn" && \
        python /tmp/init_db.py && \
        exec gunicorn --bind 0.0.0.0:5000 \
            --workers ${GUNICORN_WORKERS:-2} \
            --threads ${GUNICORN_THREADS:-4} \
            --timeout ${GUNICORN_TIMEOUT:-120} \
            --access-logfile /app/logs/gunicorn_access.log \
            --error-logfile /app/logs/gunicorn_error.log \
            --log-level ${GUNICORN_LOG_LEVEL:-info} \
            --reload \
            run:app; \
    fi