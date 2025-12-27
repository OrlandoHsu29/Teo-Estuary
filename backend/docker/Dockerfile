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

# 修复instance目录权限（当挂载宿主机目录时可能需要）
RUN chmod -R 777 instance

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# 复制数据库初始化脚本和启动脚本
COPY docker/init_db.py /tmp/init_db.py
COPY docker/entrypoint.sh /app/docker/entrypoint.sh

# 转换换行符（CRLF -> LF）并设置执行权限
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh && \
    chmod +x /app/docker/entrypoint.sh && \
    sed -i 's/\r$//' /tmp/init_db.py

# 设置entrypoint
ENTRYPOINT ["/app/docker/entrypoint.sh"]