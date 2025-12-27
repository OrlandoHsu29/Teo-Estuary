# TeoRecord Docker 部署指南

## 概述

本项目使用Docker Compose进行部署，包含以下服务：
- **teorecord-backend**: Flask应用服务
- **redis**: Redis缓存服务（用于Flask-Limiter速率限制存储）

## 快速开始

### 1. 环境准备

确保已安装：
- Docker
- Docker Compose

### 1.5 首次部署（数据迁移）

如果你之前有本地数据，需要先迁移到Docker目录：

```bash
cd backend/docker

# 创建数据目录
mkdir -p instance data/data data/logs

# 如果你有旧的 dialect_recorder.db，容器启动后会自动创建新的 recorder_manager.db
# 并导入旧数据。或者你可以手动迁移：
# (注意：这需要手动操作，建议直接启动新容器让系统自动创建表)
```

**注意**：
- 现在使用统一的 `recorder_manager.db` 数据库
- 旧的 `dialect_recorder.db` 和 `teo_g2p.db` 已合并
- 容器首次启动时会自动创建新数据库和所有表
- 如需迁移旧数据，请使用数据库迁移工具

### 2. 配置环境变量

复制环境变量配置文件：
```bash
cd backend/docker
cp .env.example .env
```

编辑 `.env` 文件，填入实际配置值：
```bash
# 必填项
SECRET_KEY=your-strong-secret-key-here
SILICONFLOW_API_KEY=your-actual-siliconflow-api-key
ADMIN_PASSWORD=your-secure-admin-password

# 可选项（使用默认值）
RATELIMIT_STORAGE_URL=redis://redis:6379  # 使用Redis存储速率限制
RATELIMIT_DEFAULT=1000 per day, 100 per hour
```

### 3. 启动服务

```bash
# 直接在docker目录下运行（.env文件会自动加载）
docker-compose up -d
```

### 4. 验证部署

访问健康检查端点：
```bash
curl http://localhost:5001/health
```

预期响应：
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000000"
}
```

## 服务详情

### Backend服务 (teorecord-backend)

- **端口**: 5001:5000 (主机:容器)
- **健康检查**: 每30秒检查一次
- **挂载卷**: 数据目录挂载到宿主机，便于访问和备份
  - `./instance:/app/instance` - 统一数据库文件
    - `recorder_manager.db` - 主数据库（包含所有表：录音、API密钥、潮州话翻译字典等）
  - `./data/data:/app/data` - 用户上传的音频文件
  - `./data/logs:/app/logs` - 应用日志文件
- **依赖**: redis服务
- **自动初始化**: 启动时自动创建数据库表（如果不存在）

**数据库说明**：
- 使用统一的 `recorder_manager.db` 数据库文件
- 包含以下表：
  - `recording` - 录音记录
  - `api_key` - API密钥
  - `translation_dict` - 潮州话翻译字典
  - `change_log` - 数据库修改日志
- 简化了部署和备份流程

### Redis服务 (redis)

- **端口**: 6379:6379
- **数据持久化**: 使用 `redis_data` 卷
- **配置**: 开启AOF持久化
- **健康检查**: 每10秒检查一次

### Emilia服务（可选）

如果需要使用Emilia音频处理服务，可以：

1. **在宿主机运行Emilia**（推荐用于开发）:
   ```bash
   # Emilia服务运行在宿主机5029端口
   # Docker容器通过 host.docker.internal 访问（Windows/Mac）
   # Linux需要使用宿主机IP
   ```

2. **在Docker网络中运行Emilia**（推荐用于生产）:
   ```yaml
   # 取消docker-compose.yml中emilia服务的注释
   # 并配置正确的镜像和端口
   ```

配置Emilia服务URL：
```env
# 宿主机运行（Windows/Mac）
EMILIA_SERVICE_URL=http://host.docker.internal:5029

# 宿主机运行（Linux）
EMILIA_SERVICE_URL=http://172.17.0.1:5029

# Docker网络中运行
EMILIA_SERVICE_URL=http://emilia:5029
```

## 速率限制配置

### 默认配置

- **全局限制**: 每天1000次，每小时100次请求
- **上传接口**: 每天100次，每小时30次
- **文本生成接口**: 每天200次，每小时60次
- **API密钥验证**: 每天200次请求

### 存储后端

- **开发环境**: `memory://` (内存存储)
- **生产环境**: `redis://redis:6379` (Redis存储)

### 自定义配置

通过环境变量调整：

```env
# 更改默认全局限制
RATELIMIT_DEFAULT=2000 per day, 200 per hour

# 更改存储后端
RATELIMIT_STORAGE_URL=redis://redis:6379  # Redis存储
# 或
RATELIMIT_STORAGE_URL=memory://            # 内存存储
```

## 生产环境建议

### 1. 安全配置

```env
# 使用强密钥
SECRET_KEY=$(openssl rand -hex 32)

# 设置强管理员密码
ADMIN_PASSWORD=your-complex-password-here

# 关闭调试模式（使用 Gunicorn）
DEBUG=False
```

### 2. 运行模式

项目根据 `DEBUG` 环境变量自动选择运行模式：

- **开发模式** (`DEBUG=True`): 使用 Flask 开发服务器，支持热重载
- **生产模式** (`DEBUG=False`): 使用 Gunicorn WSGI 服务器，性能更好

Gunicorn 配置（可通过环境变量调整）：
```env
GUNICORN_WORKERS=2        # 工作进程数
GUNICORN_THREADS=4        # 每个进程的线程数
GUNICORN_TIMEOUT=120      # 请求超时时间（秒）
GUNICORN_LOG_LEVEL=info   # 日志级别
```

### 3. 性能优化

- **使用Redis存储**: 相比内存存储，Redis支持多实例共享和持久化
- **监控资源使用**: 监控CPU、内存和Redis连接数
- **日志轮转**: 配置日志轮转避免磁盘空间不足

### 4. 监控

检查服务状态：
```bash
# 查看所有服务状态
docker-compose ps

# 查看后端服务日志
docker-compose logs teorecord-backend

# 查看Redis服务日志
docker-compose logs redis
```

### 5. 备份

由于数据目录已挂载到宿主机，备份非常简单：

```bash
# 进入 docker 目录
cd backend/docker

# 备份统一数据库文件（包含所有数据）
cp instance/recorder_manager.db ./backup/recorder_manager-$(date +%Y%m%d).db

# 备份用户上传的音频文件
tar -czf ./backup/data-$(date +%Y%m%d).tar.gz data/data/

# 备份Redis数据（Redis仍使用Docker卷）
docker exec teorecord-redis redis-cli BGSAVE
docker cp teorecord-redis:/data/dump.rdb ./backup/
```

**恢复数据**：
```bash
# 恢复数据库
cp ./backup/recorder_manager-20231226.db instance/recorder_manager.db

# 恢复音频文件
tar -xzf ./backup/data-20231226.tar.gz
```

## 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tulpn | grep 5001
   # 或修改docker-compose.yml中的端口映射
   ```

2. **Redis连接失败**
   ```bash
   # 检查Redis服务状态
   docker-compose exec redis redis-cli ping
   ```

3. **依赖安装失败**
   ```bash
   # 重新构建镜像
   docker-compose build --no-cache
   ```

### 日志查看

```bash
# 实时查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f teorecord-backend

# 查看最近的日志
docker-compose logs --tail=100 teorecord-backend
```

## 开发环境

### 热重载

由于挂载了整个backend目录，代码修改会自动重载Flask应用（在DEBUG=True时）。

### 调试

```bash
# 进入容器调试
docker-compose exec teorecord-backend bash

# 查看应用日志
docker-compose exec teorecord-backend tail -f logs/app.log
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose build
docker-compose up -d

# 验证更新
curl http://localhost:5001/health
```

## 服务访问

启动成功后，可以通过以下地址访问：

- **后端API**: http://localhost:5001
- **管理界面**: http://localhost:5001/admin
- **健康检查**: http://localhost:5001/health
- **API测试**: http://localhost:5001/api/test

## 数据持久化

- **数据库文件**: Docker卷 `db_data` (自动初始化表结构)
- **日志文件**: `./data/logs/app.log`
- **音频文件**: `./data/data/uploads/`, `./data/data/good/`, `./data/data/bad/`
- **Redis数据**: Docker卷 `redis_data`

### 备份数据库

```bash
# 查看数据库卷
docker volume inspect docker_db_data

# 从容器备份数据库文件
docker cp teorecord-backend:/app/instance/dialect_recorder.db ./backup/

# 备份整个卷
docker run --rm -v docker_db_data:/data -v $(pwd):/backup alpine tar czf /backup/db_backup.tar.gz /data
```

## 环境变量参考

| 变量名 | 描述 | 默认值 | 必填 |
|--------|------|--------|------|
| `SECRET_KEY` | Flask密钥 | - | ✅ |
| `SILICONFLOW_API_KEY` | 硅基流动API密钥 | - | ✅ |
| `ADMIN_USERNAME` | 管理员用户名 | admin | ❌ |
| `ADMIN_PASSWORD` | 管理员密码 | - | ✅ |
| `DATABASE_URL` | 数据库URL | sqlite:///instance/dialect_recorder.db | ❌ |
| `RATELIMIT_STORAGE_URL` | 速率限制存储 | redis://redis:6379 | ❌ |
| `RATELIMIT_DEFAULT` | 默认速率限制 | 1000 per day, 100 per hour | ❌ |
| `EMILIA_SERVICE_URL` | Emilia服务URL | http://localhost:5029 | ❌ |
| `DEBUG` | 调试模式 | False | ❌ |
| `HOST` | 监听地址 | 0.0.0.0 | ❌ |
| `PORT` | 监听端口 | 5000 | ❌ |

## 支持

如有问题，请：
1. 检查日志文件
2. 验证环境变量配置
3. 确认Docker服务状态
4. 查看本文档的故障排除部分