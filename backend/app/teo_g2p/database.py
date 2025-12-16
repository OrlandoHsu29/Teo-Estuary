from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool
import os

# 数据库配置 - 使用instance目录
# 获取相对于backend目录的路径
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))
instance_dir = os.path.join(backend_dir, 'instance')
db_path = os.path.join(instance_dir, 'teo_g2p.db')

# 确保instance目录存在
os.makedirs(instance_dir, exist_ok=True)

DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{db_path}')

# 创建数据库引擎
engine = create_engine(
    DATABASE_URL,
    poolclass=StaticPool,
    connect_args={
        "check_same_thread": False,
        "timeout": 20
    },
    echo=False  # 设置为True可以查看SQL执行日志
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db_session = scoped_session(SessionLocal)

def init_db():
    """初始化数据库表"""
    from models import Base
    Base.metadata.create_all(bind=engine)

def get_db():
    """获取数据库会话"""
    # 检查数据库文件是否存在
    if not os.getenv('DATABASE_URL'):  # 只有在使用SQLite时才检查文件
        if not os.path.exists(db_path):
            raise FileNotFoundError(
                f"Database file not found: {db_path}\n"
                "Please ensure the database file exists before running the application.\n"
                "To create a new database, run the initialization script first."
            )

    db = db_session()
    try:
        yield db
    finally:
        db.close()

def close_db():
    """关闭数据库连接"""
    db_session.remove()