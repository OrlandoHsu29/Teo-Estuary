"""组合装饰器模块"""
from functools import wraps
from flask import jsonify
import logging
import os
from app.utils.decorators import verify_api_key
from app.utils.api_key_limiter import api_key_rate_limit, _api_key_usage
from app.utils.timezone import now
from datetime import timedelta

logger = logging.getLogger(__name__)

# 是否启用速率限制器（可通过环境变量 ENABLE_RATE_LIMITER 控制）
# 默认为 False（离线无限制版），线上版本可设置为 True
ENABLE_RATE_LIMITER = os.environ.get('ENABLE_RATE_LIMITER', 'False').lower() in ('true', '1', 't', 'yes', 'y')


def api_key_required_with_rate_limit(hourly_limit=300, daily_limit=750):
    """API密钥验证 + 速率限制组合装饰器

    当 ENABLE_RATE_LIMITER=False 时，仅验证API密钥，不进行速率限制。
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import request
            from app import db

            # 跳过 OPTIONS 请求（CORS 预检），直接返回200
            if request.method == 'OPTIONS':
                return '', 200

            # 1. 验证API密钥
            key_obj, error = verify_api_key(request)
            if error:
                return jsonify({'success': False, 'error': error['error']}), 401

            # 2. 如果启用限流，应用速率限制
            if ENABLE_RATE_LIMITER:
                api_key = key_obj.key
                current_time = now()

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

                logger.info(f"API key {api_key} usage: {len(usage['requests'])}/{hourly_limit} (hourly), {daily_requests}/{daily_limit} (daily)")

            # 3. 检查API密钥的每日限制（数据库中的max_requests）- 这部分始终启用
            if key_obj.usage_count >= key_obj.max_requests:
                return jsonify({
                    'success': False,
                    'error': f'API密钥今日使用次数已用尽 ({key_obj.max_requests}次/天)',
                    'retry_after': 86400
                }), 429

            # 4. 更新数据库
            key_obj.last_used = now()  # 使用中国时间
            key_obj.usage_count += 1
            db.session.commit()

            # 5. 调用原函数，传入key_obj作为第一个参数
            return f(key_obj, *args, **kwargs)
        return decorated_function
    return decorator