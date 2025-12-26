"""teo_g2p 数据库配置 - 使用主数据库连接"""
from sqlalchemy.orm import sessionmaker, scoped_session
import logging

logger = logging.getLogger(__name__)

# 全局变量，将在应用上下文中初始化
engine = None
SessionLocal = None
db_session = None

def init_from_app(app):
    """
    从Flask应用初始化数据库连接
    teo_g2p 现在使用主数据库的引擎
    """
    global engine, SessionLocal, db_session

    # 使用主数据库的引擎
    from app import db as main_db
    engine = main_db.engine

    # 创建会话工厂
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db_session = scoped_session(SessionLocal)

    logger.info("teo_g2p is using the main database engine (recorder_manager.db)")

def init_db():
    """初始化数据库表（如果不存在）"""
    from app.teo_g2p.models import Base

    if engine is None:
        raise RuntimeError("Database engine not initialized. Call init_from_app() first.")

    Base.metadata.create_all(bind=engine)
    logger.info("teo_g2p database tables created/verified in main database")

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
