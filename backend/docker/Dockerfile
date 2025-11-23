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

# 复制pixi配置文件
COPY ../pixi.toml .
COPY ../pixi.lock .

# 安装pip和pixi，使用国内镜像源加速
RUN pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip install pixi

# 先迁移数据库，然后安装依赖
RUN pixi migrate && \
    pixi install

# 复制应用代码
COPY ../app ./app
COPY ../run.py .
COPY ../.env.example .env

# 创建必要的目录
RUN mkdir -p /app/logs /app/db

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# 启动命令
CMD ["pixi", "run", "python", "run.py"]