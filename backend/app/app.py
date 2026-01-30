"""应用主入口文件"""
import os
import logging
from datetime import datetime
from pathlib import Path

# 导入应用工厂
from app import create_app, db, logger

# 创建应用实例
app = create_app()

# 导入模型使其在 SQLAlchemy 中注册
from app.models import Recording, APIKey

if __name__ == '__main__':
    debug_mode = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 't', 'yes')
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)