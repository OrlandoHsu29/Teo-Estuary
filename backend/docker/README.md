# TeoEstuary Docker 部署指南

## 概述

本项目使用Docker Compose进行部署，包含以下服务：
- **mysql**: MySQL 8.0 数据库服务（主数据库）
- **teo-estuary-backend**: Flask应用服务
- **redis**: Redis缓存服务（用于Flask-Limiter速率限制存储和翻译缓存）

## 快速开始

### 1. 环境准备

确保已安装：
- Docker
- Docker Compose

### 1.5 首次部署

```bash
cd backend/docker

# 创建数据目录
mkdir -p instance data/data data/logs data/teo_g2p_logs data/teo_g2p_word_dict

# 首次启动会自动创建 MySQL 数据库和所有表
```

**注意**：
- 容器首次启动时会自动创建 MySQL 数据库 `teo_estuary` 和所有表
- 翻译词典使用独立的 SQLite 数据库，位于 `./data/teo_g2p_word_dict/`

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
ADMIN_PASSWORD=your-secure-admin-password

# MySQL数据库配置
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=teo_root_password
MYSQL_DATABASE=teo_estuary

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

### Backend服务 (TeoEstuary-backend)

- **端口**: 5001:5000 (主机:容器)
- **健康检查**: 每30秒检查一次
- **挂载卷**: 数据目录挂载到宿主机，便于访问和备份
  - `./instance:/app/instance` - Flask 实例目录
  - `./data/data:/app/data` - 用户上传的音频文件
  - `./data/logs:/app/logs` - 应用日志文件
  - `./data/teo_g2p_logs:/app/app/teo_g2p/logs` - 翻译模块日志
  - `./data/teo_g2p_word_dict:/app/app/teo_g2p/word_dict` - 翻译词典 SQLite 数据库
- **依赖**: redis服务
- **自动初始化**: 启动时自动创建数据库表（如果不存在）

**数据库说明**：
- 使用 MySQL 作为主数据库 (`teo_estuary`)
- 包含以下表：
  - `recording` - 录音记录
  - `api_key` - API密钥
  - `translation_dict` - 潮州话翻译字典（含备注字段）
  - `change_log` - 数据库修改日志
- 翻译词典使用独立 SQLite 数据库（挂载在 `./data/teo_g2p_word_dict`）

### MySQL服务 (mysql)

- **端口**: 33306:3306 (宿主机:容器)
- **数据持久化**: 使用 `mysql_data` 卷
- **配置**: UTF8MB4 编码，Unicode 排序
- **健康检查**: 每5秒检查一次
- **自动初始化**: 首次启动时自动创建 `teo_estuary` 数据库和所有表

### Redis服务 (redis)

- **端口**: 6379:6379 (仅容器内可访问)
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

### ⚠️ 重要：离线版 vs 线上版

本项目的速率限制功能可以通过环境变量 `ENABLE_RATE_LIMITER` 快速开关：

- **离线无限制版**（默认）：`ENABLE_RATE_LIMITER=False` - 禁用所有限制
- **线上生产版**：`ENABLE_RATE_LIMITER=True` - 启用所有限制

```env
# 离线版配置（.env 文件）
ENABLE_RATE_LIMITER=False  # 禁用所有限制，适合离线个人使用

# 线上版配置（.env 文件）
ENABLE_RATE_LIMITER=True   # 启用限制，适合公网部署
```

**快速切换**：
- 从线上merge到离线版后，只需修改 `.env` 文件中的 `ENABLE_RATE_LIMITER=False`
- 从离线版部署到线上时，修改为 `ENABLE_RATE_LIMITER=True`

### 默认配置（仅当 ENABLE_RATE_LIMITER=True 时生效）

- **全局限制**: 每天1000次，每小时100次请求
- **上传接口**: 每天100次，每小时30次
- **文本生成接口**: 每天200次，每小时60次
- **API密钥验证**: 每天200次请求

### 存储后端

- **开发环境**: `memory://` (内存存储)
- **生产环境**: `redis://redis:6379` (Redis存储)

### 自定义配置

通过环境变量调整（仅在 ENABLE_RATE_LIMITER=True 时生效）：

```env
# 启用速率限制
ENABLE_RATE_LIMITER=True

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
docker-compose logs teo-estuary-backend

# 查看MySQL服务日志
docker-compose logs mysql

# 查看Redis服务日志
docker-compose logs redis
```

### 5. 备份

由于数据目录已挂载到宿主机，备份非常简单：

```bash
# 进入 docker 目录
cd backend/docker

# 备份MySQL数据库
docker exec teo-estuary-mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD:-teo_root_password} teo_estuary > ./backup/teo_estuary-$(date +%Y%m%d).sql

# 备份翻译词典SQLite
cp ./data/teo_g2p_word_dict/*.db ./backup/

# 备份用户上传的音频文件
tar -czf ./backup/data-$(date +%Y%m%d).tar.gz data/data/

# 备份Redis数据
docker exec teo-estuary-redis redis-cli BGSAVE
docker cp teo-estuary-redis:/data/dump.rdb ./backup/
```

**恢复数据**：
```bash
# 恢复MySQL数据库
docker exec -i teo-estuary-mysql mysql -u root -p${MYSQL_ROOT_PASSWORD:-teo_root_password} teo_estuary < ./backup/teo_estuary-20231226.sql

# 恢复翻译词典
cp ./backup/*.db ./data/teo_g2p_word_dict/

# 恢复音频文件
tar -xzf ./backup/data-20231226.tar.gz
```

## 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用 (后端5001, MySQL 33306)
   netstat -tulpn | grep -E '5001|33306'
   # 或修改docker-compose.yml中的端口映射
   ```

2. **MySQL连接失败**
   ```bash
   # 检查MySQL服务状态
   docker-compose ps mysql
   docker-compose logs mysql

   # 测试MySQL连接
   docker-compose exec mysql mysql -u root -p
   ```

3. **Redis连接失败**
   ```bash
   # 检查Redis服务状态
   docker-compose exec redis redis-cli ping
   ```

4. **依赖安装失败**
   ```bash
   # 重新构建镜像
   docker-compose build --no-cache
   ```

### 日志查看

```bash
# 实时查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f teo-estuary-backend

# 查看最近的日志
docker-compose logs --tail=100 teo-estuary-backend
```

## 开发环境

### 热重载

由于挂载了整个backend目录，代码修改会自动重载Flask应用（在DEBUG=True时）。

### 调试

```bash
# 进入后端容器调试
docker-compose exec teo-estuary-backend bash

# 进入MySQL容器
docker-compose exec mysql bash

# 查看后端应用日志
docker-compose exec teo-estuary-backend tail -f logs/app.log
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

- **MySQL数据库**: Docker卷 `mysql_data` (自动初始化表结构)
- **Redis数据**: Docker卷 `redis_data`
- **日志文件**: `./data/logs/`
- **音频文件**: `./data/data/uploads/`, `./data/data/good/`, `./data/data/bad/`
- **翻译词典**: `./data/teo_g2p_word_dict/` (SQLite)
- **翻译日志**: `./data/teo_g2p_logs/`

### 备份数据库

```bash
# 备份MySQL数据库
docker exec teo-estuary-mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD:-teo_root_password} teo_estuary > ./backup/teo_estuary-$(date +%Y%m%d).sql

# 或使用docker卷备份
docker run --rm -v docker_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup.tar.gz /data

# 备份翻译词典SQLite
cp ./data/teo_g2p_word_dict/*.db ./backup/

# 备份用户音频文件
tar -czf ./backup/audio-$(date +%Y%m%d).tar.gz data/data/

# 备份Redis数据
docker exec teo-estuary-redis redis-cli BGSAVE
docker cp teo-estuary-redis:/data/dump.rdb ./backup/
```

### 恢复数据

```bash
# 恢复MySQL数据库
docker exec -i teo-estuary-mysql mysql -u root -p${MYSQL_ROOT_PASSWORD:-teo_root_password} teo_estuary < ./backup/teo_estuary-20231226.sql

# 恢复翻译词典
cp ./backup/*.db ./data/teo_g2p_word_dict/

# 恢复音频文件
tar -xzf ./backup/audio-20231226.tar.gz
```

## 环境变量参考

| 变量名 | 描述 | 默认值 | 必填 |
|--------|------|--------|------|
| `SECRET_KEY` | Flask密钥 | - | ✅ |
| `ADMIN_USERNAME` | 管理员用户名 | admin | ❌ |
| `ADMIN_PASSWORD` | 管理员密码 | - | ✅ |
| `MYSQL_HOST` | MySQL主机 | mysql | ❌ |
| `MYSQL_PORT` | MySQL端口 | 3306 | ❌ |
| `MYSQL_USER` | MySQL用户名 | root | ❌ |
| `MYSQL_PASSWORD` | MySQL密码 | - | ❌ |
| `MYSQL_DATABASE` | MySQL数据库名 | teo_estuary | ❌ |
| `REDIS_HOST` | Redis主机 | redis | ❌ |
| `REDIS_PORT` | Redis端口 | 6379 | ❌ |
| `REDIS_DB` | Redis数据库编号 | 0 | ❌ |
| `USE_FILE_CACHE` | 是否使用文件缓存 | false | ❌ |
| `CACHE_DIR` | 缓存目录 | ./cache/teo_g2p | ❌ |
| `ENABLE_RATE_LIMITER` | **启用速率限制（False=离线无限制，True=线上限制）** | **False** | ❌ |
| `RATELIMIT_STORAGE_URL` | 速率限制存储 | redis://redis:6379 | ❌ |
| `RATELIMIT_DEFAULT` | 默认速率限制 | 1000 per day, 100 per hour | ❌ |
| `EMILIA_SERVICE_URL` | Emilia服务URL | http://localhost:5029 | ❌ |
| `ASR_SERVICE_URL` | ASR语音识别服务URL | http://localhost:5026 | ❌ |
| `DEBUG` | 调试模式 | False | ❌ |
| `HOST` | 监听地址 | 0.0.0.0 | ❌ |
| `PORT` | 监听端口 | 5000 | ❌ |

## 支持

如有问题，请：
1. 检查日志文件
2. 验证环境变量配置
3. 确认Docker服务状态
4. 查看本文档的故障排除部分