"""应用主入口文件"""
import os
import logging
from datetime import datetime
from pathlib import Path

# 导入应用工厂
from app import create_app, db, logger

# 创建应用实例
app = create_app()

# 为了向后兼容，保留一些旧的全局变量引用
SILICONFLOW_API_KEY = app.config['SILICONFLOW_API_KEY']
SILICONFLOW_BASE_URL = app.config['SILICONFLOW_BASE_URL']
ADMIN_USERNAME = app.config['ADMIN_USERNAME']
ADMIN_PASSWORD = app.config['ADMIN_PASSWORD']
MAX_TEXT_LENGTH = app.config['MAX_TEXT_LENGTH']
text_generator = app.text_generator
teochew_converter = app.teochew_converter

# 导入模型使其在 SQLAlchemy 中注册
from app.models import Recording, APIKey

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)