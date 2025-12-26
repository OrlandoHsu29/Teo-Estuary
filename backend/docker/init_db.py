#!/usr/bin/env python3
"""数据库初始化脚本 - 确保数据库表存在"""
from app import create_app, db
import os

app = create_app()
uri = app.config["SQLALCHEMY_DATABASE_URI"]

print(f"Database URI: {uri}")

with app.app_context():
    from app.models import Recording, APIKey

    # 创建所有表（如果不存在）
    # 这会创建主应用的表（recordings, api_keys）
    # teo_g2p 的表也会在 create_app() 中自动创建
    db.create_all()
    print("[OK] Main app tables initialized")

    # 验证表
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    print(f"[OK] Tables in database: {tables}")

    # 检查数据库文件
    db_path = "/app/instance/recorder_manager.db"
    if os.path.exists(db_path):
        size = os.path.getsize(db_path)
        print(f"[OK] Database file size: {size} bytes")
    else:
        print(f"[WARNING] Database file not found at: {db_path}")

    print("\n[SUCCESS] Database initialization complete!")
