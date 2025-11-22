#!/usr/bin/env python3
"""
后端启动脚本
"""

import os
import sys
from pathlib import Path

# 设置工作目录
os.chdir(Path(__file__).parent)

# 添加当前目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

if __name__ == '__main__':
    # 导入并运行Flask应用
    import sys
    sys.path.insert(0, 'app')
    from app import app

    # 启动配置
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'True').lower() == 'true'

    print(f"启动后端服务...")
    print(f"服务地址: http://localhost:{port}")
    print(f"管理界面: http://localhost:{port}/admin")

    app.run(host=host, port=port, debug=debug)