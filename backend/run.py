"""应用启动脚本"""
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db, logger

# 创建应用实例
app = create_app()

if __name__ == '__main__':
    print("后台管理系统: http://localhost:5000/admin")
    app.run(host='0.0.0.0', port=5000, debug=True)