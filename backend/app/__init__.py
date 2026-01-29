"""应用初始化模块"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from pathlib import Path
import pymysql

# 安装 pymysql 作为 MySQL 驱动
pymysql.install_as_MySQLdb()

# 是否启用速率限制器（可通过环境变量 ENABLE_RATE_LIMITER 控制）
# 默认为 False（离线无限制版），线上版本可设置为 True
ENABLE_RATE_LIMITER = os.environ.get('ENABLE_RATE_LIMITER', 'False').lower() in ('true', '1', 't', 'yes', 'y')

# 只在启用时导入 Flask-Limiter
if ENABLE_RATE_LIMITER:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

# 获取后端根目录
BACKEND_ROOT = Path(__file__).parent.parent

# 初始化数据库
db = SQLAlchemy()

# 配置日志
import logging

# 创建自定义 Formatter，使用中国时区
class ChinaTimeFormatter(logging.Formatter):
    """使用中国时区的日志格式化器"""
    def __init__(self, fmt=None, datefmt=None, style='%'):
        super().__init__(fmt, datefmt, style)
        # 中国时区 (UTC+8)
        from datetime import timezone, timedelta
        self.china_tz = timezone(timedelta(hours=8))

    def formatTime(self, record, datefmt=None):
        """格式化时间为中国时区"""
        from datetime import datetime
        # 将 UTC 时间转换为中国时区
        ct = datetime.fromtimestamp(record.created, tz=self.china_tz)
        if datefmt:
            return ct.strftime(datefmt)
        else:
            return ct.strftime('%Y-%m-%d %H:%M:%S')

# 创建 formatter
formatter = ChinaTimeFormatter('%(asctime)s - %(levelname)s - %(message)s')

# 配置日志
file_handler = logging.FileHandler(str(BACKEND_ROOT / 'logs' / 'app.log'), encoding='utf-8')
file_handler.setFormatter(formatter)

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(formatter)

logging.basicConfig(
    level=logging.INFO,
    handlers=[file_handler, stream_handler]
)

logger = logging.getLogger(__name__)


class NoopLimiter:
    """无操作限流器 - 当禁用限流时使用

    这个类提供了与 Flask-Limiter 兼容的接口，但所有方法都是空操作，
    不会进行任何实际的限流。这样可以在不修改装饰器代码的情况下，
    通过配置开关限流功能。
    """

    def exempt(self, view_func):
        """豁免限流装饰器（空操作）"""
        # 直接返回原函数，不做任何修改
        return view_func

    def limit(self, limit_value="", key_func=None, **kwargs):
        """限流装饰器（空操作）"""

        def decorator(f):
            return f

        return decorator

    def __call__(self, *args, **kwargs):
        """使实例可调用"""
        return self


def create_limiter(app):
    """创建限流器实例

    根据配置创建真正的限流器或无操作限流器

    Args:
        app: Flask应用实例

    Returns:
        Limiter实例或NoopLimiter实例
    """
    if not ENABLE_RATE_LIMITER:
        logger.warning("[WARNING] Rate limiter is DISABLED (ENABLE_RATE_LIMITER=False)")
        return NoopLimiter()

    # 启用限流器
    rate_limit_storage = os.environ.get('RATELIMIT_STORAGE_URL', 'memory://')
    rate_limit_default = os.environ.get('RATELIMIT_DEFAULT', '1000 per day, 100 per hour')

    # 通过 Flask app config 配置 Flask-Limiter
    app.config['RATELIMIT_STORAGE_URL'] = rate_limit_storage
    app.config['RATELIMIT_DEFAULT'] = rate_limit_default
    app.config['RATELIMIT_STRATEGY'] = 'fixed-window'

    # 解析默认限制配置
    default_limits = []
    for limit in rate_limit_default.split(','):
        limit = limit.strip()
        if limit:
            default_limits.append(limit)

    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=default_limits,
        storage_uri=rate_limit_storage,
        headers_enabled=True
    )

    logger.info(f"[OK] Rate limiter ENABLED with storage: {rate_limit_storage}")
    logger.info(f"Default limits: {default_limits}")

    return limiter


def create_app():
    """应用工厂函数"""
    # 创建Flask应用
    app = Flask(__name__,
        template_folder=str(BACKEND_ROOT / 'templates'),
        static_folder=str(BACKEND_ROOT / 'static')
    )

    # 配置
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

    # MySQL 数据库配置（用于 recordings 和 api_keys 表）
    mysql_host = os.environ.get('MYSQL_HOST', 'localhost')
    mysql_port = os.environ.get('MYSQL_PORT', '3306')
    mysql_user = os.environ.get('MYSQL_USER', 'root')
    mysql_password = os.environ.get('MYSQL_PASSWORD', '')
    mysql_database = os.environ.get('MYSQL_DATABASE', 'teo_estuary')

    # 构建 MySQL 连接字符串（确保密码部分正确）
    if mysql_password:
        database_url = f'mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}?charset=utf8mb4'
    else:
        database_url = f'mysql+pymysql://{mysql_user}@{mysql_host}:{mysql_port}/{mysql_database}?charset=utf8mb4'

    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    logger.info(f"Using MySQL database: {mysql_user}@{mysql_host}:{mysql_port}/{mysql_database}")
    app.config['DATA_FOLDER'] = str(BACKEND_ROOT / 'data')
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

    # Dify Webhook配置（用于生成参考文本）
    app.config['DIFY_WEBHOOK_URL'] = os.environ.get('DIFY_WEBHOOK_URL', 'your-Dify-workflow-webhook-trigger-URL')

    # Webhook密钥（Dify回调认证）
    app.config['WEBHOOK_KEY'] = os.environ.get('WEBHOOK_KEY', '')

    # 管理员配置
    app.config['ADMIN_USERNAME'] = os.environ.get('ADMIN_USERNAME', 'admin')
    app.config['ADMIN_PASSWORD'] = os.environ.get('ADMIN_PASSWORD', 'your-admin-password')

    # 文本验证配置（30秒录音最多约300字）
    app.config['MAX_TEXT_LENGTH'] = 300

    # 设置instance_path为instance目录
    app.instance_path = str(BACKEND_ROOT / 'instance')

    # 确保必要的目录存在
    os.makedirs(BACKEND_ROOT / 'logs', exist_ok=True)
    os.makedirs(BACKEND_ROOT / 'instance', exist_ok=True)
    os.makedirs(app.config['DATA_FOLDER'], exist_ok=True)
    os.makedirs(f'{app.config["DATA_FOLDER"]}/uploads', exist_ok=True)
    os.makedirs(f'{app.config["DATA_FOLDER"]}/good', exist_ok=True)
    os.makedirs(f'{app.config["DATA_FOLDER"]}/bad', exist_ok=True)

    # 初始化扩展
    db.init_app(app)

    # 启用CORS支持
    CORS(app, resources={
        r"/*": {
            "origins": "*",  # 允许所有来源，包括 file://
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "X-API-Key", "X-Requested-With"],
            "expose_headers": ["Content-Type"],
            "supports_credentials": False,
            "max_age": 3600  # 预检请求缓存时间
        }
    })

    # 创建限流器（根据配置决定是否启用）
    limiter = create_limiter(app)

    # 将 limiter 附加到 app 对象，以便其他模块可以使用
    app.limiter = limiter

    # 注册蓝图
    from app.api import auth_bp, recordings_bp, keys_bp, text_bp, dictionary_bp, dictionary_sync_bp, asr_bp, reference_bp
    from app.api.jieba_sync import jieba_sync_bp
    from app.admin.routes import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(recordings_bp)
    app.register_blueprint(keys_bp)
    app.register_blueprint(text_bp)
    app.register_blueprint(dictionary_bp)
    app.register_blueprint(dictionary_sync_bp)
    app.register_blueprint(asr_bp)
    app.register_blueprint(reference_bp)
    app.register_blueprint(jieba_sync_bp)
    app.register_blueprint(admin_bp)

    # 豁免特定路由的速率限制（仅在启用limiter时）
    # Emilia 健康检查路由和统计路由会被前端频繁调用，需要豁免
    # validate-key 接口有自己的API密钥限流机制，不需要Flask-Limiter再限制
    # 注意：蓝图路由注册后，视图函数名格式为 {蓝图名}.{函数名}
    if ENABLE_RATE_LIMITER:
        limiter.exempt(app.view_functions.get('recordings.teo_emilia_health'))
        limiter.exempt(app.view_functions.get('recordings.api_stats'))
        limiter.exempt(app.view_functions.get('text.api_validate_key'))

    # 注册错误处理器
    register_error_handlers(app)

    # 注册基础路由
    register_base_routes(app, limiter)

    # 创建数据库表
    with app.app_context():
        from app.models import Recording, APIKey, ReferenceText, GenerationTask

        # 创建 MySQL 表（如果不存在）
        # db.create_all() 默认会检查表是否存在，只创建不存在的表
        db.create_all()
        logger.info("MySQL tables initialized")

        # 初始化 teo_g2p 使用独立数据库连接
        try:
            from app.teo_g2p.database import init_from_app, init_db
            from app.teo_g2p import models  # 确保导入模型以便注册

            # 先初始化 teo_g2p 的数据库连接
            init_from_app(app)
            # 然后创建表
            init_db()
            logger.info("teo_g2p database tables initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize teo_g2p database: {e}")

    return app


def register_error_handlers(app):
    """注册错误处理器"""
    @app.errorhandler(413)
    def too_large(e):
        """文件过大错误处理"""
        return jsonify({'error': '文件太大，请选择小于100MB的文件'}), 413

    @app.errorhandler(404)
    def not_found(e):
        """404错误处理"""
        return jsonify({'error': '页面不存在'}), 404

    @app.errorhandler(500)
    def internal_error(e):
        """500错误处理"""
        logger.error(f"Internal server error: {e}")
        return jsonify({'error': '服务器内部错误'}), 500


def register_base_routes(app, limiter):
    """注册基础路由"""
    @app.route('/api/test', methods=['GET'])
    def api_test():
        """测试API端点"""
        from datetime import datetime
        return jsonify({
            'success': True,
            'message': '后端API正常工作',
            'timestamp': datetime.now().isoformat()
        })

    @app.route('/health', methods=['GET'])
    @limiter.exempt  # 健康检查不受速率限制
    def health_check():
        """Docker健康检查端点"""
        from datetime import datetime
        try:
            # 简单的数据库连接检查
            with db.engine.connect() as conn:
                conn.execute(db.text('SELECT 1'))
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat()
            }), 200
        except Exception as e:
            return jsonify({
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 503