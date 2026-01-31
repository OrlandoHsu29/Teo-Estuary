"""基于API密钥的自定义限流器"""
import os
from datetime import timedelta
from app.utils.datetime_utils import now_utc
import logging
from functools import wraps
from flask import jsonify

logger = logging.getLogger(__name__)

# 是否启用速率限制器（可通过环境变量 ENABLE_RATE_LIMITER 控制）
# 默认为 False（离线无限制版），线上版本可设置为 True
ENABLE_RATE_LIMITER = os.environ.get('ENABLE_RATE_LIMITER', 'False').lower() in ('true', '1', 't', 'yes', 'y')

# 内存存储用于跟踪API密钥使用情况
_api_key_usage = {}

def api_key_rate_limit(hourly_limit=300, daily_limit=750):
    """基于API密钥的速率限制装饰器

    当 ENABLE_RATE_LIMITER=False 时，此装饰器不进行任何限制。

    Args:
        hourly_limit (int): 每小时请求限制
        daily_limit (int): 每天请求限制
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # 如果禁用限流，直接调用原函数
            if not ENABLE_RATE_LIMITER:
                return f(*args, **kwargs)

            # 第一个参数应该是key_obj（来自api_key_required装饰器）
            key_obj = args[0] if args else None

            if not key_obj:
                logger.error("API key object not found in arguments")
                return jsonify({
                    'success': False,
                    'error': 'API密钥验证失败'
                }), 401

            api_key = key_obj.key
            current_time = now_utc()

            # 获取或初始化该API密钥的使用记录
            if api_key not in _api_key_usage:
                _api_key_usage[api_key] = {
                    'requests': [],
                    'last_reset': current_time
                }

            usage = _api_key_usage[api_key]

            # 清理过期的请求记录（超过1小时的）
            one_hour_ago = current_time - timedelta(hours=1)
            usage['requests'] = [
                req_time for req_time in usage['requests']
                if req_time > one_hour_ago
            ]

            # 检查小时限制
            if len(usage['requests']) >= hourly_limit:
                logger.warning(f"API key {api_key} exceeded hourly limit: {len(usage['requests'])}/{hourly_limit}")
                return jsonify({
                    'success': False,
                    'error': f'API密钥已达到每小时请求限制（{hourly_limit}次/小时）',
                    'retry_after': 3600
                }), 429

            # 检查每日限制
            one_day_ago = current_time - timedelta(days=1)
            daily_requests = len([
                req_time for req_time in usage['requests']
                if req_time > one_day_ago
            ])

            if daily_requests >= daily_limit:
                logger.warning(f"API key {api_key} exceeded daily limit: {daily_requests}/{daily_limit}")
                return jsonify({
                    'success': False,
                    'error': f'API密钥已达到每日请求限制（{daily_limit}次/天）',
                    'retry_after': 86400
                }), 429

            # 记录当前请求
            usage['requests'].append(current_time)

            # 记录到数据库（可选，用于持久化）
            key_obj.last_used = current_time
            # 注意：这里不更新usage_count，因为那是在api_key_required装饰器中处理的

            logger.info(f"API key {api_key} usage: {len(usage['requests'])}/{hourly_limit} (hourly), {daily_requests}/{daily_limit} (daily)")

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def cleanup_old_usage():
    """清理过期的API密钥使用记录"""
    if not ENABLE_RATE_LIMITER:
        return

    current_time = now_utc()
    one_day_ago = current_time - timedelta(days=1)

    for api_key, usage in _api_key_usage.items():
        # 清理超过1天的请求记录
        usage['requests'] = [
            req_time for req_time in usage['requests']
            if req_time > one_day_ago
        ]

        # 如果没有请求记录，删除该API密钥的条目
        if not usage['requests']:
            del _api_key_usage[api_key]