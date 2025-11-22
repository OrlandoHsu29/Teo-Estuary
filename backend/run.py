#!/usr/bin/env python3
"""
后端启动脚本
"""

import os
import sys
from pathlib import Path

# 获取backend根目录
BACKEND_ROOT = Path(__file__).parent

# 设置工作目录为backend根目录
os.chdir(BACKEND_ROOT)

# 添加app目录到Python路径
sys.path.insert(0, str(BACKEND_ROOT / 'app'))

if __name__ == '__main__':
    # 导入并运行Flask应用
    from app import app

    # 启动配置
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'True').lower() == 'true'

    print(f"启动后端服务...")
    print(f"Backend根目录: {BACKEND_ROOT}")
    print(f"服务地址: http://localhost:{port}")
    print(f"管理界面: http://localhost:{port}/admin")
    print(f"数据库: {app.config['SQLALCHEMY_DATABASE_URI']}")

    app.run(host=host, port=port, debug=debug)