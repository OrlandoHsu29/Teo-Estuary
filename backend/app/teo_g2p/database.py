"""teo_g2p 数据库配置 - 使用独立的 SQLite 数据库"""
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy import create_engine
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# 全局变量，将在应用上下文中初始化
engine = None
SessionLocal = None
db_session = None

def init_from_app(app):
    """
    初始化 teo_g2p 的独立 SQLite 数据库连接
    使用独立的 translation_dict.db 文件
    """
    global engine, SessionLocal, db_session

    # 获取 instance 目录路径
    instance_path = Path(app.instance_path)

    # 创建独立的 SQLite 数据库用于翻译词典
    translation_db_path = instance_path / 'translation_dict.db'

    # 创建 SQLite 引擎
    engine = create_engine(
        f'sqlite:///{translation_db_path}',
        connect_args={'check_same_thread': False}
    )

    # 创建会话工厂
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db_session = scoped_session(SessionLocal)

    logger.info(f"teo_g2p is using independent SQLite database: {translation_db_path}")

def init_db():
    """初始化数据库表（如果不存在）"""
    from app.teo_g2p.models import Base

    if engine is None:
        raise RuntimeError("Database engine not initialized. Call init_from_app() first.")

    Base.metadata.create_all(bind=engine)
    logger.info("teo_g2p database tables (teochew_dict) created/verified in translation_dict.db")

def get_db():
    """获取数据库会话"""
    if engine is None or db_session is None:
        raise RuntimeError("Database not initialized. Call init_from_app() first.")

    db = db_session()
    try:
        yield db
    finally:
        db.close()

def close_db():
    """关闭数据库连接"""
    if db_session is not None:
        db_session.remove()
