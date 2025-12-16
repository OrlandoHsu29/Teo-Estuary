"""限流器工具模块"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import logging

logger = logging.getLogger(__name__)

# 创建限流器实例，稍后在应用工厂中配置
limiter = Limiter(
    key_func=get_remote_address,
    headers_enabled=True,
    swallow_errors=False
)


def limit_api_key_requests(f):
    """基于API密钥的限流装饰器"""
    def decorated_function(*args, **kwargs):
        # 这里可以添加基于API密钥的自定义限流逻辑
        # 目前使用全局限流
        return f(*args, **kwargs)
    return decorated_function