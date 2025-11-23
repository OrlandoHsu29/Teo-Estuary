# TeoRecord Backend Docker 部署指南

这个目录包含了TeoRecord后端的Docker配置文件，用于容器化部署。

## 文件说明

- `Dockerfile` - 定义了后端应用的Docker镜像
- `docker-compose.yml` - Docker Compose配置文件，用于定义和运行多容器应用
- `.env.example` - 环境变量示例文件
- `README.md` - 本说明文档

## 快速开始

### 1. 准备环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑.env文件，填入你的配置
nano .env
```

### 2. 启动服务

```bash
# 使用docker-compose构建并启动服务
docker-compose up -d

# 或者使用新版docker compose
docker compose up -d
```

### 3. 查看服务状态

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4. 停止服务

```bash
# 停止服务
docker-compose down

# 停止并删除数据卷（会删除数据库）
docker-compose down -v
```

## 服务访问

启动成功后，可以通过以下地址访问：

- 后端API: http://localhost:5000
- 管理界面: http://localhost:5000/admin
- 健康检查: http://localhost:5000/health

## 数据持久化

- 数据库文件: `./data/db/dialect_recorder.db`
- 日志文件: `./data/logs/`
- 音频和数据文件: `./data/uploads/`, `./data/good/`, `./data/bad/`

## 开发环境配置

### 开发模式

如果想启用开发模式的热重载功能，可以修改`docker-compose.yml`中的volumes配置：

```yaml
volumes:
  # 移除:ro限制，允许热重载
  - ../app:/app/app
```

并在环境变量中设置：

```yaml
environment:
  - DEBUG=True
```

### 自定义端口

如果需要修改端口，可以在`docker-compose.yml`中修改：

```yaml
ports:
  - "8080:5000"  # 将本地8080端口映射到容器5000端口
```

## 故障排除

### 1. 容器启动失败

```bash
# 查看详细日志
docker-compose logs teorecord-backend

# 重新构建镜像
docker-compose build --no-cache
```

### 2. 权限问题

如果遇到数据目录权限问题，可以：

```bash
# 创建数据目录并设置权限
mkdir -p data/db data/logs
chmod 755 data/db data/logs
```

### 3. 端口冲突

如果5000端口已被占用，修改`docker-compose.yml`中的端口映射。

## 生产环境建议

1. **使用强密码**: 修改`.env`文件中的`SECRET_KEY`和管理员密码
2. **HTTPS**: 在生产环境中建议使用HTTPS
3. **数据库**: 考虑使用PostgreSQL替代SQLite以获得更好的性能
4. **资源限制**: 根据需要设置CPU和内存限制
5. **日志管理**: 配置日志轮转和监控

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SECRET_KEY` | Flask密钥，生产环境必须修改 | your-secret-key-change-in-production |
| `DEBUG` | 是否启用调试模式 | False |
| `HOST` | 监听地址 | 0.0.0.0 |
| `PORT` | 监听端口 | 5000 |
| `SILICONFLOW_API_KEY` | 硅基流动API密钥 | 空 |
| `ADMIN_USERNAME` | 管理员用户名 | admin |
| `ADMIN_PASSWORD` | 管理员密码 | your-admin-password |