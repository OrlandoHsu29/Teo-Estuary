#!/usr/bin/env python3
"""数据库初始化脚本 - 确保数据库表存在"""
from app import create_app, db
import os

app = create_app()
uri = app.config["SQLALCHEMY_DATABASE_URI"]

with app.app_context():
    from app.models import Recording, APIKey

    # 创建所有表（如果不存在）
    db.create_all()
    print("Database tables initialized")

    # 验证表
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    print(f"Tables: {tables}")

    # 检查数据库文件
    if os.path.exists("/app/instance/dialect_recorder.db"):
        size = os.path.getsize("/app/instance/dialect_recorder.db")
        print(f"Database size: {size} bytes")
