# Teo Estuary - 前后端分离版本

潮汕话录音数据收集系统的前后端分离版本。

## 项目结构

```
TeoEstuary-dev/
├── frontend/          # 前端代码
│   ├── src/          # 源代码
│   │   ├── css/      # 样式文件
│   │   ├── js/       # JavaScript文件
│   │   ├── fonts/    # 字体文件
│   │   └── index.html # 主页面
│   └── package.json  # 前端配置
├── backend/          # 后端代码
│   ├── app/          # 应用核心代码
│   │   ├── app.py    # Flask主应用
│   │   ├── ai_generator.py # AI文本生成器
│   │   └── teochew_g2p/ # 潮汕话拼音转换库
│   ├── templates/    # 管理页面模板
│   ├── data/         # 审核后音频数据
│   │   ├── uploads/  # 上传文件临时目录
│   │   ├── good/     # 审核通过的音频文件
│   │   └── bad/      # 审核拒绝的音频文件
│   ├── logs/         # 日志文件
│   ├── db/           # 数据库文件
│   ├── requirements.txt # Python依赖
│   ├── run.py        # 后端启动脚本
│   └── .env.example  # 环境变量示例
└── README.md         # 项目说明
```

## 快速开始

### 使用 Pixi 管理（推荐）

确保你已经安装了 [pixi](https://pixi.sh/latest/)。

#### 一键启动

```bash
# 在项目根目录执行
pixi run start-all
```

或者使用脚本：

```bash
# Windows
.\start-all.bat

# Linux/Mac
chmod +x start.sh && ./start.sh
```

#### 单独启动服务

**启动后端：**

```bash
cd backend
pixi run start
# 或者
pixi run dev
```

**启动前端：**

```bash
cd frontend
pixi run start
# 或者
pixi run dev
```

### 传统方式

#### 后端启动

1. 进入后端目录：
   
   ```bash
   cd backend
   ```

2. 创建虚拟环境并安装依赖：
   
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. 配置环境变量：
   
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，配置相应的参数
   ```

4. 启动后端服务：
   
   ```bash
   python run.py
   ```

后端服务将在 http://localhost:5000 启动

#### 前端启动

1. 进入前端目录：
   
   ```bash
   cd frontend
   ```

2. 启动前端开发服务器：
   
   ```bash
   python -m http.server 8080 --directory src
   ```

### 管理界面

后端管理界面：http://localhost:5000/admin
默认用户名：admin
默认密码：your-admin-password

## 主要改动

1. **前后端分离**：前端独立运行在8080端口，后端运行在5000端口
2. **CORS支持**：后端添加了跨域支持，允许前端访问API
3. **路径配置**：修改了文件存储路径和日志路径配置
4. **API调用**：前端JavaScript中的API调用指向后端服务器

## 环境变量配置

在 `backend/.env` 文件中配置以下变量：

```env
# Flask配置
SECRET_KEY=your-secret-key-change-in-production
DEBUG=True
HOST=0.0.0.0
PORT=5000

# 数据库配置
DATABASE_URL=sqlite:///dialect_recorder.db

# 硅基流动API配置
SILICONFLOW_API_KEY=your-api-key

# 管理员配置
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password
```

## Pixi 配置说明

项目使用 pixi 进行包管理，包含以下配置：

- **根目录 `pixi.toml`**: 工作空间配置，管理前后端项目
- **backend/pixi.toml**: 后端依赖配置
- **frontend/pixi.toml**: 前端依赖配置

### 可用任务

**根目录任务：**

- `pixi run start-backend`: 启动后端服务
- `pixi run start-frontend`: 启动前端服务
- `pixi run start-all`: 同时启动前后端服务

**后端任务：**

- `pixi run start`: 启动后端服务
- `pixi run dev`: 开发模式启动后端

**前端任务：**

- `pixi run start`: 启动前端开发服务器
- `pixi run dev`: 开发模式启动前端
- `pixi run serve`: 启动前端服务

## 开发注意事项

1. 后端不再提供静态文件服务，所有静态资源由前端处理
2. 前端API调用需要配置正确的后端地址
3. 管理界面仍然由后端提供，通过 /admin 访问
4. 确保后端和前端服务都启动后才能正常使用
5. 使用 pixi 可以自动管理依赖环境，无需手动创建虚拟环境