"""应用初始化模块"""
from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os
from pathlib import Path

# 获取后端根目录
BACKEND_ROOT = Path(__file__).parent.parent

# 初始化数据库
db = SQLAlchemy()

# 配置日志
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(str(BACKEND_ROOT / 'logs' / 'app.log'), encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def create_app():
    """应用工厂函数"""
    # 创建Flask应用
    app = Flask(__name__,
        template_folder=str(BACKEND_ROOT / 'templates'),
        static_folder=str(BACKEND_ROOT / 'static')
    )

    # 配置
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

    # 数据库配置 - 使用统一的 recorder_manager.db
    default_db_path = BACKEND_ROOT / 'instance' / 'recorder_manager.db'
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{default_db_path}'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['DATA_FOLDER'] = str(BACKEND_ROOT / 'data')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

    # 硅基流动API配置
    app.config['SILICONFLOW_API_KEY'] = os.environ.get('SILICONFLOW_API_KEY', 'sk-dqfrbwdryedhuzxwtgdzfffxjstlkkjgenatmuwmembcdjhb')
    app.config['SILICONFLOW_BASE_URL'] = 'https://api.siliconflow.cn/v1'

    # 管理员配置
    app.config['ADMIN_USERNAME'] = os.environ.get('ADMIN_USERNAME', 'admin')
    app.config['ADMIN_PASSWORD'] = os.environ.get('ADMIN_PASSWORD', 'your-admin-password')

    # 文本验证配置
    app.config['MAX_TEXT_LENGTH'] = 500

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
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": "*"
        }
    })

    # Flask-Limiter 配置
    rate_limit_storage = os.environ.get('RATELIMIT_STORAGE_URL', 'memory://')
    rate_limit_default = os.environ.get('RATELIMIT_DEFAULT', '1000 per day, 100 per hour')

    # 通过 Flask app config 配置 Flask-Limiter
    app.config['RATELIMIT_STORAGE_URL'] = rate_limit_storage
    app.config['RATELIMIT_DEFAULT'] = rate_limit_default
    app.config['RATELIMIT_STRATEGY'] = 'fixed-window'

    # 重新创建 Limiter 实例并初始化（因为需要使用配置）
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

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

    # 将 limiter 附加到 app 对象，以便其他模块可以使用
    app.limiter = limiter

    logger.info(f"Flask-Limiter initialized with storage: {rate_limit_storage}")
    logger.info(f"Default limits: {default_limits}")

    # 注册蓝图
    from app.api import auth_bp, recordings_bp, keys_bp, text_bp, dictionary_bp, dictionary_sync_bp
    from app.api.jieba_sync import jieba_sync_bp
    from app.admin.routes import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(recordings_bp)
    app.register_blueprint(keys_bp)
    app.register_blueprint(text_bp)
    app.register_blueprint(dictionary_bp)
    app.register_blueprint(dictionary_sync_bp)
    app.register_blueprint(jieba_sync_bp)
    app.register_blueprint(admin_bp)

    # 豁免特定路由的速率限制
    # Emilia 健康检查路由和统计路由会被前端频繁调用，需要豁免
    # 注意：蓝图路由注册后，视图函数名格式为 {蓝图名}.{函数名}
    limiter.exempt(app.view_functions['recordings.teo_emilia_health'])
    limiter.exempt(app.view_functions['recordings.api_stats'])

    # 注册错误处理器
    register_error_handlers(app)

    # 注册基础路由
    register_base_routes(app, limiter)

    # 创建数据库表
    with app.app_context():
        from app.models import Recording, APIKey
        db.create_all()

        # 初始化 teo_g2p 使用主数据库连接
        try:
            from app.teo_g2p.database import init_from_app, init_db
            from app.teo_g2p import models  # 确保导入模型以便注册

            # 先初始化 teo_g2p 的数据库连接
            init_from_app(app)
            # 然后创建表
            init_db()
            logger.info("teo_g2p database tables initialized successfully in main database")
        except Exception as e:
            logger.error(f"Failed to initialize teo_g2p database: {e}")

        # 初始化AI文本生成器
        from app.ai_generator import create_text_generator
        app.text_generator = create_text_generator(api_key=app.config['SILICONFLOW_API_KEY'])

    return app


def register_error_handlers(app):
    """注册错误处理器"""
    @app.errorhandler(413)
    def too_large(e):
        """文件过大错误处理"""
        return jsonify({'error': '文件太大，请选择小于16MB的文件'}), 413

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