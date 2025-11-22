# 部署指南 - 相对路径配置

## 概述

为了便于部署，项目已支持使用相对路径配置，避免硬编码绝对路径。

## 绝对路径使用情况

以下是当前后端代码中使用绝对路径的地方：

### 1. 数据库路径

```python
# 当前: f'sqlite:///{BACKEND_ROOT}/db/dialect_recorder.db'
# 相对路径版本: 'sqlite:///db/dialect_recorder.db'
```

### 2. 日志文件路径

```python
# 当前: str(BACKEND_ROOT / 'logs' / 'app.log')
# 相对路径版本: 'logs/app.log'
```

### 3. 上传文件夹

```python
# 当前: str(BACKEND_ROOT / 'uploads')
# 相对路径版本: 'uploads'
```

### 4. 数据存储目录

```python
# 当前: str(BACKEND_ROOT / 'data' / 'good')
# 相对路径版本: '../data/good' (因为从app目录启动)
```

## 部署步骤

### 1. 启动后端

```bash
cd backend/app
python app.py
```

### 2. 确保目录结构

要确保以下目录结构：

```
backend/
├── app/
│   ├── app.py
│   ├── ai_generator.py
│   └── teochew_g2p/
├── templates/
├── logs/
├── db/
├── data/
│   ├── uploads/
│   ├── good/
│   └── bad/
└── .env
```

### 4. 环境变量配置

创建 `.env` 文件：

```env
# Flask配置
SECRET_KEY=your-production-secret-key
DEBUG=False
HOST=0.0.0.0
PORT=5000

# 数据库配置 (使用相对路径)
DATABASE_URL=sqlite:///db/dialect_recorder.db

# 硅基流动API配置
SILICONFLOW_API_KEY=your-api-key

# 管理员配置
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-secure-password
```

## 生产环境部署注意事项

### 1. 工作目录

确保从正确的目录启动应用：

```bash
# 后端从 backend 目录启动
cd backend
pixi run start

# 或者直接启动
cd backend/app
python app.py  # 或 python app_relative.py
```

### 2. 文件权限

确保应用有权限访问所有必需目录：

```bash
chmod -R 755 uploads/ logs/ db/ data/
```

### 3. 目录检查

部署前检查目录是否存在：

```bash
cd backend
ls -la logs/ db/ data/
```

### 4. 数据库初始化

首次运行时会自动创建数据库表，确保db目录存在且可写。

### 5. 日志配置

生产环境建议修改日志级别：

```python
logging.basicConfig(
    level=logging.WARNING,  # 改为WARNING减少日志输出
    # ... 其他配置
)
```

### 6. 安全配置

- 修改默认的管理员用户名和密码
- 设置强密钥的SECRET_KEY
- 确保只允许必要的CORS来源

### 7. 进程管理

建议使用进程管理器：

```bash
# 使用 systemd
sudo systemctl start teo-recorder

# 或使用 supervisor
supervisorctl start teo-recorder
```

## 迁移现有数据

如果从绝对路径版本迁移到相对路径版本：

1. 备份现有数据
2. 运行迁移脚本
3. 检查文件路径是否正确

## 测试部署

部署后测试：

1. 访问管理界面: http://your-domain:5000/admin
2. 测试API端点: http://your-domain:5000/api/test
3. 检查文件上传功能
4. 验证审核功能

## 故障排除

### 常见问题

1. **数据库文件找不到**
   
   - 确保从正确目录启动
   - 检查db目录权限

2. **上传目录不存在**
   
   - 创建uploads目录
   - 检查目录权限

3. **模板文件找不到**
   
   - 确保templates目录在正确位置
   - 检查相对路径是否正确

4. **静态文件404**
   
   - 前端静态文件由前端服务器处理
   - 确保前端服务器正常运行

### 调试方法

1. 检查应用日志
2. 使用 `python -c "import os; print(os.getcwd())"` 检查工作目录
3. 使用绝对路径测试相对路径是否正确